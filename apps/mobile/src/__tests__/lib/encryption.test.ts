import {
  generateAESKey,
  generateIV,
  encryptAES,
  decryptAES,
  exportAESKey,
  importAESKey,
  wrapAESKey,
  unwrapAESKey,
  verifyKeyPair,
} from '../../lib/encryption/crypto';
import {
  generateAndStoreKeyPair,
  getPrivateKey,
  clearKeys,
  sanitizePublicKeyJwk,
  isValidPublicKeyJwk,
} from '../../lib/encryption/keyManager';
import { encryptTextMessage } from '../../lib/encryption/messageEncryption';
import { decryptTextMessage } from '../../lib/encryption/messageDecryption';
import { RSAPublicKeyJWK, RSAPrivateKeyJWK } from '../../lib/encryption/types';

// Mock dependencies
jest.mock('expo-secure-store', () => {
  let store: Record<string, string> = {};
  return {
    setItemAsync: jest.fn(async (key, value) => {
      store[key] = value;
    }),
    getItemAsync: jest.fn(async (key) => {
      return store[key] || null;
    }),
    deleteItemAsync: jest.fn(async (key) => {
      delete store[key];
    }),
    _clear: () => {
      store = {};
    },
  };
});

jest.mock('react-native', () => ({
  Platform: {
    OS: 'ios', // Mock as native platform to allow key generation
  },
}));

// Mock react-native-quick-crypto's polyfill behavior if needed, 
// but Node.js 20+ has global.crypto.subtle.
// If tests fail due to missing crypto, we will need to polyfill it.
if (!global.crypto) {
  // @ts-ignore
  global.crypto = require('crypto').webcrypto;
}

describe('E2EE Encryption Library', () => {
  // 1. Low-Level Crypto Primitives
  describe('Crypto Primitives (AES-GCM)', () => {
    it('should generate a valid AES-256 key', async () => {
      const key = await generateAESKey();
      expect(key.algorithm.name).toBe('AES-GCM');
      // @ts-ignore - length is present in Web Crypto keys
      expect(key.algorithm.length).toBe(256);
      expect(key.extractable).toBe(true);
    });

    it('should generate a valid 12-byte IV', () => {
      const iv = generateIV();
      expect(iv.length).toBe(12);
      expect(iv).toBeInstanceOf(Uint8Array);
    });

    it('should correctly round-trip AES encryption/decryption', async () => {
      const plaintext = 'Hello, Secret World!';
      const key = await generateAESKey();
      const iv = generateIV();

      const ciphertext = await encryptAES(plaintext, key, iv);
      const decryptedBuffer = await decryptAES(ciphertext, key, iv);
      const decryptedText = new TextDecoder().decode(decryptedBuffer);

      expect(decryptedText).toBe(plaintext);
    });

    it('should export and import AES keys correctly', async () => {
      const originalKey = await generateAESKey();
      const rawKey = await exportAESKey(originalKey);
      
      expect(rawKey.byteLength).toBe(32); // 256 bits = 32 bytes

      const importedKey = await importAESKey(rawKey);
      
      expect(importedKey.algorithm.name).toBe('AES-GCM');
      // @ts-ignore
      expect(importedKey.algorithm.length).toBe(256);
    });
  });

  // 2. RSA Key Wrapping
  describe('RSA Key Wrapping', () => {
    let aliceKeyPair: CryptoKeyPair;
    let alicePublicKeyJwk: RSAPublicKeyJWK;
    let alicePrivateKeyJwk: RSAPrivateKeyJWK;

    beforeAll(async () => {
      // Generate a real keypair for testing using Web Crypto directly
      // simulating what generateAndStoreKeyPair does internally
      aliceKeyPair = await crypto.subtle.generateKey(
        {
          name: 'RSA-OAEP',
          modulusLength: 2048,
          publicExponent: new Uint8Array([1, 0, 1]),
          hash: 'SHA-256',
        },
        true,
        ['encrypt', 'decrypt']
      );

      alicePublicKeyJwk = (await crypto.subtle.exportKey('jwk', aliceKeyPair.publicKey)) as RSAPublicKeyJWK;
      alicePrivateKeyJwk = (await crypto.subtle.exportKey('jwk', aliceKeyPair.privateKey)) as RSAPrivateKeyJWK;
    });

    it('should wrap and unwrap an AES key using RSA keys', async () => {
      const aesKey = await generateAESKey();
      const rawAesKey = await exportAESKey(aesKey);

      // Wrap with Public Key
      const wrappedKeyBase64 = await wrapAESKey(rawAesKey, alicePublicKeyJwk);
      expect(typeof wrappedKeyBase64).toBe('string');

      // Unwrap with Private Key
      const unwrappedRawKey = await unwrapAESKey(wrappedKeyBase64, alicePrivateKeyJwk);
      
      // Compare bytes
      const originalBytes = new Uint8Array(rawAesKey);
      const unwrappedBytes = new Uint8Array(unwrappedRawKey);
      expect(unwrappedBytes).toEqual(originalBytes);
    });

    it('should verify matching key pairs', async () => {
      const isMatch = await verifyKeyPair(alicePublicKeyJwk, alicePrivateKeyJwk);
      expect(isMatch).toBe(true);
    });

    it('should reject mismatched key pairs', async () => {
      // Suppress expected console error
      const originalError = console.error;
      console.error = jest.fn();

      try {
        // Generate a second, different keypair
        const bobKeyPair = await crypto.subtle.generateKey(
          {
            name: 'RSA-OAEP',
            modulusLength: 2048,
            publicExponent: new Uint8Array([1, 0, 1]),
            hash: 'SHA-256',
          },
          true,
          ['encrypt', 'decrypt']
        );
        const bobPrivateKeyJwk = (await crypto.subtle.exportKey('jwk', bobKeyPair.privateKey)) as RSAPrivateKeyJWK;

        // Check mismatch (Alice's Public + Bob's Private)
        const isMatch = await verifyKeyPair(alicePublicKeyJwk, bobPrivateKeyJwk);
        expect(isMatch).toBe(false);
      } finally {
        // Restore console error
        console.error = originalError;
      }
    });
  });

  // 3. Key Manager (with mocked SecureStore)
  describe('Key Manager', () => {
    beforeEach(() => {
      // Clear mocked store
      require('expo-secure-store')._clear();
    });

    it('should generate and store keys correctly', async () => {
      const publicKey = await generateAndStoreKeyPair();
      
      expect(publicKey.kty).toBe('RSA');
      expect(publicKey.alg).toBe('RSA-OAEP-256');

      // Check SecureStore interaction
      const storedPrivateKey = await getPrivateKey();
      expect(storedPrivateKey).toBeDefined();
      expect(storedPrivateKey?.d).toBeDefined(); // 'd' is the private exponent
      
      // Verify they match
      const isMatch = await verifyKeyPair(publicKey, storedPrivateKey!);
      expect(isMatch).toBe(true);
    });

    it('should clear keys', async () => {
      await generateAndStoreKeyPair();
      await clearKeys();
      
      const storedPrivateKey = await getPrivateKey();
      expect(storedPrivateKey).toBeNull();
    });

    it('should validate and sanitize public keys', () => {
      // Valid key
      const validKey: RSAPublicKeyJWK = {
        kty: 'RSA',
        n: 'some_base64_string',
        e: 'AQAB',
        alg: 'RSA-OAEP-256'
      };
      expect(isValidPublicKeyJwk(validKey)).toBe(true);

      // Invalid key (missing fields)
      expect(isValidPublicKeyJwk({} as any)).toBe(false);

      // Key with trailing dots (sanitization test)
      const dirtyKey: RSAPublicKeyJWK = {
        ...validKey,
        n: 'some_base64_string...',
        e: 'AQAB.'
      };
      
      const cleanKey = sanitizePublicKeyJwk(dirtyKey);
      expect(cleanKey.n).toBe('some_base64_string');
      expect(cleanKey.e).toBe('AQAB');
      expect(isValidPublicKeyJwk(dirtyKey)).toBe(true); // Should pass because it sanitizes internally
    });
  });

  // 4. High-Level Message Flow (Alice -> Bob)
  describe('Full Message Flow (Alice -> Bob)', () => {
    let aliceKeys: { pub: RSAPublicKeyJWK, priv: RSAPrivateKeyJWK };
    let bobKeys: { pub: RSAPublicKeyJWK, priv: RSAPrivateKeyJWK };
    let adminKeys: { pub: RSAPublicKeyJWK, priv: RSAPrivateKeyJWK };

    beforeAll(async () => {
      const genKey = async () => {
        const kp = await crypto.subtle.generateKey(
          {
            name: 'RSA-OAEP',
            modulusLength: 2048,
            publicExponent: new Uint8Array([1, 0, 1]),
            hash: 'SHA-256',
          },
          true,
          ['encrypt', 'decrypt']
        );
        return {
          pub: (await crypto.subtle.exportKey('jwk', kp.publicKey)) as RSAPublicKeyJWK,
          priv: (await crypto.subtle.exportKey('jwk', kp.privateKey)) as RSAPrivateKeyJWK,
        };
      };

      aliceKeys = await genKey();
      bobKeys = await genKey();
      adminKeys = await genKey();
    });

    it('should encrypt and decrypt a message successfully', async () => {
      const plaintext = "Meet me at the secret base.";
      const adminKeyId = "admin-key-uuid";

      // 1. Alice Encrypts
      const encryptedPayload = await encryptTextMessage(
        plaintext,
        aliceKeys.pub,
        bobKeys.pub,
        adminKeys.pub,
        adminKeyId
      );

      expect(encryptedPayload.version).toBe(2);
      expect(encryptedPayload.keys_metadata.algorithm).toBe('AES-256-GCM');
      expect(encryptedPayload.keys_metadata.sender_wrapped_key).toBeDefined();
      expect(encryptedPayload.keys_metadata.recipient_wrapped_key).toBeDefined();
      expect(encryptedPayload.keys_metadata.admin_wrapped_key).toBeDefined();

      // 2. Bob Decrypts (as Recipient)
      const decryptedByBob = await decryptTextMessage(
        encryptedPayload.encrypted_content,
        encryptedPayload.encryption_iv,
        encryptedPayload.keys_metadata,
        bobKeys.priv,
        true // isRecipient
      );

      expect(decryptedByBob).toBe(plaintext);

      // 3. Alice Decrypts (as Sender) - e.g. for history
      const decryptedByAlice = await decryptTextMessage(
        encryptedPayload.encrypted_content,
        encryptedPayload.encryption_iv,
        encryptedPayload.keys_metadata,
        aliceKeys.priv,
        false // isRecipient = false
      );

      expect(decryptedByAlice).toBe(plaintext);
    });

    it('should handle pending recipient (no recipient key)', async () => {
      const plaintext = "Waiting for you to join...";
      const adminKeyId = "admin-key-uuid";

      // Encrypt with NO recipient key (null)
      const encryptedPayload = await encryptTextMessage(
        plaintext,
        aliceKeys.pub,
        null, // No recipient key
        adminKeys.pub,
        adminKeyId
      );

      expect(encryptedPayload.keys_metadata.recipient_wrapped_key).toBeUndefined();
      expect(encryptedPayload.keys_metadata.pending_recipient).toBe(true);

      // Sender (Alice) can still decrypt
      const decryptedByAlice = await decryptTextMessage(
        encryptedPayload.encrypted_content,
        encryptedPayload.encryption_iv,
        encryptedPayload.keys_metadata,
        aliceKeys.priv,
        false
      );
      expect(decryptedByAlice).toBe(plaintext);
    });
  });
});
