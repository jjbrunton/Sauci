/**
 * Text Message Encryption
 * 
 * Encrypts text messages using AES-256-GCM with triple-wrapped keys.
 */

import { generateAESKey, generateIV, encryptAES, exportAESKey, wrapAESKey } from './crypto';
import { arrayBufferToBase64 } from './utils';
import type { KeysMetadata, EncryptedMessagePayload, RSAPublicKeyJWK } from './types';

/**
 * Encrypt a text message for E2EE
 * 
 * The message is encrypted with a random AES-256 key, and that key is
 * wrapped (encrypted) separately for the sender, recipient, and admin.
 * 
 * @param plaintext - The message text to encrypt
 * @param senderPublicKeyJwk - Sender's RSA public key (for their own decryption)
 * @param recipientPublicKeyJwk - Recipient's RSA public key (may be null if not yet generated)
 * @param adminPublicKeyJwk - Admin's RSA public key (for moderation access)
 * @param adminKeyId - UUID of the admin key record in master_keys table
 * @returns The encrypted message payload
 */
export async function encryptTextMessage(
  plaintext: string,
  senderPublicKeyJwk: RSAPublicKeyJWK,
  recipientPublicKeyJwk: RSAPublicKeyJWK | null,
  adminPublicKeyJwk: RSAPublicKeyJWK,
  adminKeyId: string
): Promise<EncryptedMessagePayload> {
  
  // 1. Generate random AES-256 key
  const aesKey = await generateAESKey();

  // 2. Generate random 96-bit IV
  const iv = generateIV();

  // 3. Encrypt plaintext
  const ciphertext = await encryptAES(plaintext, aesKey, iv);

  // 4. Export AES key for wrapping
  const rawAesKey = await exportAESKey(aesKey);

  // 5. Wrap AES key for each party
  const senderWrappedKey = await wrapAESKey(rawAesKey, senderPublicKeyJwk);
  const adminWrappedKey = await wrapAESKey(rawAesKey, adminPublicKeyJwk);
  
  let recipientWrappedKey: string | undefined;
  if (recipientPublicKeyJwk) {
    recipientWrappedKey = await wrapAESKey(rawAesKey, recipientPublicKeyJwk);
  }

  return {
    version: 2,
    encrypted_content: arrayBufferToBase64(ciphertext),
    encryption_iv: arrayBufferToBase64(iv.buffer as ArrayBuffer),
    keys_metadata: {
      sender_wrapped_key: senderWrappedKey,
      recipient_wrapped_key: recipientWrappedKey,
      admin_wrapped_key: adminWrappedKey,
      admin_key_id: adminKeyId,
      algorithm: 'AES-256-GCM',
      key_wrap_algorithm: 'RSA-OAEP-SHA256',
      pending_recipient: !recipientPublicKeyJwk,
    },
  };
}
