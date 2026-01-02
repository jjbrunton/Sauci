/**
 * Media Decryption
 * 
 * Decrypts E2EE images and videos using a download-first approach.
 */

import * as FileSystem from 'expo-file-system';
import { unwrapAESKey, importAESKey, decryptAES } from './crypto';
import { base64ToArrayBuffer, base64ToUint8Array, arrayBufferToBase64 } from './utils';
import type { KeysMetadata, RSAPrivateKeyJWK } from './types';

/**
 * Decrypt an encrypted media file
 * 
 * Downloads the encrypted file, decrypts it, and returns a local file URI.
 * 
 * @param encryptedUrl - Signed URL to the .enc file in storage
 * @param encryptionIv - Base64-encoded initialization vector
 * @param keysMetadata - The wrapped keys metadata
 * @param privateKeyJwk - User's RSA private key
 * @param isRecipient - Whether the current user is the recipient
 * @param mediaType - Type of media ('image' or 'video')
 * @returns Local file URI to the decrypted media
 */
export async function decryptMediaFile(
  encryptedUrl: string,
  encryptionIv: string,
  keysMetadata: KeysMetadata,
  privateKeyJwk: RSAPrivateKeyJWK,
  isRecipient: boolean,
  mediaType: 'image' | 'video'
): Promise<string> {
  
  // 1. Download entire encrypted file
  const tempEncryptedPath = `${FileSystem.cacheDirectory}${Date.now()}_encrypted.enc`;
  const downloadResult = await FileSystem.downloadAsync(
    encryptedUrl,
    tempEncryptedPath
  );

  if (downloadResult.status !== 200) {
    throw new Error(`Failed to download encrypted file: ${downloadResult.status}`);
  }

  // 2. Read encrypted data
  const encryptedBase64 = await FileSystem.readAsStringAsync(
    downloadResult.uri,
    { encoding: FileSystem.EncodingType.Base64 }
  );
  const encryptedData = base64ToArrayBuffer(encryptedBase64);

  // 3. Validate and decode IV (must be exactly 12 bytes for AES-GCM)
  const iv = base64ToUint8Array(encryptionIv);
  if (iv.length !== 12) {
    throw new Error(`Invalid IV length: expected 12 bytes, got ${iv.length}`);
  }

  // 4. Unwrap AES key
  const wrappedKeyBase64 = isRecipient
    ? keysMetadata.recipient_wrapped_key
    : keysMetadata.sender_wrapped_key;

  if (!wrappedKeyBase64) {
    throw new Error('No wrapped key available for media decryption');
  }

  const rawAesKey = await unwrapAESKey(wrappedKeyBase64, privateKeyJwk);
  const aesKey = await importAESKey(rawAesKey);

  // 5. Decrypt file
  const decryptedData = await decryptAES(encryptedData, aesKey, iv);

  // 6. Write decrypted file
  const ext = mediaType === 'video' ? 'mp4' : 'jpg';
  const decryptedUri = `${FileSystem.cacheDirectory}${Date.now()}_decrypted.${ext}`;
  
  await FileSystem.writeAsStringAsync(
    decryptedUri,
    arrayBufferToBase64(decryptedData),
    { encoding: FileSystem.EncodingType.Base64 }
  );

  // 6. Clean up encrypted temp file
  await FileSystem.deleteAsync(downloadResult.uri, { idempotent: true });

  return decryptedUri;
}

/**
 * Clean up a decrypted media file from cache
 * 
 * @param uri - Local file URI to delete
 */
export async function cleanupDecryptedMedia(uri: string): Promise<void> {
  try {
    await FileSystem.deleteAsync(uri, { idempotent: true });
  } catch (error) {
    console.warn('Failed to clean up decrypted media:', error);
  }
}
