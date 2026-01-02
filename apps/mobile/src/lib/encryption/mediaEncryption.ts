/**
 * Media Encryption
 * 
 * Encrypts images and videos using AES-256-GCM with triple-wrapped keys.
 * Uses a download-then-decrypt approach for simplicity.
 */

import * as FileSystem from 'expo-file-system';
import { generateAESKey, generateIV, encryptAES, exportAESKey, wrapAESKey } from './crypto';
import { arrayBufferToBase64, base64ToArrayBuffer } from './utils';
import type { KeysMetadata, EncryptedMediaPayload, RSAPublicKeyJWK } from './types';

/**
 * Encrypt a media file (image or video) for E2EE
 * 
 * @param sourceUri - Local file URI of the media to encrypt
 * @param senderPublicKeyJwk - Sender's RSA public key
 * @param recipientPublicKeyJwk - Recipient's RSA public key (may be null)
 * @param adminPublicKeyJwk - Admin's RSA public key
 * @param adminKeyId - UUID of the admin key record
 * @returns Encrypted media payload with local file URI
 */
export async function encryptMediaFile(
  sourceUri: string,
  senderPublicKeyJwk: RSAPublicKeyJWK,
  recipientPublicKeyJwk: RSAPublicKeyJWK | null,
  adminPublicKeyJwk: RSAPublicKeyJWK,
  adminKeyId: string
): Promise<EncryptedMediaPayload> {
  
  // 1. Read entire file into memory as base64
  const fileBase64 = await FileSystem.readAsStringAsync(sourceUri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const fileBuffer = base64ToArrayBuffer(fileBase64);

  // 2. Generate AES key and IV
  const aesKey = await generateAESKey();
  const iv = generateIV();

  // 3. Encrypt entire file
  const encryptedData = await encryptAES(fileBuffer, aesKey, iv);

  // 4. Write encrypted file to temp location
  const encryptedUri = `${FileSystem.cacheDirectory}${Date.now()}.enc`;
  await FileSystem.writeAsStringAsync(
    encryptedUri,
    arrayBufferToBase64(encryptedData),
    { encoding: FileSystem.EncodingType.Base64 }
  );

  // 5. Wrap AES key for all parties
  const rawAesKey = await exportAESKey(aesKey);
  const senderWrappedKey = await wrapAESKey(rawAesKey, senderPublicKeyJwk);
  const adminWrappedKey = await wrapAESKey(rawAesKey, adminPublicKeyJwk);
  
  let recipientWrappedKey: string | undefined;
  if (recipientPublicKeyJwk) {
    recipientWrappedKey = await wrapAESKey(rawAesKey, recipientPublicKeyJwk);
  }

  return {
    encryptedFileUri: encryptedUri,
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

/**
 * Get the file extension for encrypted media
 */
export function getEncryptedFileExtension(): string {
  return '.enc';
}
