/**
 * useEncryptedSend Hook
 *
 * Hook for sending encrypted messages via E2EE.
 * Handles encryption with triple-wrapped keys (sender, recipient, admin).
 *
 * IMPORTANT: This hook reads keys from the global Zustand store to ensure
 * consistency with all other encryption operations.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import {
  encryptTextMessage,
  decryptTextMessage,
  getAdminPublicKey,
  getAdminKeyId,
  isValidPublicKeyJwk,
  sanitizePublicKeyJwk,
  verifyKeyPair,
} from '../lib/encryption';
import type { RSAPublicKeyJWK, EncryptedMessagePayload } from '../lib/encryption';
import { useEncryptionKeys } from './useEncryptionKeys';
import { useAuthStore } from '../store';
import { captureError } from '../lib/sentry';

interface UseEncryptedSendReturn {
  /** Encrypt a text message for sending */
  encryptMessage: (plaintext: string) => Promise<EncryptedMessagePayload>;
  /** Whether E2EE is available (keys loaded, not on web) */
  isE2EEAvailable: boolean;
  /** Whether the admin key is available and valid */
  isAdminKeyReady: boolean;
  /** Whether encryption is currently in progress */
  isEncrypting: boolean;
  /** Last encryption error, if any */
  error: Error | null;
}

/**
 * Hook for encrypting messages before sending
 *
 * Throws if E2EE is not available or keys are not ready.
 */
export function useEncryptedSend(): UseEncryptedSendReturn {
  const [isEncrypting, setIsEncrypting] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [isAdminKeyReady, setIsAdminKeyReady] = useState(false);

  // Track the version of keys we have verified to handle key rotation/regeneration
  const verifiedKeysVersionRef = useRef<number | null>(null);
  const partnerRefreshRef = useRef(0);
  const adminKeyRetryRef = useRef(0);
  const PARTNER_REFRESH_TTL_MS = 2 * 60 * 1000;
  const ADMIN_KEY_RETRY_DELAYS = [500, 1000, 2000, 4000]; // Exponential backoff delays in ms

  const { publicKeyJwk, privateKeyJwk, hasKeys, isLoading } = useEncryptionKeys();
  const refreshPartner = useAuthStore((s) => s.refreshPartner);
  const user = useAuthStore((s) => s.user);

  // E2EE is available if:
  // - Not on web platform
  // - Keys are loaded and available
  const isE2EEAvailable =
    Platform.OS !== 'web' && hasKeys && !isLoading && !!publicKeyJwk && !!privateKeyJwk;

  useEffect(() => {
    let isMounted = true;
    let retryTimeoutId: ReturnType<typeof setTimeout> | null = null;

    const checkAdminKey = async (retryCount = 0) => {
      if (!isE2EEAvailable) {
        if (isMounted) {
          setIsAdminKeyReady(false);
        }
        return;
      }

      try {
        const adminPublicKey = await getAdminPublicKey();
        const adminKeyId = await getAdminKeyId();

        if (!adminKeyId || !isValidPublicKeyJwk(adminPublicKey)) {
          throw new Error('Admin public key is invalid');
        }

        if (isMounted) {
          setIsAdminKeyReady(true);
          adminKeyRetryRef.current = 0; // Reset retry count on success
        }
      } catch (adminKeyError) {
        console.warn(`[E2EE Send] Admin key not ready (attempt ${retryCount + 1}):`, adminKeyError);
        if (isMounted) {
          setIsAdminKeyReady(false);
          
          // Retry with exponential backoff if we haven't exhausted retries
          if (retryCount < ADMIN_KEY_RETRY_DELAYS.length) {
            const delay = ADMIN_KEY_RETRY_DELAYS[retryCount];
            console.log(`[E2EE Send] Retrying admin key fetch in ${delay}ms...`);
            retryTimeoutId = setTimeout(() => {
              if (isMounted) {
                checkAdminKey(retryCount + 1);
              }
            }, delay);
          } else {
            console.warn('[E2EE Send] Admin key fetch failed after all retries');
          }
        }
      }
    };

    checkAdminKey();

    return () => {
      isMounted = false;
      if (retryTimeoutId) {
        clearTimeout(retryTimeoutId);
      }
    };
  }, [isE2EEAvailable]);

  const encryptMessage = useCallback(
    async (plaintext: string): Promise<EncryptedMessagePayload> => {
      // Block sending until E2EE is ready
      if (!isE2EEAvailable) {
        const readyError = new Error('Message security not ready. Please check your connection.');
        console.warn('[E2EE Send] E2EE not available');
        setError(readyError);
        throw readyError;
      }

      // CRITICAL: Read keys directly from the global store at encryption time
      // This ensures we always use the most current keys, not potentially stale hook state
      const currentKeys = useAuthStore.getState().encryptionKeys;

      if (!currentKeys.hasKeys || !currentKeys.publicKeyJwk || !currentKeys.privateKeyJwk) {
        // User-friendly error
        const keysError = new Error('Message security not ready. Please check your connection.');
        console.warn('[E2EE Send] Keys not fully available in global store');
        setError(keysError);
        throw keysError;
      }

      const senderPublicKey = currentKeys.publicKeyJwk;
      const senderPrivateKey = currentKeys.privateKeyJwk;

      // SAFETY CHECK: Verify the key pair works together before encrypting
      // This prevents creating unrecoverable messages if keys are mismatched.
      // We check if the current keys version matches what we last verified.
      if (verifiedKeysVersionRef.current !== currentKeys.keysVersion) {
        console.log(
          `[E2EE Send] Verifying sender key pair (version ${currentKeys.keysVersion})...`
        );
        const isValidKeyPair = await verifyKeyPair(
          senderPublicKey as RSAPublicKeyJWK,
          senderPrivateKey
        );

        if (!isValidKeyPair) {
          // User-friendly error
          const keyError = new Error('Security check failed. Please restart the app.');
          console.error('[E2EE Send] CRITICAL: Sender key pair verification failed!');
          setError(keyError);
          throw keyError;
        }

        verifiedKeysVersionRef.current = currentKeys.keysVersion;
        console.log('[E2EE Send] Sender key pair verified successfully');
      }

      console.log(
        '[E2EE Send] Using sender public key from global store, version:',
        currentKeys.keysVersion
      );

      setIsEncrypting(true);
      setError(null);

      try {
        // Refresh partner's profile only when key is missing/invalid or TTL expires
        const resolvePartnerProfile = async () => {
          const cachedPartner = useAuthStore.getState().partner;
          const cachedKey = cachedPartner?.public_key_jwk as RSAPublicKeyJWK | null | undefined;
          const hasValidKey = cachedKey ? isValidPublicKeyJwk(cachedKey) : false;
          const now = Date.now();
          const shouldRefresh = !hasValidKey || (now - partnerRefreshRef.current) > PARTNER_REFRESH_TTL_MS;

          if (!shouldRefresh) {
            return cachedPartner;
          }

          console.log('[E2EE Send] Refreshing partner profile to get latest public key...');
          try {
            const freshPartner = await refreshPartner();
            partnerRefreshRef.current = Date.now();
            return freshPartner ?? useAuthStore.getState().partner;
          } catch (refreshError) {
            console.warn('[E2EE Send] Partner refresh failed, using cached key:', refreshError);
            partnerRefreshRef.current = Date.now();
            return cachedPartner;
          }
        };

        const freshPartner = await resolvePartnerProfile();

        // Get admin key for moderation access
        // SAFETY: Validate the admin key before using it
        let adminPublicKey: RSAPublicKeyJWK;
        let adminKeyId: string;

        try {
          adminPublicKey = await getAdminPublicKey();
          adminKeyId = await getAdminKeyId();

          // Validate admin key structure
          if (!isValidPublicKeyJwk(adminPublicKey)) {
            const adminError = new Error('Connection issue. Please try again.');
            console.error('[E2EE Send] Admin public key is invalid');
            setIsEncrypting(false);
            setError(adminError);
            throw adminError;
          }
        } catch (adminKeyError) {
          // Re-throw if already a user-facing error
          if (adminKeyError instanceof Error && (
            adminKeyError.message.includes('Connection issue') ||
            adminKeyError.message.includes('Unable to secure')
          )) {
            throw adminKeyError;
          }
          const fetchError = new Error('Connection issue. Please try again.');
          console.error('[E2EE Send] Failed to fetch admin key:', adminKeyError);
          setIsEncrypting(false);
          setError(fetchError);
          throw fetchError;
        }

        // Get partner's public key from the freshly fetched profile
        let partnerPublicKey = freshPartner?.public_key_jwk as
          | RSAPublicKeyJWK
          | null
          | undefined;

        // Validate and sanitize partner's public key
        if (partnerPublicKey) {
          if (!isValidPublicKeyJwk(partnerPublicKey)) {
            console.warn('[E2EE Send] Partner public key is invalid, treating as unavailable');
            partnerPublicKey = null;
          } else {
            // Sanitize to remove trailing dots from base64 fields (react-native-quick-crypto bug)
            partnerPublicKey = sanitizePublicKeyJwk(partnerPublicKey);
          }
        }

        console.log('[E2EE Send] Partner public key available:', !!partnerPublicKey);

        let lastPayload: EncryptedMessagePayload | null = null;

        const encryptAndVerify = async (): Promise<EncryptedMessagePayload> => {
          const payload = await encryptTextMessage(
            plaintext,
            senderPublicKey as RSAPublicKeyJWK,
            partnerPublicKey ?? null,
            adminPublicKey,
            adminKeyId
          );

          lastPayload = payload;

          const decrypted = await decryptTextMessage(
            payload.encrypted_content,
            payload.encryption_iv,
            payload.keys_metadata,
            senderPrivateKey,
            false
          );

          if (decrypted !== plaintext) {
            throw new Error('E2EE payload verification mismatch');
          }

          return payload;
        };

        const maxAttempts = 2;
        let encryptedPayload: EncryptedMessagePayload | null = null;

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
          try {
            encryptedPayload = await encryptAndVerify();
            break;
          } catch (verifyError) {
            console.warn(`[E2EE Send] Payload verification failed (attempt ${attempt})`, verifyError);

            if (attempt === maxAttempts) {
              const errorInstance =
                verifyError instanceof Error
                  ? verifyError
                  : new Error('E2EE payload verification failed');

              const lastPayloadData = lastPayload as EncryptedMessagePayload | null;

              captureError(errorInstance, {
                stage: 'encrypt_verify',
                attempt,
                max_attempts: maxAttempts,
                plaintext_length: plaintext.length,
                encrypted_content_length: lastPayloadData?.encrypted_content.length ?? null,
                encryption_iv_length: lastPayloadData?.encryption_iv.length ?? null,
                admin_key_id: lastPayloadData?.keys_metadata?.admin_key_id ?? null,
                pending_recipient: lastPayloadData?.keys_metadata?.pending_recipient ?? null,
                has_partner_key: !!partnerPublicKey,
                keys_version: currentKeys.keysVersion,
                platform: Platform.OS,
                user_id: user?.id ?? null,
              });

              throw new Error('Security check failed. Please try again.');
            }
          }
        }

        if (!encryptedPayload) {
          throw new Error('Security check failed. Please try again.');
        }

        console.log('[E2EE Send] Message encrypted successfully');

        setIsEncrypting(false);
        return encryptedPayload;
      } catch (err) {
        console.error('[E2EE Send] Failed to encrypt message:', err);
        setError(err as Error);
        setIsEncrypting(false);
        // Re-throw to block sending - never fall back to plaintext
        throw err;
      }
    },
    [isE2EEAvailable, refreshPartner]
  );

  return {
    encryptMessage,
    isE2EEAvailable,
    isAdminKeyReady,
    isEncrypting,
    error,
  };
}
