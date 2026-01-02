/**
 * Text Message Decryption
 * 
 * Decrypts E2EE text messages using the user's RSA private key.
 */

import { unwrapAESKey, importAESKey, decryptAES } from './crypto';
import { base64ToArrayBuffer, base64ToUint8Array } from './utils';
import type { KeysMetadata, RSAPrivateKeyJWK } from './types';

/**
 * Decrypt an E2EE text message
 * 
 * @param encryptedContent - Base64-encoded ciphertext
 * @param encryptionIv - Base64-encoded initialization vector
 * @param keysMetadata - The wrapped keys metadata
 * @param privateKeyJwk - User's RSA private key
 * @param isRecipient - Whether the current user is the recipient (true) or sender (false)
 * @returns The decrypted plaintext message
 */
export async function decryptTextMessage(
  encryptedContent: string,
  encryptionIv: string,
  keysMetadata: KeysMetadata,
  privateKeyJwk: RSAPrivateKeyJWK,
  isRecipient: boolean
): Promise<string> {
  
  // 1. Select the correct wrapped key
  const wrappedKeyBase64 = isRecipient
    ? keysMetadata.recipient_wrapped_key
    : keysMetadata.sender_wrapped_key;

  if (!wrappedKeyBase64) {
    throw new Error('No wrapped key available for decryption');
  }

  // 2. Validate and decode IV (must be exactly 12 bytes for AES-GCM)
  const iv = base64ToUint8Array(encryptionIv);
  if (iv.length !== 12) {
    throw new Error(`Invalid IV length: expected 12 bytes, got ${iv.length}`);
  }

  // 3. Unwrap AES key using RSA private key
  const rawAesKey = await unwrapAESKey(wrappedKeyBase64, privateKeyJwk);

  // 4. Import AES key
  const aesKey = await importAESKey(rawAesKey);

  // 5. Decrypt content
  const ciphertext = base64ToArrayBuffer(encryptedContent);
  
  const plaintext = await decryptAES(ciphertext, aesKey, iv);

  // 6. Decode to string
  return new TextDecoder().decode(plaintext);
}
