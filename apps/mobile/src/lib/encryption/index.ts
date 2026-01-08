/**
 * E2EE Encryption Library
 * 
 * Public API exports for the Sauci E2EE implementation.
 */

// Types
export type {
  KeysMetadata,
  EncryptedMessagePayload,
  EncryptedMediaPayload,
  DecryptedContent,
  DecryptedMessageState,
  RSAPublicKeyJWK,
  RSAPrivateKeyJWK,
  EncryptionKeysState,
  MasterKey,
  EncryptionContext,
} from './types';

// Constants
export {
  MESSAGE_VERSION_PLAINTEXT,
  MESSAGE_VERSION_E2EE,
} from './constants';

// Key Management
export {
  generateAndStoreKeyPair,
  getPrivateKey,
  getLocalPublicKey,
  hasKeyPair,
  isPublicKeyUploaded,
  markPublicKeyUploaded,
  clearKeys,
  isCryptoAvailable,
  isValidPublicKeyJwk,
  sanitizePublicKeyJwk,
} from './keyManager';

// Text Message Encryption/Decryption
export { encryptTextMessage } from './messageEncryption';
export { decryptTextMessage } from './messageDecryption';

// Media Encryption/Decryption
export { encryptMediaFile, getEncryptedFileExtension } from './mediaEncryption';
export { decryptMediaFile, cleanupDecryptedMedia } from './mediaDecryption';

// Admin Keys
export {
  getActiveMasterKey,
  getAdminPublicKey,
  getAdminKeyId,
  clearAdminKeyCache,
} from './adminKeys';

// Utilities
export {
  arrayBufferToBase64,
  base64ToArrayBuffer,
} from './utils';

// Key Rotation
export { triggerKeyRotation, triggerAutoKeyRotation } from './triggerKeyRotation';

// Stale Key Repair
export { repairStaleKey } from './repairStaleKey';

// Crypto Operations
export { verifyKeyPair } from './crypto';
