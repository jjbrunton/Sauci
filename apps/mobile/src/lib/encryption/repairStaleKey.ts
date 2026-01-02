/**
 * Stale Key Repair (Server Assisted)
 *
 * When a message was encrypted offline with a recipient's old public key,
 * and the recipient has since regenerated their keys, this function requests
 * the server to re-wrap the AES key using the admin recovery model.
 */

import { supabase } from '../supabase';

export interface RepairStaleKeyResult {
  success: boolean;
  message_id?: string;
  error?: string;
}

// Track in-flight repairs to avoid duplicate requests
const inFlightRepairs = new Map<string, Promise<RepairStaleKeyResult>>();

/**
 * Request the server to repair a message encrypted with a stale key.
 *
 * @param messageId - The ID of the message to repair
 * @returns Result of the repair operation
 */
export async function repairStaleKey(
  messageId: string
): Promise<RepairStaleKeyResult> {
  // Check if already in flight
  const existing = inFlightRepairs.get(messageId);
  if (existing) {
    return existing;
  }

  const promise = (async (): Promise<RepairStaleKeyResult> => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        return { success: false, error: 'Not authenticated' };
      }

      const baseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
      if (!baseUrl) {
        return { success: false, error: 'Missing EXPO_PUBLIC_SUPABASE_URL' };
      }

      const response = await fetch(`${baseUrl}/functions/v1/repair-stale-key`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message_id: messageId }),
      });

      if (!response.ok) {
        const text = await response.text();
        let errorMessage = 'Failed to repair message key';
        try {
          const json = JSON.parse(text);
          errorMessage = json.error || errorMessage;
        } catch {
          // Use default error message
        }
        return { success: false, error: errorMessage };
      }

      const result = (await response.json()) as RepairStaleKeyResult;
      return result;
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      };
    } finally {
      inFlightRepairs.delete(messageId);
    }
  })();

  inFlightRepairs.set(messageId, promise);
  return promise;
}
