/**
 * useDecryptedMedia Hook
 *
 * React hook for decrypting E2EE encrypted media files (images/videos).
 * Handles downloading, decrypting, and caching decrypted media.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import { decryptMediaFile, cleanupDecryptedMedia, MESSAGE_VERSION_E2EE, repairStaleKey } from '../lib/encryption';
import type { KeysMetadata, RSAPrivateKeyJWK } from '../lib/encryption';
import { useEncryptionKeys } from './useEncryptionKeys';
import { getCachedSignedUrl, getStoragePath } from '../lib/imageCache';
import { supabase } from '../lib/supabase';
import { reencryptPendingMessages } from '../lib/encryption/reencryptPendingMessages';
// Import shared cache from mediaCache to avoid circular dependency
import { decryptedMediaCache, clearDecryptedMediaCache } from '../lib/mediaCache';

export type DecryptedMediaErrorCode =
  | 'E2EE_NOT_SUPPORTED'
  | 'E2EE_KEYS_UNAVAILABLE'
  | 'E2EE_MISSING_FIELDS'
  | 'E2EE_PENDING_RECIPIENT_KEY'
  | 'E2EE_DECRYPT_FAILED';

// Re-export clearDecryptedMediaCache for backwards compatibility
export { clearDecryptedMediaCache };

interface DecryptedMediaState {
  /** Local file URI to the decrypted media (or null if not ready) */
  uri: string | null;
  /** Whether decryption is in progress */
  isDecrypting: boolean;
  /** Error if decryption failed */
  error: Error | null;
  /** Optional error code for UX */
  errorCode?: DecryptedMediaErrorCode;
}

interface UseDecryptedMediaOptions {
  /** The message ID (used for cache key) */
  messageId: string;
  /** Path to the media file in storage */
  mediaPath: string | null;
  /** Message version (1 = plaintext, 2 = encrypted) */
  version: number | null | undefined;
  /** Encryption IV (required for v2) */
  encryptionIv: string | null | undefined;
  /** Keys metadata containing wrapped keys (required for v2) */
  keysMetadata: KeysMetadata | null | undefined;
  /** Whether current user is the sender */
  isMe: boolean;
  /** Media type */
  mediaType: 'image' | 'video';
  /** Whether media should be fetched (e.g., not hidden) */
  shouldFetch: boolean;
}

export type UseDecryptedMediaResult = DecryptedMediaState & {
  isEncrypted: boolean;
  retry: () => void;
};

/**
 * Hook to decrypt encrypted media files
 */
export function useDecryptedMedia({
  messageId,
  mediaPath,
  version,
  encryptionIv,
  keysMetadata,
  isMe,
  mediaType,
  shouldFetch,
}: UseDecryptedMediaOptions): UseDecryptedMediaResult {
  const [state, setState] = useState<DecryptedMediaState>({
    uri: null,
    isDecrypting: false,
    error: null,
  });

  const { privateKeyJwk, hasKeys, isLoading: keysLoading } = useEncryptionKeys();
  const isMounted = useRef(true);

  const repairAttemptedByMessageId = useRef(new Set<string>());
  const [retryNonce, setRetryNonce] = useState(0);

  const retry = useCallback(() => {
    repairAttemptedByMessageId.current.delete(messageId);
    setRetryNonce((n) => n + 1);
  }, [messageId]);

  // Determine if this is encrypted media
  const isEncrypted = version === MESSAGE_VERSION_E2EE && (mediaPath?.endsWith('.enc') ?? false);

  const decryptMedia = useCallback(async () => {
    // No media path - nothing to do
    if (!mediaPath || !shouldFetch) {
      setState({ uri: null, isDecrypting: false, error: null, errorCode: undefined });
      return;
    }

    console.log(
      `[E2EE Media] Message ${messageId}: Starting decrypt - version=${version}, mediaPath=${mediaPath}, isEncrypted=${isEncrypted}`,
    );

    // Check cache first
    const cacheKey = `${messageId}-${mediaPath}`;
    const cachedUri = decryptedMediaCache.get(cacheKey);
    if (cachedUri) {
      try {
        const fileInfo = await FileSystem.getInfoAsync(cachedUri);
        if (fileInfo.exists) {
          console.log(`[E2EE Media] Message ${messageId}: Using cached decrypted file`);
          setState({ uri: cachedUri, isDecrypting: false, error: null, errorCode: undefined });
          return;
        }
      } catch {
        decryptedMediaCache.delete(cacheKey);
      }
    }

    // v1 (plaintext) or non-.enc files: Use existing signed URL flow
    if (!isEncrypted) {
      console.log(`[E2EE Media] Message ${messageId}: Not encrypted, using signed URL flow`);
      try {
        const storagePath = getStoragePath(mediaPath);
        const signedUrl = await getCachedSignedUrl(storagePath);
        if (isMounted.current) {
          setState({
            uri: signedUrl,
            isDecrypting: false,
            error: signedUrl ? null : new Error('Failed to get signed URL'),
            errorCode: signedUrl ? undefined : 'E2EE_DECRYPT_FAILED',
          });
        }
      } catch (err) {
        console.error(`[E2EE Media] Message ${messageId}: Failed to get signed URL:`, err);
        if (isMounted.current) {
          setState({
            uri: null,
            isDecrypting: false,
            error: err as Error,
            errorCode: 'E2EE_DECRYPT_FAILED',
          });
        }
      }
      return;
    }

    // v2 (encrypted) media - requires decryption
    console.log(`[E2EE Media] Message ${messageId}: Encrypted media, starting decryption`);

    if (Platform.OS === 'web') {
      setState({
        uri: null,
        isDecrypting: false,
        error: new Error('Failed to load media'),
        errorCode: 'E2EE_NOT_SUPPORTED',
      });
      return;
    }

    // Wait for keys to load
    if (keysLoading) {
      console.log(`[E2EE Media] Message ${messageId}: Keys still loading...`);
      setState((prev) => ({ ...prev, isDecrypting: true }));
      return;
    }

    if (!hasKeys || !privateKeyJwk) {
      console.log(
        `[E2EE Media] Message ${messageId}: No keys available - hasKeys=${hasKeys}, hasPrivateKey=${!!privateKeyJwk}`,
      );
      setState({
        uri: null,
        isDecrypting: false,
        error: new Error('Failed to load media'),
        errorCode: 'E2EE_KEYS_UNAVAILABLE',
      });
      return;
    }

    // Validate required encryption fields
    if (!encryptionIv || !keysMetadata) {
      console.log(
        `[E2EE Media] Message ${messageId}: Missing encryption metadata - iv=${!!encryptionIv}, keysMetadata=${!!keysMetadata}`,
      );
      setState({
        uri: null,
        isDecrypting: false,
        error: new Error('Failed to load media'),
        errorCode: 'E2EE_MISSING_FIELDS',
      });
      return;
    }

    // If the recipient key is missing, try server-assisted repair (admin recovery model).
    let effectiveKeysMetadata: KeysMetadata | null = keysMetadata;

    const getWrappedKey = (metadata: KeysMetadata | null): string | undefined =>
      isMe ? metadata?.sender_wrapped_key : metadata?.recipient_wrapped_key;

    let wrappedKey = getWrappedKey(effectiveKeysMetadata);

    if (!wrappedKey) {
      console.log(
        `[E2EE Media] Message ${messageId}: No wrapped key for ${isMe ? 'sender' : 'recipient'} - pending_recipient=${(effectiveKeysMetadata as any)?.pending_recipient}`,
      );

      if (!isMe) {
        setState({
          uri: null,
          isDecrypting: true,
          error: null,
          errorCode: 'E2EE_PENDING_RECIPIENT_KEY',
        });

        if (!repairAttemptedByMessageId.current.has(messageId)) {
          repairAttemptedByMessageId.current.add(messageId);
          await reencryptPendingMessages();
        }

        const { data: refreshed } = await supabase
          .from('messages')
          .select('keys_metadata')
          .eq('id', messageId)
          .maybeSingle();

        effectiveKeysMetadata = (refreshed?.keys_metadata ?? null) as KeysMetadata | null;
        wrappedKey = getWrappedKey(effectiveKeysMetadata);
      }

      if (!wrappedKey) {
        setState({
          uri: null,
          isDecrypting: false,
          error: null,
          errorCode: 'E2EE_PENDING_RECIPIENT_KEY',
        });
        return;
      }
    }

    setState((prev) => ({ ...prev, isDecrypting: true, error: null, errorCode: undefined }));

    try {
      // Get signed URL for the encrypted file
      const storagePath = getStoragePath(mediaPath);
      console.log(`[E2EE Media] Message ${messageId}: Getting signed URL for ${storagePath}`);
      const encryptedUrl = await getCachedSignedUrl(storagePath);

      if (!encryptedUrl) {
        throw new Error('Failed to load media');
      }

      console.log(`[E2EE Media] Message ${messageId}: Decrypting ${mediaType}...`);

      const decryptedUri = await decryptMediaFile(
        encryptedUrl,
        encryptionIv,
        effectiveKeysMetadata as KeysMetadata,
        privateKeyJwk as RSAPrivateKeyJWK,
        !isMe, // isRecipient
        mediaType,
      );

      console.log(`[E2EE Media] Message ${messageId}: Decryption successful - ${decryptedUri}`);

      decryptedMediaCache.set(cacheKey, decryptedUri);

      if (isMounted.current) {
        setState({
          uri: decryptedUri,
          isDecrypting: false,
          error: null,
          errorCode: undefined,
        });
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      console.error(`[E2EE Media] Message ${messageId}: Decryption failed:`, error);

      // Check if this is a stale key failure (message encrypted with old key)
      const isStaleKeyFailure =
        error.name === 'OperationError' ||
        error.message.includes('OperationError') ||
        error.message.includes('decryption failed') ||
        error.message.includes('decrypt error') ||
        error.message.includes('error in DoCipher');

      // Attempt stale key repair if not already attempted
      if (isStaleKeyFailure && !repairAttemptedByMessageId.current.has(messageId)) {
        console.log(`[E2EE Media] Message ${messageId}: Attempting stale key repair...`);

        if (isMounted.current) {
          setState({
            uri: null,
            isDecrypting: true,
            error: null,
            errorCode: undefined,
          });
        }

        repairAttemptedByMessageId.current.add(messageId);

        try {
          const repairResult = await repairStaleKey(messageId);

          if (repairResult.success) {
            console.log(`[E2EE Media] Message ${messageId}: Stale key repaired, retrying decryption...`);

            // Fetch updated message and retry
            const { data: refreshed } = await supabase
              .from('messages')
              .select('keys_metadata')
              .eq('id', messageId)
              .maybeSingle();

            const refreshedMetadata = (refreshed?.keys_metadata ?? null) as KeysMetadata | null;

            if (refreshedMetadata && encryptionIv && mediaPath) {
              const storagePath = getStoragePath(mediaPath);
              const encryptedUrl = await getCachedSignedUrl(storagePath);

              if (encryptedUrl) {
                const decryptedUri = await decryptMediaFile(
                  encryptedUrl,
                  encryptionIv,
                  refreshedMetadata,
                  privateKeyJwk as RSAPrivateKeyJWK,
                  !isMe,
                  mediaType,
                );

                const cacheKey = `${messageId}-${mediaPath}`;
                decryptedMediaCache.set(cacheKey, decryptedUri);

                if (isMounted.current) {
                  setState({
                    uri: decryptedUri,
                    isDecrypting: false,
                    error: null,
                    errorCode: undefined,
                  });
                }
                return;
              }
            }
          } else {
            console.error(`[E2EE Media] Message ${messageId}: Stale key repair failed:`, repairResult.error);
          }
        } catch (repairErr) {
          console.error(`[E2EE Media] Message ${messageId}: Stale key repair threw:`, repairErr);
        }
      }

      if (isMounted.current) {
        setState({
          uri: null,
          isDecrypting: false,
          error: new Error('Failed to load media'),
          errorCode: 'E2EE_DECRYPT_FAILED',
        });
      }
    }
  }, [
    messageId,
    mediaPath,
    version,
    encryptionIv,
    keysMetadata,
    isMe,
    mediaType,
    shouldFetch,
    isEncrypted,
    privateKeyJwk,
    hasKeys,
    keysLoading,
    retryNonce,
  ]);

  useEffect(() => {
    isMounted.current = true;
    decryptMedia();

    return () => {
      isMounted.current = false;
    };
  }, [decryptMedia, retryNonce]);

  return {
    ...state,
    isEncrypted,
    retry,
  };
}

