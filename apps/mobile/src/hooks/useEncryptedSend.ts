/**
 * useEncryptedSend Hook
 *
 * Hook for sending encrypted messages via E2EE.
 * Handles encryption with triple-wrapped keys (sender, recipient, admin).
 *
 * IMPORTANT: This hook reads keys from the global Zustand store to ensure
 * consistency with all other encryption operations.
 */

import { useCallback, useState, useRef } from 'react';
import { Platform } from 'react-native';
import {
  encryptTextMessage,
  getAdminPublicKey,
  getAdminKeyId,
  isValidPublicKeyJwk,
  sanitizePublicKeyJwk,
  verifyKeyPair,
} from '../lib/encryption';
import type { RSAPublicKeyJWK, EncryptedMessagePayload } from '../lib/encryption';
import { useEncryptionKeys } from './useEncryptionKeys';
import { useAuthStore } from '../store';

interface UseEncryptedSendReturn {
  /** Encrypt a text message for sending */
  encryptMessage: (plaintext: string) => Promise<EncryptedMessagePayload | null>;
  /** Whether E2EE is available (keys loaded, not on web) */
  isE2EEAvailable: boolean;
  /** Whether encryption is currently in progress */
  isEncrypting: boolean;
  /** Last encryption error, if any */
  error: Error | null;
}

/**
 * Hook for encrypting messages before sending
 *
 * Returns null if E2EE is not available (web platform, no keys).
 * In that case, the caller should send plaintext (v1) messages.
 */
export function useEncryptedSend(): UseEncryptedSendReturn {
  const [isEncrypting, setIsEncrypting] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Track whether we've verified the key pair this session
  const keyPairVerifiedRef = useRef(false);

  const { publicKeyJwk, hasKeys, isLoading } = useEncryptionKeys();
  const refreshPartner = useAuthStore((s) => s.refreshPartner);

  // E2EE is available if:
  // - Not on web platform
  // - Keys are loaded and available
  const isE2EEAvailable =
    Platform.OS !== 'web' && hasKeys && !isLoading && !!publicKeyJwk;

  const encryptMessage = useCallback(
    async (plaintext: string): Promise<EncryptedMessagePayload | null> => {
      // Return null if E2EE not available - caller will send plaintext
      if (!isE2EEAvailable) {
        console.log('[E2EE Send] E2EE not available, will send plaintext');
        return null;
      }

      // CRITICAL: Read keys directly from the global store at encryption time
      // This ensures we always use the most current keys, not potentially stale hook state
      const currentKeys = useAuthStore.getState().encryptionKeys;

      if (!currentKeys.hasKeys || !currentKeys.publicKeyJwk || !currentKeys.privateKeyJwk) {
        const keysError = new Error('Encryption keys not ready. Please wait a moment and try again.');
        console.warn('[E2EE Send] Keys not fully available in global store');
        setError(keysError);
        throw keysError;
      }

      const senderPublicKey = currentKeys.publicKeyJwk;
      const senderPrivateKey = currentKeys.privateKeyJwk;

      // SAFETY CHECK: Verify the key pair works together before encrypting
      // This prevents creating unrecoverable messages if keys are mismatched
      if (!keyPairVerifiedRef.current) {
        console.log('[E2EE Send] Verifying sender key pair...');
        const isValidKeyPair = await verifyKeyPair(
          senderPublicKey as RSAPublicKeyJWK,
          senderPrivateKey
        );

        if (!isValidKeyPair) {
          const keyError = new Error('Encryption key verification failed. Please restart the app and try again.');
          console.error('[E2EE Send] CRITICAL: Sender key pair verification failed!');
          setError(keyError);
          throw keyError;
        }

        keyPairVerifiedRef.current = true;
        console.log('[E2EE Send] Sender key pair verified successfully');
      }

      console.log(
        '[E2EE Send] Using sender public key from global store, version:',
        currentKeys.keysVersion
      );

      setIsEncrypting(true);
      setError(null);

      try {
        // Always refresh partner's profile to get their latest public key
        // This ensures we don't miss their key if they just generated it
        console.log('[E2EE Send] Refreshing partner profile to get latest public key...');
        const freshPartner = await refreshPartner();

        // Get admin key for moderation access
        // SAFETY: Validate the admin key before using it
        let adminPublicKey: RSAPublicKeyJWK;
        let adminKeyId: string;

        try {
          adminPublicKey = await getAdminPublicKey();
          adminKeyId = await getAdminKeyId();

          // Validate admin key structure
          if (!isValidPublicKeyJwk(adminPublicKey)) {
            const adminError = new Error('Unable to secure message. Please check your connection and try again.');
            console.error('[E2EE Send] Admin public key is invalid');
            setIsEncrypting(false);
            setError(adminError);
            throw adminError;
          }
        } catch (adminKeyError) {
          // Re-throw if already a user-facing error
          if (adminKeyError instanceof Error && adminKeyError.message.includes('Unable to secure')) {
            throw adminKeyError;
          }
          const fetchError = new Error('Unable to secure message. Please check your connection and try again.');
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

        // Encrypt the message using the key from global store
        const encryptedPayload = await encryptTextMessage(
          plaintext,
          senderPublicKey as RSAPublicKeyJWK,
          partnerPublicKey ?? null,
          adminPublicKey,
          adminKeyId
        );

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
    isEncrypting,
    error,
  };
}
