/**
 * Pending Message Re-encryption (Server Assisted)
 *
 * Triggers the Supabase Edge Function `reencrypt-pending-messages` to re-wrap
 * AES keys for messages that were sent before the current user had E2EE keys.
 *
 * This does NOT decrypt message content on the server. It only re-wraps the
 * per-message AES key using the user's public key (admin recovery model).
 */

import { supabase } from '../supabase';

export interface ReencryptPendingMessagesResult {
  success: boolean;
  updated: number;
  reason?: string;
  error?: string;
}

let inFlight: Promise<ReencryptPendingMessagesResult | null> | null = null;
let lastRunAtMs = 0;

const MIN_INTERVAL_MS = 15_000;

export async function reencryptPendingMessages(
  options: { force?: boolean } = {}
): Promise<ReencryptPendingMessagesResult | null> {
  const now = Date.now();

  if (inFlight) return inFlight;

  if (!options.force && now - lastRunAtMs < MIN_INTERVAL_MS) {
    return null;
  }

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

      const response = await fetch(`${baseUrl}/functions/v1/reencrypt-pending-messages`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        const text = await response.text();
        return { success: false, updated: 0, error: text || 'Failed to re-encrypt pending messages' };
      }

      const result = (await response.json()) as ReencryptPendingMessagesResult;
      lastRunAtMs = Date.now();
      return result;
    } catch (err) {
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
