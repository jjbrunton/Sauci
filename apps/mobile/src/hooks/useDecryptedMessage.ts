/**
 * useDecryptedMessage Hook
 *
 * React hook for decrypting E2EE messages.
 * Handles both v1 (plaintext) and v2 (encrypted) messages.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Platform } from 'react-native';
import {
  decryptTextMessage,
  MESSAGE_VERSION_PLAINTEXT,
  MESSAGE_VERSION_E2EE,
  repairStaleKey,
  triggerAutoKeyRotation,
} from '../lib/encryption';
import type {
  DecryptedMessageState,
  KeysMetadata,
  RSAPrivateKeyJWK,
} from '../lib/encryption';
import { supabase } from '../lib/supabase';
import { reencryptPendingMessages } from '../lib/encryption/reencryptPendingMessages';
import { useEncryptionKeys } from './useEncryptionKeys';
import { useAuthStore } from '../store/authStore';

const AUTO_RETRY_BASE_DELAY_MS = 3000;
const MAX_AUTO_RETRIES = 2;
const autoRetryCountsByMessageId = new Map<string, number>();

interface Message {
  id: string;
  content: string | null;
  version?: number | null;
  encrypted_content?: string | null;
  encryption_iv?: string | null;
  keys_metadata?: KeysMetadata | null;
  user_id: string;
}

interface UseDecryptedMessageOptions {
  /** The message to decrypt */
  message: Message;
  /** Current user's ID to determine if sender or recipient */
  currentUserId: string;
}

export type UseDecryptedMessageResult = DecryptedMessageState & {
  /** Force a re-attempt (used by UI retry affordances) */
  retry: () => void;
};

/**
 * Hook to decrypt a message
 *
 * Automatically handles:
 * - v1 (plaintext) messages: returns content directly
 * - v2 (encrypted) messages: decrypts using private key
 * - Server-assisted re-wrap for pending recipient keys (admin recovery model)
 */
export function useDecryptedMessage({
  message,
  currentUserId,
}: UseDecryptedMessageOptions): UseDecryptedMessageResult {
  const [state, setState] = useState<DecryptedMessageState>({
    content: null,
    mediaUri: null,
    isDecrypting: false,
    error: null,
  });

  const { privateKeyJwk, hasKeys, isLoading: keysLoading, ensureKeysUploaded } = useEncryptionKeys();
  const beginEncryptionRecovery = useAuthStore((s) => s.beginEncryptionRecovery);
  const endEncryptionRecovery = useAuthStore((s) => s.endEncryptionRecovery);

  // Track per-message repair attempts to avoid tight retry loops.
  const repairAttemptedByMessageId = useRef(new Set<string>());
  const [retryNonce, setRetryNonce] = useState(0);
  const autoRetryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const retry = useCallback(() => {
    repairAttemptedByMessageId.current.delete(message.id);
    setRetryNonce((n) => n + 1);
  }, [message.id]);

  const decrypt = useCallback(async () => {
    // Version 1 or undefined: Legacy plaintext message
    const version = message.version ?? MESSAGE_VERSION_PLAINTEXT;

    console.log(
      `[E2EE Decrypt] Message ${message.id}: version=${version}, hasEncryptedContent=${!!message.encrypted_content}, hasIV=${!!message.encryption_iv}, hasKeysMetadata=${!!message.keys_metadata}`,
    );

    if (version === MESSAGE_VERSION_PLAINTEXT) {
      console.log(`[E2EE Decrypt] Message ${message.id}: Using plaintext content`);
      setState({
        content: message.content,
        mediaUri: null,
        isDecrypting: false,
        error: null,
        errorCode: undefined,
      });
      return;
    }

    // Version 2: E2EE - requires decryption
    if (version === MESSAGE_VERSION_E2EE) {
      console.log(`[E2EE Decrypt] Message ${message.id}: Attempting E2EE decryption`);

      // E2EE not supported on web
      if (Platform.OS === 'web') {
        console.log(`[E2EE Decrypt] Message ${message.id}: Web platform - E2EE not supported`);
        setState({
          content: null,
          mediaUri: null,
          isDecrypting: false,
          error: new Error('Encrypted message'),
          errorCode: 'E2EE_NOT_SUPPORTED',
        });
        return;
      }

      // Wait for keys to load
      if (keysLoading) {
        console.log(`[E2EE Decrypt] Message ${message.id}: Keys still loading, waiting...`);
        setState((prev) => ({ ...prev, isDecrypting: true }));
        return;
      }

      if (!hasKeys || !privateKeyJwk) {
        console.log(
          `[E2EE Decrypt] Message ${message.id}: No keys available - hasKeys=${hasKeys}, hasPrivateKey=${!!privateKeyJwk}`,
        );
        setState({
          content: null,
          mediaUri: null,
          isDecrypting: false,
          error: new Error('Waiting for keys...'),
          errorCode: 'E2EE_KEYS_UNAVAILABLE',
        });
        return;
      }

      // Validate required encryption fields
      if (!message.encrypted_content || !message.encryption_iv || !message.keys_metadata) {
        console.log(
          `[E2EE Decrypt] Message ${message.id}: Missing encryption fields - encrypted_content=${!!message.encrypted_content}, encryption_iv=${!!message.encryption_iv}, keys_metadata=${!!message.keys_metadata}`,
        );
        setState({
          content: null,
          mediaUri: null,
          isDecrypting: false,
          error: new Error('Message unavailable'),
          errorCode: 'E2EE_MISSING_FIELDS',
        });
        return;
      }

      setState((prev) => ({ ...prev, isDecrypting: true, error: null, errorCode: undefined }));

      try {
        const isMe = message.user_id === currentUserId;
        console.log(`[E2EE Decrypt] Message ${message.id}: Decrypting as ${isMe ? 'sender' : 'recipient'}`);
        console.log(
          `[E2EE Decrypt] Message ${message.id}: keys_metadata=`,
          JSON.stringify(message.keys_metadata, null, 2),
        );

        const decryptedContent = await decryptTextMessage(
          message.encrypted_content,
          message.encryption_iv,
          message.keys_metadata as KeysMetadata,
          privateKeyJwk as RSAPrivateKeyJWK,
          !isMe, // isRecipient
        );

        console.log(
          `[E2EE Decrypt] Message ${message.id}: Decryption successful, content length=${decryptedContent.length}`,
        );
        setState({
          content: decryptedContent,
          mediaUri: null,
          isDecrypting: false,
          error: null,
          errorCode: undefined,
        });
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Unknown error');
        console.error(`[E2EE Decrypt] Message ${message.id}: Decryption failed:`, error);

        const isMe = message.user_id === currentUserId;
        const isMissingWrappedKey = error.message.includes('No wrapped key available for decryption');
        const metadata = message.keys_metadata as KeysMetadata;

        // Check if this is a stale key failure (message encrypted with old key)
        // This happens when: message was composed offline, recipient regenerated keys before sync
        const isStaleKeyFailure =
          error.name === 'OperationError' ||
          error.message.includes('OperationError') ||
          error.message.includes('decryption failed') ||
          error.message.includes('decrypt error') ||
          // react-native-quick-crypto specific error for RSA decryption failure
          error.message.includes('error in DoCipher');

        // Case 1: Missing wrapped key (pending_recipient)
        // - Partner sent message before recipient had keys
        // - keys_metadata has no recipient_wrapped_key
        const shouldAttemptPendingRepair =
          !isMe &&
          isMissingWrappedKey &&
          (!!metadata?.pending_recipient || !metadata?.recipient_wrapped_key);

        // Case 2: Stale key failure
        // - Message was encrypted with old public key
        // - Need admin to re-wrap with current key
        const shouldAttemptStaleKeyRepair =
          isStaleKeyFailure &&
          !isMissingWrappedKey &&
          !repairAttemptedByMessageId.current.has(message.id);

        if (shouldAttemptPendingRepair) {
          beginEncryptionRecovery('pending-recipient');
          try {
            setState({
              content: null,
              mediaUri: null,
              isDecrypting: true,
              error: null,
              errorCode: 'E2EE_PENDING_RECIPIENT_KEY',
            });

            if (!repairAttemptedByMessageId.current.has(message.id)) {
              repairAttemptedByMessageId.current.add(message.id);
              await reencryptPendingMessages();
            }

            // Fetch the latest keys_metadata and retry once locally.
            const { data: refreshed } = await supabase
              .from('messages')
              .select('encrypted_content, encryption_iv, keys_metadata, user_id')
              .eq('id', message.id)
              .maybeSingle();

            const refreshedMetadata = (refreshed?.keys_metadata ?? null) as KeysMetadata | null;
            const refreshedEncryptedContent = refreshed?.encrypted_content ?? null;
            const refreshedIv = refreshed?.encryption_iv ?? null;

            if (refreshedMetadata && refreshedEncryptedContent && refreshedIv) {
              try {
                const decryptedContent = await decryptTextMessage(
                  refreshedEncryptedContent,
                  refreshedIv,
                  refreshedMetadata,
                  privateKeyJwk as RSAPrivateKeyJWK,
                  true, // isRecipient
                );

                setState({
                  content: decryptedContent,
                  mediaUri: null,
                  isDecrypting: false,
                  error: null,
                  errorCode: undefined,
                });
                return;
              } catch {
                // Still pending (or repair failed); show the placeholder instead of a hard error.
              }
            }

            setState({
              content: null,
              mediaUri: null,
              isDecrypting: false,
              error: null,
              errorCode: 'E2EE_PENDING_RECIPIENT_KEY',
            });
            return;
          } finally {
            endEncryptionRecovery();
          }
        }

        if (shouldAttemptStaleKeyRepair) {
          beginEncryptionRecovery('stale-key');
          let didDecrypt = false;

          try {
            console.log(`[E2EE Decrypt] Message ${message.id}: Attempting stale key repair...`);
            setState({
              content: null,
              mediaUri: null,
              isDecrypting: true,
              error: null,
              errorCode: 'E2EE_REPAIRING_STALE_KEY',
            });

            repairAttemptedByMessageId.current.add(message.id);

            // CRITICAL: Ensure local keys are uploaded to database BEFORE repair.
            // The repair edge function uses the database public key to re-wrap.
            // If the database has a stale key, repair will "succeed" but decryption will fail.
            console.log(`[E2EE Decrypt] Message ${message.id}: Ensuring keys are synced before repair...`);
            const keysUploaded = await ensureKeysUploaded();
            console.log(`[E2EE Decrypt] Message ${message.id}: Keys sync result: ${keysUploaded}`);

            // Run auto key rotation to re-wrap recent messages BEFORE individual repair.
            // This ensures handle-key-rotation uses the correct database key.
            const autoRotationResult = await triggerAutoKeyRotation();
            if (autoRotationResult) {
              console.log(`[E2EE Decrypt] Message ${message.id}: Auto rotation completed: ${autoRotationResult.updated} messages updated`);
            }

            try {
              const repairResult = await repairStaleKey(message.id);

              if (repairResult.success) {
                console.log(`[E2EE Decrypt] Message ${message.id}: Stale key repaired, retrying decryption...`);

                // Fetch updated message and retry
                const { data: refreshed } = await supabase
                  .from('messages')
                  .select('encrypted_content, encryption_iv, keys_metadata, user_id')
                  .eq('id', message.id)
                  .maybeSingle();

                const refreshedMetadata = (refreshed?.keys_metadata ?? null) as KeysMetadata | null;
                const refreshedEncryptedContent = refreshed?.encrypted_content ?? null;
                const refreshedIv = refreshed?.encryption_iv ?? null;

                // Log key metadata for debugging
                console.log(`[E2EE Decrypt] Message ${message.id}: Refreshed metadata:`, {
                  hasSenderKey: !!refreshedMetadata?.sender_wrapped_key,
                  hasRecipientKey: !!refreshedMetadata?.recipient_wrapped_key,
                  adminKeyId: refreshedMetadata?.admin_key_id,
                  isRecipient: !isMe,
                });

                if (refreshedMetadata && refreshedEncryptedContent && refreshedIv) {
                  const decryptedContent = await decryptTextMessage(
                    refreshedEncryptedContent,
                    refreshedIv,
                    refreshedMetadata,
                    privateKeyJwk as RSAPrivateKeyJWK,
                    !isMe, // isRecipient
                  );

                  setState({
                    content: decryptedContent,
                    mediaUri: null,
                    isDecrypting: false,
                    error: null,
                    errorCode: undefined,
                  });
                  didDecrypt = true;
                  return;
                }
              } else {
                console.error(`[E2EE Decrypt] Message ${message.id}: Stale key repair failed:`, repairResult.error);
              }
            } catch (repairErr) {
              // Note: This catch includes decryption errors after successful repair
              console.error(`[E2EE Decrypt] Message ${message.id}: Decryption retry failed after repair:`, repairErr);
            }

            // Repair failed or retry failed
            setState({
              content: null,
              mediaUri: null,
              isDecrypting: false,
              error: new Error('Waiting for message...'),
              errorCode: 'E2EE_DECRYPT_FAILED',
            });
            return;
          } finally {
            if (!didDecrypt) {
              // Schedule another retry after a delay - keys may sync in the background
              retry();
            }
            endEncryptionRecovery();
          }
        }

        setState({
          content: null,
          mediaUri: null,
          isDecrypting: false,
          error: new Error('Waiting for message...'),
          errorCode: 'E2EE_DECRYPT_FAILED',
        });
      }
    }
  }, [
    message.id,
    message.version,
    message.content,
    message.encrypted_content,
    message.encryption_iv,
    message.keys_metadata,
    message.user_id,
    currentUserId,
    privateKeyJwk,
    hasKeys,
    keysLoading,
    retryNonce,
    beginEncryptionRecovery,
    endEncryptionRecovery,
    retry,
    ensureKeysUploaded,
  ]);

  useEffect(() => {
    decrypt();
  }, [decrypt, retryNonce]);

  useEffect(() => {
    return () => {
      if (autoRetryTimerRef.current) {
        clearTimeout(autoRetryTimerRef.current);
        autoRetryTimerRef.current = null;
      }
    };
  }, [message.id]);

  useEffect(() => {
    if (!state.errorCode) {
      autoRetryCountsByMessageId.delete(message.id);
      if (autoRetryTimerRef.current) {
        clearTimeout(autoRetryTimerRef.current);
        autoRetryTimerRef.current = null;
      }
      return;
    }

    const shouldRetry =
      state.errorCode === 'E2EE_PENDING_RECIPIENT_KEY' ||
      state.errorCode === 'E2EE_KEYS_UNAVAILABLE';

    if (!shouldRetry) {
      return;
    }

    const attempts = autoRetryCountsByMessageId.get(message.id) ?? 0;
    if (attempts >= MAX_AUTO_RETRIES) {
      return;
    }

    const nextAttempt = attempts + 1;
    const delayMs = AUTO_RETRY_BASE_DELAY_MS * nextAttempt;

    autoRetryCountsByMessageId.set(message.id, nextAttempt);

    autoRetryTimerRef.current = setTimeout(() => {
      retry();
    }, delayMs);

    return () => {
      if (autoRetryTimerRef.current) {
        clearTimeout(autoRetryTimerRef.current);
        autoRetryTimerRef.current = null;
      }
    };
  }, [message.id, state.errorCode, retry]);

  return { ...state, retry };
}
