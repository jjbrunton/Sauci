/**
 * Low-level Crypto Operations
 * 
 * AES-256-GCM encryption/decryption and RSA key wrapping operations.
 */

import { 
  SYMMETRIC_ALGORITHM, 
  SYMMETRIC_KEY_LENGTH,
  IV_LENGTH_BYTES,
  KEY_WRAP_ALGORITHM 
} from './constants';
import { arrayBufferToBase64, base64ToArrayBuffer } from './utils';
import type { RSAPublicKeyJWK, RSAPrivateKeyJWK } from './types';
import { importPublicKey, importPrivateKey } from './keyManager';

/**
 * Get the Web Crypto API
 */
function getSubtle(): SubtleCrypto {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    return crypto.subtle;
  }
  throw new Error('Web Crypto API not available');
}

/**
 * Get crypto.getRandomValues
 */
function getRandomValues(array: Uint8Array): Uint8Array {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    return crypto.getRandomValues(array);
  }
  throw new Error('Crypto random not available');
}

/**
 * Generate a random AES-256 key
 */
export async function generateAESKey(): Promise<CryptoKey> {
  const subtle = getSubtle();
  
  return await subtle.generateKey(
    { name: SYMMETRIC_ALGORITHM, length: SYMMETRIC_KEY_LENGTH },
    true,
    ['encrypt', 'decrypt']
  );
}

/**
 * Generate a random initialization vector for AES-GCM (12 bytes)
 */
export function generateIV(): Uint8Array {
  return getRandomValues(new Uint8Array(IV_LENGTH_BYTES));
}

/**
 * Encrypt data with AES-256-GCM
 * 
 * @param plaintext - The data to encrypt (string or ArrayBuffer)
 * @param key - The AES key
 * @param iv - The initialization vector
 * @returns The encrypted ciphertext as ArrayBuffer
 */
export async function encryptAES(
  plaintext: string | ArrayBuffer,
  key: CryptoKey,
  iv: Uint8Array
): Promise<ArrayBuffer> {
  const subtle = getSubtle();
  
  const data = typeof plaintext === 'string' 
    ? new TextEncoder().encode(plaintext)
    : plaintext;

  return await subtle.encrypt(
    { name: SYMMETRIC_ALGORITHM, iv: iv as BufferSource },
    key,
    data
  );
}

/**
 * Decrypt data with AES-256-GCM
 * 
 * @param ciphertext - The encrypted data
 * @param key - The AES key
 * @param iv - The initialization vector
 * @returns The decrypted plaintext as ArrayBuffer
 */
export async function decryptAES(
  ciphertext: ArrayBuffer,
  key: CryptoKey,
  iv: Uint8Array
): Promise<ArrayBuffer> {
  const subtle = getSubtle();
  
  return await subtle.decrypt(
    { name: SYMMETRIC_ALGORITHM, iv: iv as BufferSource },
    key,
    ciphertext
  );
}

/**
 * Export an AES key to raw bytes
 */
export async function exportAESKey(key: CryptoKey): Promise<ArrayBuffer> {
  const subtle = getSubtle();
  return await subtle.exportKey('raw', key);
}

/**
 * Import an AES key from raw bytes
 */
export async function importAESKey(rawKey: ArrayBuffer): Promise<CryptoKey> {
  const subtle = getSubtle();
  
  return await subtle.importKey(
    'raw',
    rawKey,
    { name: SYMMETRIC_ALGORITHM },
    false,
    ['decrypt']
  );
}

/**
 * Wrap (encrypt) an AES key with an RSA public key
 * 
 * @param aesKeyRaw - The raw AES key bytes
 * @param publicKeyJwk - The recipient's RSA public key
 * @returns The wrapped key as base64 string
 */
export async function wrapAESKey(
  aesKeyRaw: ArrayBuffer,
  publicKeyJwk: RSAPublicKeyJWK
): Promise<string> {
  const subtle = getSubtle();
  const rsaKey = await importPublicKey(publicKeyJwk);
  
  const wrappedKey = await subtle.encrypt(
    { name: KEY_WRAP_ALGORITHM },
    rsaKey,
    aesKeyRaw
  );

  return arrayBufferToBase64(wrappedKey);
}

/**
 * Unwrap (decrypt) an AES key with an RSA private key
 *
 * @param wrappedKeyBase64 - The wrapped key as base64 string
 * @param privateKeyJwk - The user's RSA private key
 * @returns The unwrapped AES key as ArrayBuffer
 */
export async function unwrapAESKey(
  wrappedKeyBase64: string,
  privateKeyJwk: RSAPrivateKeyJWK
): Promise<ArrayBuffer> {
  const subtle = getSubtle();
  const rsaKey = await importPrivateKey(privateKeyJwk);
  const wrappedKey = base64ToArrayBuffer(wrappedKeyBase64);

  return await subtle.decrypt(
    { name: KEY_WRAP_ALGORITHM },
    rsaKey,
    wrappedKey
  );
}

/**
 * Verify that a public/private key pair actually work together.
 * This catches key mismatches that could cause unrecoverable encrypted messages.
 *
 * @param publicKeyJwk - The RSA public key
 * @param privateKeyJwk - The RSA private key
 * @returns true if the keys work together, false otherwise
 */
export async function verifyKeyPair(
  publicKeyJwk: RSAPublicKeyJWK,
  privateKeyJwk: RSAPrivateKeyJWK
): Promise<boolean> {
  try {
    const subtle = getSubtle();

    // Create test data (32 bytes - same as AES-256 key)
    const testData = getRandomValues(new Uint8Array(32));

    // Import keys
    const publicKey = await importPublicKey(publicKeyJwk);
    const privateKey = await importPrivateKey(privateKeyJwk);

    // Encrypt with public key
    const encrypted = await subtle.encrypt(
      { name: KEY_WRAP_ALGORITHM },
      publicKey,
      testData as BufferSource
    );

    // Decrypt with private key
    const decrypted = await subtle.decrypt(
      { name: KEY_WRAP_ALGORITHM },
      privateKey,
      encrypted
    );

    // Verify the data matches
    const decryptedArray = new Uint8Array(decrypted);
    if (decryptedArray.length !== testData.length) {
      return false;
    }

    for (let i = 0; i < testData.length; i++) {
      if (testData[i] !== decryptedArray[i]) {
        return false;
      }
    }

    return true;
  } catch (error) {
    console.error('[E2EE] Key pair verification failed:', error);
    return false;
  }
}
