/**
 * useEncryptionKeys Hook
 *
 * React hook for managing E2EE encryption keys.
 * Uses global Zustand store to ensure all components share the same key state.
 *
 * IMPORTANT: This hook reads from and writes to the global authStore.encryptionKeys
 * to prevent race conditions where different hook instances have different state.
 */

import { useCallback, useRef, useEffect } from 'react';
import { Platform } from 'react-native';
import {
  generateAndStoreKeyPair,
  getPrivateKey,
  getLocalPublicKey,
  hasKeyPair,
  isPublicKeyUploaded,
  markPublicKeyUploaded,
  isValidPublicKeyJwk,
  sanitizePublicKeyJwk,
} from '../lib/encryption';
import type { RSAPublicKeyJWK } from '../lib/encryption';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store';

interface UseEncryptionKeysReturn {
  /** RSA private key in JWK format */
  privateKeyJwk: RSAPublicKeyJWK | null;
  /** RSA public key in JWK format */
  publicKeyJwk: RSAPublicKeyJWK | null;
  /** Whether keys are currently being loaded */
  isLoading: boolean;
  /** Whether valid keys exist */
  hasKeys: boolean;
  /** Any error that occurred */
  error: Error | null;
  /** Initialize keys and upload to Supabase - does everything in one call */
  initializeAndUploadKeys: () => Promise<{ wasRegenerated: boolean }>;
  /** Refresh the key state from storage */
  refresh: () => Promise<void>;
}

/**
 * Hook for accessing and managing encryption keys.
 *
 * All key state is stored in the global Zustand store to ensure
 * all components see the same keys at all times.
 */
export function useEncryptionKeys(): UseEncryptionKeysReturn {
  // Get global state and actions from Zustand store
  const encryptionKeys = useAuthStore((s) => s.encryptionKeys);
  const setEncryptionKeys = useAuthStore((s) => s.setEncryptionKeys);
  const user = useAuthStore((s) => s.user);

  // Track if we've already loaded keys in this session
  const hasLoadedRef = useRef(false);
  const isLoadingRef = useRef(false);

  /**
   * Load existing keys from SecureStore into global state
   */
  const loadKeys = useCallback(async () => {
    // E2EE not supported on web
    if (Platform.OS === 'web') {
      setEncryptionKeys({
        privateKeyJwk: null,
        publicKeyJwk: null,
        isLoadingKeys: false,
        hasKeys: false,
        keysError: null,
      });
      return null;
    }

    // Prevent concurrent loads
    if (isLoadingRef.current) {
      return encryptionKeys.publicKeyJwk;
    }

    try {
      isLoadingRef.current = true;
      setEncryptionKeys({ isLoadingKeys: true, keysError: null });

      const keysExist = await hasKeyPair();
      if (keysExist) {
        const [privateKey, publicKey] = await Promise.all([
          getPrivateKey(),
          getLocalPublicKey(),
        ]);

        console.log('[E2EE Global] Keys loaded from storage');

        setEncryptionKeys({
          privateKeyJwk: privateKey,
          publicKeyJwk: publicKey,
          isLoadingKeys: false,
          hasKeys: true,
          keysError: null,
        });

        hasLoadedRef.current = true;
        return publicKey;
      } else {
        console.log('[E2EE Global] No keys in storage');
        setEncryptionKeys({
          privateKeyJwk: null,
          publicKeyJwk: null,
          isLoadingKeys: false,
          hasKeys: false,
          keysError: null,
        });
        return null;
      }
    } catch (error) {
      console.error('[E2EE Global] Failed to load encryption keys:', error);
      setEncryptionKeys({
        privateKeyJwk: null,
        publicKeyJwk: null,
        isLoadingKeys: false,
        hasKeys: false,
        keysError: error as Error,
      });
      return null;
    } finally {
      isLoadingRef.current = false;
    }
  }, [encryptionKeys.publicKeyJwk, setEncryptionKeys]);

  /**
   * Initialize encryption keys and upload to Supabase in one operation.
   * This avoids race conditions between state updates and upload.
   *
   * @returns { wasRegenerated: boolean } - true if keys were newly generated or regenerated
   */
  const initializeAndUploadKeys = useCallback(async (): Promise<{
    wasRegenerated: boolean;
  }> => {
    if (Platform.OS === 'web') {
      console.warn('[E2EE Global] E2EE not supported on web');
      return { wasRegenerated: false };
    }

    if (!user?.id) {
      console.warn('[E2EE Global] Cannot initialize keys: user not authenticated');
      return { wasRegenerated: false };
    }

    // Prevent concurrent initialization
    if (isLoadingRef.current) {
      console.log('[E2EE Global] Key initialization already in progress');
      return { wasRegenerated: false };
    }

    try {
      isLoadingRef.current = true;
      setEncryptionKeys({ isLoadingKeys: true, keysError: null });

      let publicKey: RSAPublicKeyJWK | null = null;
      let privateKey = null;
      let wasRegenerated = false;

      const keysExist = await hasKeyPair();

      if (!keysExist) {
        // Generate new key pair
        console.log('[E2EE Global] Generating new key pair...');
        publicKey = await generateAndStoreKeyPair();
        privateKey = await getPrivateKey();
        wasRegenerated = true;

        // Update global state IMMEDIATELY with new keys
        setEncryptionKeys({
          privateKeyJwk: privateKey,
          publicKeyJwk: publicKey,
          isLoadingKeys: false,
          hasKeys: true,
          keysError: null,
        });

        console.log('[E2EE Global] Key pair generated and stored in global state');
      } else {
        // Load existing keys
        [privateKey, publicKey] = await Promise.all([
          getPrivateKey(),
          getLocalPublicKey(),
        ]);

        // Update global state with loaded keys
        setEncryptionKeys({
          privateKeyJwk: privateKey,
          publicKeyJwk: publicKey,
          isLoadingKeys: false,
          hasKeys: true,
          keysError: null,
        });
      }

      // Validate keys
      if (!publicKey || !isValidPublicKeyJwk(publicKey)) {
        if (publicKey) {
          console.warn(
            '[E2EE Global] Local public key invalid, regenerating...'
          );
        } else {
          console.warn(
            '[E2EE Global] Local public key missing, regenerating...'
          );
        }

        publicKey = await generateAndStoreKeyPair();
        privateKey = await getPrivateKey();
        wasRegenerated = true;

        // Update global state IMMEDIATELY with regenerated keys
        setEncryptionKeys({
          privateKeyJwk: privateKey,
          publicKeyJwk: publicKey,
          isLoadingKeys: false,
          hasKeys: true,
          keysError: null,
        });

        console.log('[E2EE Global] Keys regenerated and stored in global state');
      }

      // Fetch the server copy to verify validity and avoid stale uploads
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('public_key_jwk')
        .eq('id', user.id)
        .maybeSingle();

      if (profileError) {
        throw profileError;
      }

      const remoteKey = (profile?.public_key_jwk ?? null) as RSAPublicKeyJWK | null;
      const remoteValid = isValidPublicKeyJwk(remoteKey);
      const localValid = isValidPublicKeyJwk(publicKey);

      // Sanitize both keys before comparing (local key may have trailing dots)
      const sanitizedLocal = sanitizePublicKeyJwk(publicKey!);
      const sanitizedRemote = remoteKey ? sanitizePublicKeyJwk(remoteKey) : null;
      const sameKey =
        remoteValid &&
        localValid &&
        sanitizedRemote?.n === sanitizedLocal.n &&
        sanitizedRemote?.e === sanitizedLocal.e;

      // Upload if remote key is missing/invalid or doesn't match local.
      // If we just regenerated the key, we MUST upload it regardless
      if ((publicKey && localValid && !sameKey) || (publicKey && wasRegenerated)) {
        console.log('[E2EE Global] Uploading public key to profile...');

        // Sanitize key before upload
        const sanitizedKey = sanitizePublicKeyJwk(publicKey);

        const { error } = await supabase
          .from('profiles')
          .update({
            public_key_jwk: sanitizedKey as unknown as Record<string, unknown>,
          })
          .eq('id', user.id);

        if (error) {
          throw error;
        }

        await markPublicKeyUploaded();
        console.log('[E2EE Global] Public key uploaded successfully');
      } else if (sameKey) {
        const alreadyUploaded = await isPublicKeyUploaded();
        if (!alreadyUploaded) {
          await markPublicKeyUploaded();
        }
        console.log('[E2EE Global] Public key already uploaded and valid');
      }

      hasLoadedRef.current = true;
      return { wasRegenerated };
    } catch (error) {
      console.error('[E2EE Global] Failed to initialize encryption keys:', error);
      setEncryptionKeys({
        isLoadingKeys: false,
        keysError: error as Error,
      });
      throw error;
    } finally {
      isLoadingRef.current = false;
    }
  }, [user?.id, setEncryptionKeys]);

  /**
   * Refresh keys from storage
   */
  const refresh = useCallback(async () => {
    hasLoadedRef.current = false;
    await loadKeys();
  }, [loadKeys]);

  // Load keys on mount if not already loaded
  useEffect(() => {
    if (!hasLoadedRef.current && !isLoadingRef.current && !encryptionKeys.hasKeys) {
      loadKeys();
    }
  }, [loadKeys, encryptionKeys.hasKeys]);

  // Reset loaded flag when user changes
  useEffect(() => {
    if (!user?.id) {
      hasLoadedRef.current = false;
    }
  }, [user?.id]);

  return {
    privateKeyJwk: encryptionKeys.privateKeyJwk,
    publicKeyJwk: encryptionKeys.publicKeyJwk,
    isLoading: encryptionKeys.isLoadingKeys,
    hasKeys: encryptionKeys.hasKeys,
    error: encryptionKeys.keysError,
    initializeAndUploadKeys,
    refresh,
  };
}
