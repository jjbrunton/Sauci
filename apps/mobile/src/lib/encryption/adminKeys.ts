/**
 * Admin Keys Management
 * 
 * Fetches the active admin public key from the master_keys table.
 */

import { supabase } from '../supabase';
import type { MasterKey, RSAPublicKeyJWK } from './types';

// Cache for admin key to avoid repeated database calls
let cachedAdminKey: MasterKey | null = null;
let cacheTimestamp: number = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Fetch the active admin public key from the database
 * 
 * Results are cached for 5 minutes to reduce database calls.
 * 
 * @param forceRefresh - Force a fresh fetch, bypassing cache
 * @returns The active master key record
 */
export async function getActiveMasterKey(forceRefresh = false): Promise<MasterKey> {
  const now = Date.now();
  
  // Return cached key if still valid
  if (!forceRefresh && cachedAdminKey && (now - cacheTimestamp) < CACHE_TTL_MS) {
    return cachedAdminKey;
  }

  const { data, error } = await supabase
    .from('master_keys')
    .select('*')
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch admin key: ${error.message}`);
  }

  if (!data) {
    throw new Error('No active admin key found. E2EE is not configured.');
  }

  // Validate the key structure
  const publicKeyJwk = data.public_key_jwk as RSAPublicKeyJWK;
  if (!publicKeyJwk || publicKeyJwk.kty !== 'RSA') {
    throw new Error('Invalid admin public key format');
  }

  cachedAdminKey = {
    id: data.id,
    key_name: data.key_name,
    public_key_jwk: publicKeyJwk,
    is_active: data.is_active ?? true,
    created_at: data.created_at ?? '',
    rotated_at: data.rotated_at,
  };
  cacheTimestamp = now;

  return cachedAdminKey;
}

/**
 * Get the admin public key JWK directly
 */
export async function getAdminPublicKey(): Promise<RSAPublicKeyJWK> {
  const masterKey = await getActiveMasterKey();
  return masterKey.public_key_jwk;
}

/**
 * Get the admin key ID for storing in message metadata
 */
export async function getAdminKeyId(): Promise<string> {
  const masterKey = await getActiveMasterKey();
  return masterKey.id;
}

/**
 * Clear the admin key cache
 * Called when keys might have been rotated
 */
export function clearAdminKeyCache(): void {
  cachedAdminKey = null;
  cacheTimestamp = 0;
}
