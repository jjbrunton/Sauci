/**
 * E2EE Types for Sauci Chat
 * 
 * This file contains all TypeScript interfaces for the E2EE implementation.
 */

/**
 * Metadata about how message keys are wrapped for each party
 */
export interface KeysMetadata {
  /** AES key encrypted with sender's RSA public key (base64) */
  sender_wrapped_key: string;
  
  /** AES key encrypted with recipient's RSA public key (base64). Null if recipient hasn't generated keys yet */
  recipient_wrapped_key?: string;
  
  /** AES key encrypted with admin's RSA public key (base64) */
  admin_wrapped_key: string;
  
  /** UUID of the master_keys record used */
  admin_key_id: string;
  
  /** Symmetric encryption algorithm */
  algorithm: 'AES-256-GCM';
  
  /** Key wrapping algorithm */
  key_wrap_algorithm: 'RSA-OAEP-SHA256';
  
  /** True if recipient key needs to be added when they generate their keys */
  pending_recipient?: boolean;
}

/**
 * Payload for an encrypted text message
 */
export interface EncryptedMessagePayload {
  version: 2;
  encrypted_content: string;
  encryption_iv: string;
  keys_metadata: KeysMetadata;
}

/**
 * Payload for encrypted media
 */
export interface EncryptedMediaPayload {
  encryptedFileUri: string;
  encryption_iv: string;
  keys_metadata: KeysMetadata;
}

/**
 * Decrypted content result
 */
export interface DecryptedContent {
  content: string | null;
  mediaUrl: string | null;
}

/**
 * State for useDecryptedMessage hook
 */
export type DecryptedMessageErrorCode =
  | 'E2EE_NOT_SUPPORTED'
  | 'E2EE_KEYS_UNAVAILABLE'
  | 'E2EE_MISSING_FIELDS'
  | 'E2EE_PENDING_RECIPIENT_KEY'
  | 'E2EE_REPAIRING_STALE_KEY'
  | 'E2EE_DECRYPT_FAILED';

export interface DecryptedMessageState {
  content: string | null;
  mediaUri: string | null;
  isDecrypting: boolean;
  error: Error | null;
  errorCode?: DecryptedMessageErrorCode;
}

/**
 * RSA public key in JWK format (JSON Web Key)
 */
export interface RSAPublicKeyJWK {
  kty: 'RSA';
  n: string;  // modulus
  e: string;  // exponent
  alg?: string;
  key_ops?: string[];
}

/**
 * RSA private key in JWK format (includes public key components)
 */
export interface RSAPrivateKeyJWK extends RSAPublicKeyJWK {
  d: string;   // private exponent
  p: string;   // first prime factor
  q: string;   // second prime factor
  dp: string;  // first factor CRT exponent
  dq: string;  // second factor CRT exponent
  qi: string;  // first CRT coefficient
}

/**
 * State for useEncryptionKeys hook
 */
export interface EncryptionKeysState {
  privateKeyJwk: RSAPrivateKeyJWK | null;
  publicKeyJwk: RSAPublicKeyJWK | null;
  isLoading: boolean;
  hasKeys: boolean;
  error: Error | null;
}

/**
 * Master key record from database
 */
export interface MasterKey {
  id: string;
  key_name: string;
  public_key_jwk: RSAPublicKeyJWK;
  is_active: boolean;
  created_at: string;
  rotated_at: string | null;
}

/**
 * Encryption context for sending messages
 */
export interface EncryptionContext {
  senderPublicKeyJwk: RSAPublicKeyJWK;
  recipientPublicKeyJwk: RSAPublicKeyJWK | null;
  adminPublicKeyJwk: RSAPublicKeyJWK;
  adminKeyId: string;
}
