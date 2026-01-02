/**
 * E2EE Constants
 * 
 * Algorithm identifiers and storage key names for encryption
 */

// SecureStore key names for private key storage
export const PRIVATE_KEY_PREFIX = 'e2ee_private_key_chunk_';
export const PUBLIC_KEY_UPLOADED = 'e2ee_public_key_uploaded';
export const LOCAL_PUBLIC_KEY = 'e2ee_local_public_key';

// Encryption algorithms
export const SYMMETRIC_ALGORITHM = 'AES-GCM';
export const SYMMETRIC_KEY_LENGTH = 256;
export const IV_LENGTH_BYTES = 12;  // 96 bits for AES-GCM

// Key wrapping
export const KEY_WRAP_ALGORITHM = 'RSA-OAEP';
export const KEY_WRAP_HASH = 'SHA-256';
export const RSA_KEY_SIZE = 2048;

// SecureStore chunking (RSA-2048 JWK is ~1.7KB, SecureStore limit is 2KB)
export const SECURE_STORE_CHUNK_SIZE = 1900;

// Default master key name
export const DEFAULT_MASTER_KEY_NAME = 'e2ee_admin_key_v1';

// Message version constants
export const MESSAGE_VERSION_PLAINTEXT = 1;
export const MESSAGE_VERSION_E2EE = 2;
