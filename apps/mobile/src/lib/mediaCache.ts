/**
 * Media Cache Utilities
 *
 * Extracted from useDecryptedMedia to avoid circular dependencies.
 * This module handles caching of decrypted media files.
 */

import { cleanupDecryptedMedia } from './encryption';

// In-memory cache to avoid re-decrypting the same media
export const decryptedMediaCache = new Map<string, string>();

/**
 * Clears all cached decrypted media files from disk and memory.
 * Call this on sign out to free up storage.
 */
export async function clearDecryptedMediaCache(): Promise<void> {
  for (const uri of decryptedMediaCache.values()) {
    await cleanupDecryptedMedia(uri);
  }
  decryptedMediaCache.clear();
}
