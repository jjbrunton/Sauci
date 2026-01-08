/**
 * Trigger Key Rotation (Server Assisted)
 *
 * Calls the Supabase Edge Function `handle-key-rotation` to re-wrap
 * all message AES keys with the user's current public key.
 *
 * This is needed when a user regenerates their keys (new device, app reinstall).
 * The admin key is used to unwrap the message keys and re-wrap them for
 * the user's new public key.
 */

import { supabase } from '../supabase';
import { reencryptPendingMessages } from './reencryptPendingMessages';


export interface KeyRotationResult {
  success: boolean;
  updated: number;
  reason?: string;
  error?: string;
}

let inFlight: Promise<KeyRotationResult | null> | null = null;
let autoRotationInFlight: Promise<KeyRotationResult | null> | null = null;
let lastAutoRotationAt = 0;

const AUTO_ROTATION_MIN_INTERVAL_MS = 60_000;


export async function triggerKeyRotation(): Promise<KeyRotationResult | null> {
  // Prevent concurrent calls
  if (inFlight) return inFlight;

  inFlight = (async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        return null;
      }

      const baseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
      if (!baseUrl) {
        return { success: false, updated: 0, error: 'Missing EXPO_PUBLIC_SUPABASE_URL' };
      }

      console.log('[E2EE] Triggering key rotation for regenerated keys...');

      const response = await fetch(`${baseUrl}/functions/v1/handle-key-rotation`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        const text = await response.text();
        console.error('[E2EE] Key rotation failed:', text);
        return { success: false, updated: 0, error: text || 'Failed to rotate keys' };
      }

      const result = (await response.json()) as KeyRotationResult;
      console.log(`[E2EE] Key rotation complete: ${result.updated} messages updated`);
      return result;
    } catch (err) {
      console.error('[E2EE] Key rotation error:', err);
      return {
        success: false,
        updated: 0,
        error: err instanceof Error ? err.message : 'Unknown error',
      };
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
}

export function triggerAutoKeyRotation(): Promise<KeyRotationResult | null> | null {
  const now = Date.now();

  if (autoRotationInFlight) return autoRotationInFlight;
  if (now - lastAutoRotationAt < AUTO_ROTATION_MIN_INTERVAL_MS) {
    return null;
  }

  lastAutoRotationAt = now;

  autoRotationInFlight = (async () => {
    console.log('[E2EE] Auto key rotation triggered by decryption failure.');
    const result = await triggerKeyRotation();
    await reencryptPendingMessages({ force: true });
    return result;
  })().finally(() => {
    autoRotationInFlight = null;
  });

  return autoRotationInFlight;
}

