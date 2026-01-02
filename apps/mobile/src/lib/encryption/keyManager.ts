/**
 * E2EE Key Manager
 * 
 * Handles RSA key pair generation and secure storage using expo-secure-store.
 * Keys are stored in chunks due to SecureStore's 2KB limit.
 */

import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { 
  PRIVATE_KEY_PREFIX, 
  PUBLIC_KEY_UPLOADED,
  LOCAL_PUBLIC_KEY,
  SECURE_STORE_CHUNK_SIZE,
  RSA_KEY_SIZE,
  KEY_WRAP_ALGORITHM,
  KEY_WRAP_HASH
} from './constants';
import { chunkString } from './utils';
import type { RSAPublicKeyJWK, RSAPrivateKeyJWK } from './types';

/**
 * Check if we're running in a web environment
 */
function isWeb(): boolean {
  return Platform.OS === 'web';
}

/**
 * Check if crypto is available (polyfill installed and native modules built)
 */
export function isCryptoAvailable(): boolean {
  if (isWeb()) return false;
  return typeof crypto !== 'undefined' && crypto.subtle !== undefined;
}

/**
 * Sanitize a public key by removing trailing dots that may appear
 * due to react-native-quick-crypto encoding issues.
 */
export function sanitizePublicKeyJwk(publicKeyJwk: RSAPublicKeyJWK): RSAPublicKeyJWK {
  return {
    ...publicKeyJwk,
    n: publicKeyJwk.n.replace(/\.+$/, ''),
    e: publicKeyJwk.e.replace(/\.+$/, ''),
  };
}

/**
 * Validate that a public key JWK looks well-formed for RSA import.
 */
export function isValidPublicKeyJwk(publicKeyJwk: RSAPublicKeyJWK | null): boolean {
  if (!publicKeyJwk) return false;
  if (publicKeyJwk.kty !== 'RSA') return false;
  if (typeof publicKeyJwk.n !== 'string' || typeof publicKeyJwk.e !== 'string') return false;

  // Sanitize before validation (handle trailing dots from quick-crypto)
  const sanitized = sanitizePublicKeyJwk(publicKeyJwk);
  const base64UrlPattern = /^[A-Za-z0-9_\-+/=]+$/;
  return base64UrlPattern.test(sanitized.n) && base64UrlPattern.test(sanitized.e);
}

/**
 * Get the Web Crypto API
 * In React Native with react-native-quick-crypto, it's available globally
 */
function getSubtle(): SubtleCrypto {
  // react-native-quick-crypto polyfills global.crypto
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    return crypto.subtle;
  }
  throw new Error('Web Crypto API not available. Run: npx expo prebuild --clean');
}

/**
 * Generate a new RSA-2048 key pair for E2EE
 * 
 * @returns The public key in JWK format (private key is stored in SecureStore)
 */
export async function generateAndStoreKeyPair(): Promise<RSAPublicKeyJWK> {
  if (isWeb()) {
    console.warn('E2EE key generation not supported on web platform');
    throw new Error('E2EE is not supported on web');
  }

  const subtle = getSubtle();

  // Generate RSA-2048 key pair
  const keyPair = await subtle.generateKey(
    {
      name: KEY_WRAP_ALGORITHM,
      modulusLength: RSA_KEY_SIZE,
      publicExponent: new Uint8Array([1, 0, 1]), // 65537
      hash: KEY_WRAP_HASH,
    },
    true, // extractable
    ['encrypt', 'decrypt']
  );

  // Export keys as JWK
  const publicKeyJwk = await subtle.exportKey('jwk', keyPair.publicKey) as RSAPublicKeyJWK;
  const privateKeyJwk = await subtle.exportKey('jwk', keyPair.privateKey) as RSAPrivateKeyJWK;

  // Store private key in SecureStore (chunked)
  await storePrivateKey(privateKeyJwk);
  
  // Store public key locally for quick access
  await storeLocalPublicKey(publicKeyJwk);

  return publicKeyJwk;
}

/**
 * Store private key in SecureStore using chunked storage
 * RSA-2048 JWK is ~1.7KB, SecureStore limit is 2KB
 */
async function storePrivateKey(privateKeyJwk: RSAPrivateKeyJWK): Promise<void> {
  const json = JSON.stringify(privateKeyJwk);
  const chunks = chunkString(json, SECURE_STORE_CHUNK_SIZE);
  
  // Store chunk count
  await SecureStore.setItemAsync(
    `${PRIVATE_KEY_PREFIX}count`, 
    chunks.length.toString()
  );
  
  // Store each chunk with high security settings
  for (let i = 0; i < chunks.length; i++) {
    await SecureStore.setItemAsync(
      `${PRIVATE_KEY_PREFIX}${i}`,
      chunks[i],
      { 
        keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY 
      }
    );
  }
}

/**
 * Store public key locally for quick access during encryption
 */
async function storeLocalPublicKey(publicKeyJwk: RSAPublicKeyJWK): Promise<void> {
  await SecureStore.setItemAsync(
    LOCAL_PUBLIC_KEY,
    JSON.stringify(publicKeyJwk)
  );
}

/**
 * Retrieve the private key from SecureStore
 * 
 * @returns The private key in JWK format, or null if not found
 */
export async function getPrivateKey(): Promise<RSAPrivateKeyJWK | null> {
  if (isWeb()) {
    return null;
  }

  try {
    const countStr = await SecureStore.getItemAsync(`${PRIVATE_KEY_PREFIX}count`);
    if (!countStr) return null;

    const count = parseInt(countStr, 10);
    const chunks: string[] = [];
    
    for (let i = 0; i < count; i++) {
      const chunk = await SecureStore.getItemAsync(`${PRIVATE_KEY_PREFIX}${i}`);
      if (!chunk) return null;
      chunks.push(chunk);
    }

    return JSON.parse(chunks.join('')) as RSAPrivateKeyJWK;
  } catch (error) {
    console.error('Failed to retrieve private key:', error);
    return null;
  }
}

/**
 * Retrieve the locally stored public key
 * 
 * @returns The public key in JWK format, or null if not found
 */
export async function getLocalPublicKey(): Promise<RSAPublicKeyJWK | null> {
  if (isWeb()) {
    return null;
  }

  try {
    const json = await SecureStore.getItemAsync(LOCAL_PUBLIC_KEY);
    if (!json) return null;
    return JSON.parse(json) as RSAPublicKeyJWK;
  } catch (error) {
    console.error('Failed to retrieve local public key:', error);
    return null;
  }
}

/**
 * Check if a key pair exists in SecureStore
 */
export async function hasKeyPair(): Promise<boolean> {
  if (isWeb()) {
    return false;
  }

  try {
    const countStr = await SecureStore.getItemAsync(`${PRIVATE_KEY_PREFIX}count`);
    return countStr !== null;
  } catch (error) {
    console.error('Failed to check for key pair:', error);
    return false;
  }
}

/**
 * Check if public key has been uploaded to Supabase
 */
export async function isPublicKeyUploaded(): Promise<boolean> {
  if (isWeb()) {
    return false;
  }

  try {
    const uploaded = await SecureStore.getItemAsync(PUBLIC_KEY_UPLOADED);
    return uploaded === 'true';
  } catch (error) {
    console.error('Failed to check public key upload status:', error);
    return false;
  }
}

/**
 * Mark public key as uploaded to Supabase
 */
export async function markPublicKeyUploaded(): Promise<void> {
  await SecureStore.setItemAsync(PUBLIC_KEY_UPLOADED, 'true');
}

/**
 * Clear all encryption keys from SecureStore
 * Used when user logs out or leaves a couple
 */
export async function clearKeys(): Promise<void> {
  if (isWeb()) {
    return;
  }

  try {
    const countStr = await SecureStore.getItemAsync(`${PRIVATE_KEY_PREFIX}count`);
    if (countStr) {
      const count = parseInt(countStr, 10);
      for (let i = 0; i < count; i++) {
        await SecureStore.deleteItemAsync(`${PRIVATE_KEY_PREFIX}${i}`);
      }
      await SecureStore.deleteItemAsync(`${PRIVATE_KEY_PREFIX}count`);
    }
    
    await SecureStore.deleteItemAsync(PUBLIC_KEY_UPLOADED);
    await SecureStore.deleteItemAsync(LOCAL_PUBLIC_KEY);
  } catch (error) {
    console.error('Failed to clear encryption keys:', error);
  }
}

/**
 * Import an RSA public key from JWK format for encryption operations
 */
export async function importPublicKey(publicKeyJwk: RSAPublicKeyJWK): Promise<CryptoKey> {
  const subtle = getSubtle();
  
  return await subtle.importKey(
    'jwk',
    publicKeyJwk,
    { name: KEY_WRAP_ALGORITHM, hash: KEY_WRAP_HASH },
    false,
    ['encrypt']
  );
}

/**
 * Import an RSA private key from JWK format for decryption operations
 */
export async function importPrivateKey(privateKeyJwk: RSAPrivateKeyJWK): Promise<CryptoKey> {
  const subtle = getSubtle();
  
  return await subtle.importKey(
    'jwk',
    privateKeyJwk,
    { name: KEY_WRAP_ALGORITHM, hash: KEY_WRAP_HASH },
    false,
    ['decrypt']
  );
}
