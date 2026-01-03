/**
 * EncryptionKeyInitializer Component
 *
 * Handles automatic initialization and upload of E2EE encryption keys.
 * Should be placed in the app layout to run after authentication.
 *
 * Uses global Zustand store for key state to ensure all components
 * see the same keys at all times.
 */

import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { useEncryptionKeys } from '../hooks';
import { useAuthStore } from '../store';
import { reencryptPendingMessages } from '../lib/encryption/reencryptPendingMessages';
import { triggerKeyRotation } from '../lib/encryption';
import { LoadingOverlay } from './ui/LoadingOverlay';
import { colors } from '../theme';

/**
 * Check if crypto is available (react-native-quick-crypto polyfill installed)
 */
function isCryptoAvailable(): boolean {
  return typeof crypto !== 'undefined' && crypto.subtle !== undefined;
}

/**
 * Component that initializes encryption keys after user authentication.
 *
 * Flow:
 * 1. When user signs in, check if they have encryption keys
 * 2. If not, generate new RSA key pair
 * 3. Upload public key to Supabase profile
 * 4. If user has a partner without keys, trigger re-encryption when partner generates keys
 */
export function EncryptionKeyInitializer(): JSX.Element | null {
  const { initializeAndUploadKeys, isLoading: keysLoading, hasKeys, error } = useEncryptionKeys();
  const user = useAuthStore((s) => s.user);
  const couple = useAuthStore((s) => s.couple);

  // Track if keys were regenerated this session (new device, reinstall, etc.)
  const [wasRegenerated, setWasRegenerated] = useState(false);
  const hasTriggeredRotation = useRef(false);
  const hasLoggedCryptoWarning = useRef(false);
  const isInitializing = useRef(false);
  const hasInitialized = useRef(false);

  // Show loading overlay when we are initializing keys (generating new ones takes time)
  // or when rotation is in progress
  const [showLoading, setShowLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState('Connecting...');

  // Effect 1: Initialize encryption keys when user is authenticated
  useEffect(() => {
    // Skip on web - E2EE not supported
    if (Platform.OS === 'web') return;

    // Check if crypto is available (native modules rebuilt)
    if (!isCryptoAvailable()) {
      if (!hasLoggedCryptoWarning.current) {
        console.warn('[E2EE Init] Crypto not available. Run: npx expo prebuild --clean');
        hasLoggedCryptoWarning.current = true;
      }
      return;
    }

    // Skip if no user, already initialized, or currently initializing
    if (!user?.id || hasInitialized.current || isInitializing.current) return;

    // Wait for initial key loading to complete
    if (keysLoading) return;

    // Skip if keys already exist in global state
    if (hasKeys) {
      console.log('[E2EE Init] Keys already loaded in global state');
      hasInitialized.current = true;
      return;
    }

    // Skip if there was an error loading keys (avoid retry loop)
    if (error) {
      console.warn('[E2EE Init] Skipping key initialization due to previous error:', error.message);
      return;
    }

    const initKeys = async () => {
      try {
        // Mark as initializing to prevent re-entry
        isInitializing.current = true;
        // Only show loading if we are generating keys (which might take a second)
        // Standard loading is fast enough to not need a full screen blocker
        
        console.log('[E2EE Init] Starting key initialization...');

        // Initialize keys and upload in one operation
        const result = await initializeAndUploadKeys();

        console.log('[E2EE Init] Encryption keys initialized and uploaded');

        // Track if keys were regenerated (for rotation decision)
        if (result.wasRegenerated) {
          console.log('[E2EE Init] Keys were regenerated this session');
          setWasRegenerated(true);
        }

        hasInitialized.current = true;
      } catch (err) {
        console.error('[E2EE Init] Failed to initialize encryption keys:', err);
        // Reset initialization flag so we can retry on next render
        // But only if it's a transient error, not a crypto unavailable error
        if (err instanceof Error && !err.message.includes('Crypto')) {
          isInitializing.current = false;
        }
        setShowLoading(false);
      }
    };

    initKeys();
  }, [user?.id, keysLoading, hasKeys, error, initializeAndUploadKeys]);

  // Effect 2: Trigger key rotation when keys were regenerated and couple is available
  useEffect(() => {
    // Skip on web or if crypto not available
    if (Platform.OS === 'web' || !isCryptoAvailable()) return;

    // Need user and couple to trigger rotation
    if (!user?.id || !couple?.id) return;

    // Only trigger once per session
    if (hasTriggeredRotation.current) return;

    // Wait for keys to be initialized in global state
    if (!hasKeys) return;

    // Only trigger rotation if keys were actually regenerated this session
    // (new device, app reinstall, key corruption recovery, etc.)
    if (!wasRegenerated) {
      // If we're done initializing but not rotating, hide loading
      if (showLoading) {
        setShowLoading(false);
        isInitializing.current = false;
      }
      console.log('[E2EE Init] Keys unchanged, skipping rotation');
      return;
    }

    const runRotation = async () => {
      try {
        hasTriggeredRotation.current = true;
        // Only show loading for rotation which is a heavier operation
        setShowLoading(true);
        setLoadingStatus('Updating security...');

        // Trigger key rotation - re-wraps message keys for the new public key
        console.log('[E2EE Init] Keys were regenerated, triggering key rotation...');
        await triggerKeyRotation();

        // Trigger re-encryption of pending messages (for messages where
        // recipient had no key at send time)
        await reencryptPendingMessages({ force: true });

        console.log('[E2EE Init] Key rotation complete');
      } catch (err) {
        console.error('[E2EE Init] Failed to run key rotation:', err);
        // Reset so we can retry
        hasTriggeredRotation.current = false;
      } finally {
        setShowLoading(false);
        isInitializing.current = false;
      }
    };

    runRotation();
  }, [user?.id, couple?.id, hasKeys, wasRegenerated, showLoading]);

  // Reset initialization flags when user changes (sign out/sign in)
  useEffect(() => {
    if (!user?.id) {
      hasInitialized.current = false;
      setWasRegenerated(false);
      isInitializing.current = false;
      hasTriggeredRotation.current = false;
      setShowLoading(false);
    }
  }, [user?.id]);

  return (
    <LoadingOverlay
      visible={showLoading}
      statusText={loadingStatus}
      detailText="This helps keep your conversations private."
      fullScreen={true}
      spinnerColor={colors.primary}
    />
  );
}
