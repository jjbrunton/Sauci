# E2EE Implementation Plan for Sauci Chat

## Overview

This document outlines the implementation of client-side **3-way End-to-End Encryption (E2EE)** for all chat content (text messages, images, and videos) in the Sauci mobile app. The design provides:

- **Full encryption** of message content before it leaves the device
- **Triple-wrapped keys** allowing decryption by sender, recipient, and admin
- **Backwards compatibility** with existing plaintext (v1) messages
- **Admin moderation capability** for reported content review
- **Device change recovery** via admin re-encryption

---

## Encryption Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        Message Encryption Flow                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────┐              ┌──────────────────┐                     │
│  │ Text Message │              │ Media (Img/Video)│                     │
│  └──────┬───────┘              └────────┬─────────┘                     │
│         │                               │                                │
│         ▼                               ▼                                │
│  ┌──────────────────────────────────────────────────┐                   │
│  │     Generate Random AES-256-GCM Content Key      │                   │
│  └──────────────────────────┬───────────────────────┘                   │
│                             │                                            │
│         ┌───────────────────┼───────────────────┐                       │
│         ▼                   ▼                   ▼                        │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐                  │
│  │  Encrypt    │    │  Encrypt    │    │  Encrypt    │                  │
│  │  AES Key    │    │  AES Key    │    │  AES Key    │                  │
│  │  with       │    │  with       │    │  with       │                  │
│  │  SENDER     │    │  RECIPIENT  │    │  ADMIN      │                  │
│  │  RSA Pub    │    │  RSA Pub    │    │  RSA Pub    │                  │
│  └──────┬──────┘    └──────┬──────┘    └──────┬──────┘                  │
│         │                  │                  │                          │
│         └──────────────────┼──────────────────┘                          │
│                            ▼                                             │
│              ┌─────────────────────────┐                                 │
│              │    keys_metadata JSONB   │                                │
│              │  {                       │                                │
│              │   sender_wrapped_key,    │                                │
│              │   recipient_wrapped_key, │                                │
│              │   admin_wrapped_key,     │                                │
│              │   admin_key_id           │                                │
│              │  }                       │                                │
│              └─────────────────────────┘                                 │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Key Decisions

| Aspect | Decision | Rationale |
|--------|----------|-----------|
| **Crypto Library** | `react-native-quick-crypto@^0.7.x` | Works with old architecture (`newArchEnabled: false`), native performance |
| **Symmetric Cipher** | AES-256-GCM | Authenticated encryption, widely supported |
| **Asymmetric Cipher** | RSA-OAEP (SHA-256) | Secure key wrapping, PKCS#1 v2.1 |
| **RSA Key Size** | 2048-bit | Fits in SecureStore (~1.7KB), secure for 10+ years |
| **Key Format** | JWK (JSON Web Key) | Required - v0.x doesn't support PKCS8 import for RSA-OAEP |
| **Media Encryption** | Download-then-decrypt | Simpler than streaming, acceptable for compressed media |
| **Admin Key Storage** | Environment variable | Edge function accessible |
| **Key Rotation** | Archive old keys | Old messages remain decryptable |
| **Missing Partner Key** | Encrypt sender+admin only | Re-encrypt when partner generates keys |
| **Device Change** | Admin re-encryption | Recovers access when user gets new device |

---

## Device Change / Key Loss Handling

When a user loses their phone and reinstalls on a new device:

### Problem
- New key pair generated on new device
- Old private key is lost (was in old device's SecureStore)
- User would lose access to all E2EE messages

### Solution: Admin Re-encryption

When a user's public key changes (detected via database trigger or Edge Function):

1. System detects `profiles.public_key_jwk` was updated
2. Edge Function `handle-key-rotation` is triggered
3. For each v2 message where user is sender or recipient:
   - Unwrap AES key using admin private key
   - Re-wrap AES key with user's new public key
   - Update `sender_wrapped_key` or `recipient_wrapped_key`
4. User regains access to all historical messages

### Security Consideration
- Admin key becomes more powerful (can re-encrypt at will)
- This is acceptable since admin already has decryption access by design
- Audit logging recommended for accountability

---

## Database Schema Changes

### 1. Messages Table Updates

Add columns to support encrypted messages:

```sql
-- Migration: add_e2ee_support_to_messages

-- Version indicator: 1 = plaintext (legacy), 2 = E2EE
ALTER TABLE messages ADD COLUMN version INTEGER DEFAULT 1;

-- Encrypted message content (base64 encoded ciphertext)
ALTER TABLE messages ADD COLUMN encrypted_content TEXT;

-- Initialization vector for AES-GCM (base64 encoded, 12 bytes)
ALTER TABLE messages ADD COLUMN encryption_iv TEXT;

-- Triple-wrapped encryption keys and metadata
ALTER TABLE messages ADD COLUMN keys_metadata JSONB;

-- Add comment for documentation
COMMENT ON COLUMN messages.version IS 
  'Encryption version: 1 = plaintext (legacy), 2 = E2EE with triple-wrapped keys';

-- Constraint: v2 messages must have encryption fields
ALTER TABLE messages ADD CONSTRAINT e2ee_fields_required 
  CHECK (version = 1 OR (version = 2 AND encryption_iv IS NOT NULL AND keys_metadata IS NOT NULL));
```

### 2. Profiles Table Updates

Store user's public key for E2EE:

```sql
-- Migration: add_public_key_to_profiles

-- RSA public key in JWK format
ALTER TABLE profiles ADD COLUMN public_key_jwk JSONB;

-- Index for efficient lookups when encrypting for partner
CREATE INDEX idx_profiles_couple_id_public_key ON profiles(couple_id) 
  WHERE public_key_jwk IS NOT NULL;
```

### 3. Master Keys Table

Store admin public keys for moderation access:

```sql
-- Migration: create_master_keys_table

CREATE TABLE master_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key_name TEXT UNIQUE NOT NULL,
    public_key_jwk JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    rotated_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true
);

-- RLS: Only super admins can view/manage
ALTER TABLE master_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can view master keys"
  ON master_keys FOR SELECT
  TO authenticated
  USING (is_super_admin());

CREATE POLICY "Super admins can manage master keys"
  ON master_keys FOR ALL
  TO authenticated
  USING (is_super_admin());

-- Insert initial master key (public key only - private key in env)
-- This will be done during deployment setup
```

### 4. Keys Metadata Structure

```typescript
interface KeysMetadata {
  // AES key encrypted with sender's RSA public key (base64)
  sender_wrapped_key: string;
  
  // AES key encrypted with recipient's RSA public key (base64)
  // Null/undefined if recipient hasn't generated keys yet
  recipient_wrapped_key?: string;
  
  // AES key encrypted with admin's RSA public key (base64)
  admin_wrapped_key: string;
  
  // UUID of the master_keys record used
  admin_key_id: string;
  
  // Algorithm identifiers
  algorithm: 'AES-256-GCM';
  key_wrap_algorithm: 'RSA-OAEP-SHA256';
  
  // True if recipient key needs to be added when they join
  pending_recipient?: boolean;
}
```

---

## Mobile App Implementation

### File Structure

```
apps/mobile/src/lib/encryption/
├── index.ts                    # Public API exports
├── types.ts                    # TypeScript interfaces
├── constants.ts                # Algorithm constants, key names
├── utils.ts                    # Base64/ArrayBuffer conversions
├── keyManager.ts               # Key generation, SecureStore storage
├── crypto.ts                   # Low-level RSA/AES operations
├── messageEncryption.ts        # Encrypt text messages
├── messageDecryption.ts        # Decrypt text messages
├── mediaEncryption.ts          # Encrypt images/videos
├── mediaDecryption.ts          # Decrypt images/videos (download-first)
└── adminKeys.ts                # Fetch active admin public key

apps/mobile/src/hooks/
├── useEncryptionKeys.ts        # Hook to access user's keypair
└── useDecryptedMessage.ts      # Hook for message decryption

apps/mobile/src/features/chat/
├── hooks/
│   └── useEncryptedMediaUpload.ts  # Modified upload with encryption
└── components/
    └── EncryptedMessageContent.tsx # Version-aware message renderer
```

### Key Management

#### Key Generation (on first launch or couple join)

```typescript
// keyManager.ts

import { subtle, getRandomValues } from 'react-native-quick-crypto';
import * as SecureStore from 'expo-secure-store';

const PRIVATE_KEY_PREFIX = 'e2ee_private_key_chunk_';
const PUBLIC_KEY_UPLOADED = 'e2ee_public_key_uploaded';

export async function generateAndStoreKeyPair(): Promise<JsonWebKey> {
  // Generate RSA-2048 key pair
  const keyPair = await subtle.generateKey(
    {
      name: 'RSA-OAEP',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]), // 65537
      hash: 'SHA-256',
    },
    true, // extractable
    ['encrypt', 'decrypt']
  );

  // Export keys as JWK
  const publicKeyJwk = await subtle.exportKey('jwk', keyPair.publicKey);
  const privateKeyJwk = await subtle.exportKey('jwk', keyPair.privateKey);

  // Store private key in SecureStore (chunked if needed)
  await storePrivateKey(privateKeyJwk);

  return publicKeyJwk;
}

async function storePrivateKey(privateKeyJwk: JsonWebKey): Promise<void> {
  const json = JSON.stringify(privateKeyJwk);
  
  // SecureStore has 2KB limit, RSA-2048 JWK is ~1.7KB
  // Chunk to be safe
  const chunks = chunkString(json, 1900);
  
  await SecureStore.setItemAsync(
    `${PRIVATE_KEY_PREFIX}count`, 
    chunks.length.toString()
  );
  
  for (let i = 0; i < chunks.length; i++) {
    await SecureStore.setItemAsync(
      `${PRIVATE_KEY_PREFIX}${i}`,
      chunks[i],
      { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY }
    );
  }
}

export async function getPrivateKey(): Promise<JsonWebKey | null> {
  const countStr = await SecureStore.getItemAsync(`${PRIVATE_KEY_PREFIX}count`);
  if (!countStr) return null;

  const count = parseInt(countStr, 10);
  const chunks: string[] = [];
  
  for (let i = 0; i < count; i++) {
    const chunk = await SecureStore.getItemAsync(`${PRIVATE_KEY_PREFIX}${i}`);
    if (!chunk) return null;
    chunks.push(chunk);
  }

  return JSON.parse(chunks.join(''));
}

export async function hasKeyPair(): Promise<boolean> {
  const countStr = await SecureStore.getItemAsync(`${PRIVATE_KEY_PREFIX}count`);
  return countStr !== null;
}

export async function clearKeys(): Promise<void> {
  const countStr = await SecureStore.getItemAsync(`${PRIVATE_KEY_PREFIX}count`);
  if (!countStr) return;
  
  const count = parseInt(countStr, 10);
  for (let i = 0; i < count; i++) {
    await SecureStore.deleteItemAsync(`${PRIVATE_KEY_PREFIX}${i}`);
  }
  await SecureStore.deleteItemAsync(`${PRIVATE_KEY_PREFIX}count`);
  await SecureStore.deleteItemAsync(PUBLIC_KEY_UPLOADED);
}
```

#### Key Upload to Profile

```typescript
// Called after key generation
export async function uploadPublicKey(
  userId: string, 
  publicKeyJwk: JsonWebKey
): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ public_key_jwk: publicKeyJwk })
    .eq('id', userId);

  if (error) throw error;

  await SecureStore.setItemAsync(PUBLIC_KEY_UPLOADED, 'true');
}
```

### Text Message Encryption

```typescript
// messageEncryption.ts

import { subtle, getRandomValues } from 'react-native-quick-crypto';
import { arrayBufferToBase64 } from './utils';
import type { KeysMetadata, EncryptedMessagePayload } from './types';

export async function encryptTextMessage(
  plaintext: string,
  senderPublicKeyJwk: JsonWebKey,
  recipientPublicKeyJwk: JsonWebKey | null,
  adminPublicKeyJwk: JsonWebKey,
  adminKeyId: string
): Promise<EncryptedMessagePayload> {
  
  // 1. Generate random AES-256 key
  const aesKey = await subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );

  // 2. Generate random 96-bit IV
  const iv = getRandomValues(new Uint8Array(12));

  // 3. Encrypt plaintext
  const encoder = new TextEncoder();
  const plaintextBuffer = encoder.encode(plaintext);
  
  const ciphertext = await subtle.encrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    plaintextBuffer
  );

  // 4. Export AES key for wrapping
  const rawAesKey = await subtle.exportKey('raw', aesKey);

  // 5. Wrap AES key for each party
  const senderWrappedKey = await wrapKeyForRecipient(rawAesKey, senderPublicKeyJwk);
  const adminWrappedKey = await wrapKeyForRecipient(rawAesKey, adminPublicKeyJwk);
  
  let recipientWrappedKey: string | undefined;
  if (recipientPublicKeyJwk) {
    recipientWrappedKey = await wrapKeyForRecipient(rawAesKey, recipientPublicKeyJwk);
  }

  return {
    version: 2,
    encrypted_content: arrayBufferToBase64(ciphertext),
    encryption_iv: arrayBufferToBase64(iv),
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

async function wrapKeyForRecipient(
  rawAesKey: ArrayBuffer,
  recipientPublicKeyJwk: JsonWebKey
): Promise<string> {
  const rsaKey = await subtle.importKey(
    'jwk',
    recipientPublicKeyJwk,
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    false,
    ['encrypt']
  );

  const wrappedKey = await subtle.encrypt(
    { name: 'RSA-OAEP' },
    rsaKey,
    rawAesKey
  );

  return arrayBufferToBase64(wrappedKey);
}
```

### Text Message Decryption

```typescript
// messageDecryption.ts

import { subtle } from 'react-native-quick-crypto';
import { base64ToArrayBuffer } from './utils';
import type { KeysMetadata } from './types';

export async function decryptTextMessage(
  encryptedContent: string,
  encryptionIv: string,
  keysMetadata: KeysMetadata,
  privateKeyJwk: JsonWebKey,
  isRecipient: boolean
): Promise<string> {
  
  // 1. Select the correct wrapped key
  const wrappedKeyBase64 = isRecipient
    ? keysMetadata.recipient_wrapped_key
    : keysMetadata.sender_wrapped_key;

  if (!wrappedKeyBase64) {
    throw new Error('No wrapped key available for decryption');
  }

  // 2. Import private key
  const privateKey = await subtle.importKey(
    'jwk',
    privateKeyJwk,
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    false,
    ['decrypt']
  );

  // 3. Unwrap AES key
  const wrappedKey = base64ToArrayBuffer(wrappedKeyBase64);
  const rawAesKey = await subtle.decrypt(
    { name: 'RSA-OAEP' },
    privateKey,
    wrappedKey
  );

  // 4. Import AES key
  const aesKey = await subtle.importKey(
    'raw',
    rawAesKey,
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  );

  // 5. Decrypt content
  const iv = base64ToArrayBuffer(encryptionIv);
  const ciphertext = base64ToArrayBuffer(encryptedContent);
  
  const plaintext = await subtle.decrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    ciphertext
  );

  return new TextDecoder().decode(plaintext);
}
```

### Media Encryption (Download-First Approach)

```typescript
// mediaEncryption.ts

import { subtle, getRandomValues } from 'react-native-quick-crypto';
import * as FileSystem from 'expo-file-system';
import { arrayBufferToBase64, base64ToArrayBuffer } from './utils';
import type { KeysMetadata, EncryptedMediaPayload } from './types';

export async function encryptMediaFile(
  sourceUri: string,
  senderPublicKeyJwk: JsonWebKey,
  recipientPublicKeyJwk: JsonWebKey | null,
  adminPublicKeyJwk: JsonWebKey,
  adminKeyId: string
): Promise<EncryptedMediaPayload> {
  
  // 1. Read entire file into memory
  const fileBase64 = await FileSystem.readAsStringAsync(sourceUri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const fileBuffer = base64ToArrayBuffer(fileBase64);

  // 2. Generate AES key and IV
  const aesKey = await subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
  const iv = getRandomValues(new Uint8Array(12));

  // 3. Encrypt entire file
  const encryptedData = await subtle.encrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    fileBuffer
  );

  // 4. Write encrypted file to temp location
  const encryptedUri = `${FileSystem.cacheDirectory}${Date.now()}.enc`;
  await FileSystem.writeAsStringAsync(
    encryptedUri,
    arrayBufferToBase64(encryptedData),
    { encoding: FileSystem.EncodingType.Base64 }
  );

  // 5. Wrap AES key for all parties
  const rawAesKey = await subtle.exportKey('raw', aesKey);
  const senderWrappedKey = await wrapKeyForRecipient(rawAesKey, senderPublicKeyJwk);
  const adminWrappedKey = await wrapKeyForRecipient(rawAesKey, adminPublicKeyJwk);
  
  let recipientWrappedKey: string | undefined;
  if (recipientPublicKeyJwk) {
    recipientWrappedKey = await wrapKeyForRecipient(rawAesKey, recipientPublicKeyJwk);
  }

  return {
    encryptedFileUri: encryptedUri,
    encryption_iv: arrayBufferToBase64(iv),
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

async function wrapKeyForRecipient(
  rawAesKey: ArrayBuffer,
  recipientPublicKeyJwk: JsonWebKey
): Promise<string> {
  const rsaKey = await subtle.importKey(
    'jwk',
    recipientPublicKeyJwk,
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    false,
    ['encrypt']
  );

  const wrappedKey = await subtle.encrypt(
    { name: 'RSA-OAEP' },
    rsaKey,
    rawAesKey
  );

  return arrayBufferToBase64(wrappedKey);
}
```

### Media Decryption (Download-First Approach)

```typescript
// mediaDecryption.ts

import { subtle } from 'react-native-quick-crypto';
import * as FileSystem from 'expo-file-system';
import { base64ToArrayBuffer, arrayBufferToBase64 } from './utils';
import type { KeysMetadata } from './types';

export async function decryptMediaFile(
  encryptedUrl: string,          // Signed URL to .enc file
  encryptionIv: string,
  keysMetadata: KeysMetadata,
  privateKeyJwk: JsonWebKey,
  isRecipient: boolean,
  mediaType: 'image' | 'video'
): Promise<string> {  // Returns local file URI
  
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

  // 3. Unwrap AES key
  const wrappedKeyBase64 = isRecipient
    ? keysMetadata.recipient_wrapped_key
    : keysMetadata.sender_wrapped_key;

  if (!wrappedKeyBase64) {
    throw new Error('No wrapped key available');
  }

  const privateKey = await subtle.importKey(
    'jwk',
    privateKeyJwk,
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    false,
    ['decrypt']
  );

  const rawAesKey = await subtle.decrypt(
    { name: 'RSA-OAEP' },
    privateKey,
    base64ToArrayBuffer(wrappedKeyBase64)
  );

  const aesKey = await subtle.importKey(
    'raw',
    rawAesKey,
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  );

  // 4. Decrypt file
  const iv = base64ToArrayBuffer(encryptionIv);
  const decryptedData = await subtle.decrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    encryptedData
  );

  // 5. Write decrypted file
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
```

### Backwards Compatible Message Hook

```typescript
// hooks/useDecryptedMessage.ts

import { useState, useEffect } from 'react';
import { decryptTextMessage } from '../lib/encryption/messageDecryption';
import { useEncryptionKeys } from './useEncryptionKeys';
import type { Message } from '../features/chat/types';

interface DecryptedMessageState {
  content: string | null;
  mediaUri: string | null;
  isDecrypting: boolean;
  error: Error | null;
}

export function useDecryptedMessage(
  message: Message,
  isMe: boolean
): DecryptedMessageState {
  const [state, setState] = useState<DecryptedMessageState>({
    content: null,
    mediaUri: null,
    isDecrypting: false,
    error: null,
  });
  
  const { privateKeyJwk } = useEncryptionKeys();

  useEffect(() => {
    async function decrypt() {
      // Version 1 or undefined: Legacy plaintext
      if (!message.version || message.version === 1) {
        setState({
          content: message.content,
          mediaUri: null, // Handle via existing signed URL flow
          isDecrypting: false,
          error: null,
        });
        return;
      }

      // Version 2: E2EE - requires decryption
      if (message.version === 2) {
        if (!privateKeyJwk) {
          setState({
            content: null,
            mediaUri: null,
            isDecrypting: false,
            error: new Error('Encryption keys not available'),
          });
          return;
        }

        setState(prev => ({ ...prev, isDecrypting: true }));

        try {
          let content: string | null = null;
          
          if (message.encrypted_content) {
            content = await decryptTextMessage(
              message.encrypted_content,
              message.encryption_iv!,
              message.keys_metadata!,
              privateKeyJwk,
              !isMe
            );
          }

          setState({
            content,
            mediaUri: null, // Media handled separately via useDecryptedMedia
            isDecrypting: false,
            error: null,
          });
        } catch (err) {
          console.error('Failed to decrypt message:', err);
          setState({
            content: '[Unable to decrypt]',
            mediaUri: null,
            isDecrypting: false,
            error: err as Error,
          });
        }
      }
    }

    decrypt();
  }, [message.id, message.version, privateKeyJwk, isMe]);

  return state;
}
```

### Encryption Keys Hook

```typescript
// hooks/useEncryptionKeys.ts

import { useState, useEffect } from 'react';
import { getPrivateKey, hasKeyPair } from '../lib/encryption/keyManager';

interface EncryptionKeysState {
  privateKeyJwk: JsonWebKey | null;
  isLoading: boolean;
  hasKeys: boolean;
}

export function useEncryptionKeys(): EncryptionKeysState {
  const [state, setState] = useState<EncryptionKeysState>({
    privateKeyJwk: null,
    isLoading: true,
    hasKeys: false,
  });

  useEffect(() => {
    async function loadKeys() {
      try {
        const hasKeys = await hasKeyPair();
        if (hasKeys) {
          const privateKey = await getPrivateKey();
          setState({
            privateKeyJwk: privateKey,
            isLoading: false,
            hasKeys: true,
          });
        } else {
          setState({
            privateKeyJwk: null,
            isLoading: false,
            hasKeys: false,
          });
        }
      } catch (error) {
        console.error('Failed to load encryption keys:', error);
        setState({
          privateKeyJwk: null,
          isLoading: false,
          hasKeys: false,
        });
      }
    }

    loadKeys();
  }, []);

  return state;
}
```

---

## Edge Functions

### Pending Recipient Re-encryption

When a partner generates their keys after messages were already sent:

```typescript
// supabase/functions/reencrypt-pending-messages/index.ts

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

Deno.serve(async (req: Request) => {
  try {
    const { couple_id, new_recipient_user_id, new_recipient_public_key_jwk } = await req.json();
    
    // Get admin private key from environment
    const adminPrivateKeyJwk = JSON.parse(
      Deno.env.get('ADMIN_PRIVATE_KEY_JWK')!
    );

    // Find messages with pending_recipient = true for this couple
    const { data: matches } = await supabaseAdmin
      .from('matches')
      .select('id')
      .eq('couple_id', couple_id);

    const matchIds = matches?.map(m => m.id) || [];

    const { data: messages } = await supabaseAdmin
      .from('messages')
      .select('id, user_id, keys_metadata')
      .eq('version', 2)
      .in('match_id', matchIds);

    let updatedCount = 0;

    for (const message of messages || []) {
      const metadata = message.keys_metadata;
      
      // Only process if pending_recipient OR missing recipient key for this user
      if (!metadata.pending_recipient && metadata.recipient_wrapped_key) {
        continue;
      }

      // Unwrap AES key using admin key
      const rawAesKey = await unwrapWithAdminKey(
        metadata.admin_wrapped_key,
        adminPrivateKeyJwk
      );

      // Re-wrap for new recipient
      const recipientWrappedKey = await wrapForRecipient(
        rawAesKey,
        new_recipient_public_key_jwk
      );

      // Update message
      await supabaseAdmin
        .from('messages')
        .update({
          keys_metadata: {
            ...metadata,
            recipient_wrapped_key: recipientWrappedKey,
            pending_recipient: false,
          }
        })
        .eq('id', message.id);

      updatedCount++;
    }

    return new Response(
      JSON.stringify({ success: true, updated: updatedCount }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error re-encrypting messages:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});

async function unwrapWithAdminKey(
  wrappedKeyBase64: string,
  adminPrivateKeyJwk: JsonWebKey
): Promise<ArrayBuffer> {
  const privateKey = await crypto.subtle.importKey(
    'jwk',
    adminPrivateKeyJwk,
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    false,
    ['decrypt']
  );

  const wrappedKey = base64ToArrayBuffer(wrappedKeyBase64);
  return await crypto.subtle.decrypt(
    { name: 'RSA-OAEP' },
    privateKey,
    wrappedKey
  );
}

async function wrapForRecipient(
  rawAesKey: ArrayBuffer,
  recipientPublicKeyJwk: JsonWebKey
): Promise<string> {
  const publicKey = await crypto.subtle.importKey(
    'jwk',
    recipientPublicKeyJwk,
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    false,
    ['encrypt']
  );

  const wrappedKey = await crypto.subtle.encrypt(
    { name: 'RSA-OAEP' },
    publicKey,
    rawAesKey
  );

  return arrayBufferToBase64(wrappedKey);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
```

### Handle Key Rotation (Device Change)

When a user's public key changes (new device):

```typescript
// supabase/functions/handle-key-rotation/index.ts

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

Deno.serve(async (req: Request) => {
  try {
    const { user_id, new_public_key_jwk } = await req.json();
    
    // Get admin private key from environment
    const adminPrivateKeyJwk = JSON.parse(
      Deno.env.get('ADMIN_PRIVATE_KEY_JWK')!
    );

    // Get user's couple_id
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('couple_id')
      .eq('id', user_id)
      .single();

    if (!profile?.couple_id) {
      return new Response(
        JSON.stringify({ success: true, updated: 0, reason: 'No couple' }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Find all matches for this couple
    const { data: matches } = await supabaseAdmin
      .from('matches')
      .select('id')
      .eq('couple_id', profile.couple_id);

    const matchIds = matches?.map(m => m.id) || [];

    // Find all v2 messages in these matches
    const { data: messages } = await supabaseAdmin
      .from('messages')
      .select('id, user_id, keys_metadata')
      .eq('version', 2)
      .in('match_id', matchIds);

    let updatedCount = 0;

    for (const message of messages || []) {
      const metadata = message.keys_metadata;
      const isSender = message.user_id === user_id;

      // Unwrap AES key using admin key
      const rawAesKey = await unwrapWithAdminKey(
        metadata.admin_wrapped_key,
        adminPrivateKeyJwk
      );

      // Re-wrap with new public key
      const newWrappedKey = await wrapForRecipient(
        rawAesKey,
        new_public_key_jwk
      );

      // Update the appropriate field
      const updatedMetadata = { ...metadata };
      if (isSender) {
        updatedMetadata.sender_wrapped_key = newWrappedKey;
      } else {
        updatedMetadata.recipient_wrapped_key = newWrappedKey;
        updatedMetadata.pending_recipient = false;
      }

      await supabaseAdmin
        .from('messages')
        .update({ keys_metadata: updatedMetadata })
        .eq('id', message.id);

      updatedCount++;
    }

    return new Response(
      JSON.stringify({ success: true, updated: updatedCount }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error handling key rotation:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});

// ... include unwrapWithAdminKey, wrapForRecipient, base64 utils from above
```

---

## Admin Moderation Utility

```typescript
// Admin dashboard utility or Edge Function

export async function decryptForModeration(
  messageId: string,
  adminPrivateKeyJwk: JsonWebKey
): Promise<DecryptedContent> {
  
  // 1. Fetch message with admin privileges
  const { data: message } = await supabaseAdmin
    .from('messages')
    .select('*')
    .eq('id', messageId)
    .single();

  if (!message) {
    throw new Error('Message not found');
  }

  // 2. Version 1: Return plaintext directly
  if (!message.version || message.version === 1) {
    return {
      content: message.content,
      mediaUrl: message.media_path
        ? await getAdminSignedUrl(message.media_path)
        : null,
    };
  }

  // 3. Version 2: Decrypt with admin key
  const { admin_wrapped_key, admin_key_id } = message.keys_metadata;

  // Verify master key exists
  const { data: masterKey } = await supabaseAdmin
    .from('master_keys')
    .select('id')
    .eq('id', admin_key_id)
    .single();

  if (!masterKey) {
    throw new Error(`Master key ${admin_key_id} not found - may have been rotated`);
  }

  // Import admin private key
  const privateKey = await crypto.subtle.importKey(
    'jwk',
    adminPrivateKeyJwk,
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    false,
    ['decrypt']
  );

  // Unwrap AES key
  const rawAesKey = await crypto.subtle.decrypt(
    { name: 'RSA-OAEP' },
    privateKey,
    base64ToArrayBuffer(admin_wrapped_key)
  );

  // Import AES key
  const aesKey = await crypto.subtle.importKey(
    'raw',
    rawAesKey,
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  );

  // Decrypt text content
  let content: string | null = null;
  if (message.encrypted_content) {
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: base64ToArrayBuffer(message.encryption_iv) },
      aesKey,
      base64ToArrayBuffer(message.encrypted_content)
    );
    content = new TextDecoder().decode(plaintext);
  }

  // For media: download .enc file and decrypt similarly
  let mediaUrl: string | null = null;
  if (message.media_path && !message.media_expired) {
    // Implementation would download and decrypt the .enc file
    // Return a temporary signed URL or blob URL
  }

  return { content, mediaUrl };
}

async function getAdminSignedUrl(mediaPath: string): Promise<string> {
  const { data } = await supabaseAdmin.storage
    .from('chat-media')
    .createSignedUrl(mediaPath, 3600);
  return data?.signedUrl || '';
}
```

---

## Implementation Tasks

### Phase 1: Database & Infrastructure
| Task | Priority | Status |
|------|----------|--------|
| 1.1 Create migration: Add E2EE columns to `messages` table | High | ✅ |
| 1.2 Create migration: Add `public_key_jwk` to `profiles` table | High | ✅ |
| 1.3 Create migration: Create `master_keys` table with RLS policies | High | ✅ |
| 1.4 Generate master admin RSA-2048 key pair | High | ⬜ |
| 1.5 Insert master public key into `master_keys` table | High | ⬜ |
| 1.6 Store master private key in Supabase Edge Function secrets | High | ⬜ |
| 1.7 Update TypeScript types (`supabase.ts`) with new columns | High | ✅ |

### Phase 2: Crypto Library Integration
| Task | Priority | Status |
|------|----------|--------|
| 2.1 Install `react-native-quick-crypto@^0.7.x` | High | ✅ |
| 2.2 Run `npx expo prebuild --clean` for iOS and Android | High | ⬜ |
| 2.3 Update `metro.config.js` to resolve `crypto` module | High | ✅ |
| 2.4 Create `src/lib/encryption/` directory structure | High | ✅ |
| 2.5 Implement utility functions (base64, ArrayBuffer) | High | ✅ |
| 2.6 Test basic crypto operations work on device | High | ⬜ |

### Phase 3: Key Management
| Task | Priority | Status |
|------|----------|--------|
| 3.1 Implement `keyManager.ts` with key generation | High | ✅ |
| 3.2 Implement SecureStore chunked storage for private keys | High | ✅ |
| 3.3 Implement public key upload to Supabase profile | High | ✅ |
| 3.4 Create `useEncryptionKeys` hook | High | ✅ |
| 3.5 Add key initialization to app startup (auth flow) | High | ✅ |
| 3.6 Handle key generation when joining a couple | High | ✅ |

### Phase 4: Text Message Encryption
| Task | Priority | Status |
|------|----------|--------|
| 4.1 Implement `messageEncryption.ts` | High | ✅ |
| 4.2 Implement `messageDecryption.ts` | High | ✅ |
| 4.3 Implement `adminKeys.ts` (fetch active admin public key) | High | ✅ |
| 4.4 Update `ChatScreen.tsx` `handleSend` to encrypt text | High | ✅ |
| 4.5 Create `useDecryptedMessage` hook | High | ✅ |
| 4.6 Update message insert to include encryption fields | High | ✅ |

### Phase 5: Media Encryption
| Task | Priority | Status |
|------|----------|--------|
| 5.1 Implement `mediaEncryption.ts` (full file approach) | High | ✅ |
| 5.2 Implement `mediaDecryption.ts` (download-first) | High | ✅ |
| 5.3 Update `useMediaUpload.ts` to encrypt before upload | High | ✅ |
| 5.4 Update filename to use `.enc` extension | High | ✅ |
| 5.5 Update `MessageContent.tsx` for encrypted media handling | High | ✅ |
| 5.6 Implement decrypted media caching (avoid re-decrypting) | Medium | ✅ |

### Phase 6: Backwards Compatibility
| Task | Priority | Status |
|------|----------|--------|
| 6.1 Update `MessageContent.tsx` to check `version` field | High | ✅ |
| 6.2 Render v1 messages with existing plaintext flow | High | ✅ |
| 6.3 Render v2 messages with decryption flow | High | ✅ |
| 6.4 Add loading state while decrypting | Medium | ✅ |
| 6.5 Add error state for decryption failures | Medium | ✅ |
| 6.6 Test mixed v1/v2 message thread | High | ⬜ |

### Phase 7: Pending Recipient & Key Rotation
| Task | Priority | Status |
|------|----------|--------|
| 7.1 Handle sending when partner has no public key | Medium | ✅ |
| 7.2 Create `reencrypt-pending-messages` Edge Function | Medium | ✅ |
| 7.3 Trigger re-encryption when partner generates keys | Medium | ✅ |
| 7.4 Create `handle-key-rotation` Edge Function | Medium | ✅ |
| 7.5 Trigger key rotation when public_key_jwk changes | Medium | ⬜ |
| 7.6 Test end-to-end flow with new device | High | ⬜ |

### Phase 8: Admin Moderation
| Task | Priority | Status |
|------|----------|--------|
| 8.1 Implement `decryptForModeration` utility | Medium | ⬜ |
| 8.2 Create admin UI for message decryption (if needed) | Low | ⬜ |
| 8.3 Add audit logging for admin decryptions | Medium | ⬜ |
| 8.4 Test admin decryption of v1 and v2 messages | Medium | ⬜ |

### Phase 9: Testing & Polish
| Task | Priority | Status |
|------|----------|--------|
| 9.1 Unit tests for encryption/decryption functions | High | ⬜ |
| 9.2 Unit tests for key management | High | ⬜ |
| 9.3 Integration test: Send and receive encrypted text | High | ⬜ |
| 9.4 Integration test: Send and receive encrypted image | High | ⬜ |
| 9.5 Integration test: Send and receive encrypted video | High | ⬜ |
| 9.6 Test on low-end Android device (memory) | Medium | ⬜ |
| 9.7 Test key persistence across app restarts | High | ⬜ |
| 9.8 Test backward compatibility with existing messages | High | ⬜ |
| 9.9 Performance testing (encryption time for large videos) | Medium | ⬜ |

### Phase 10: Documentation & Deployment
| Task | Priority | Status |
|------|----------|--------|
| 10.1 Update CLAUDE.md with E2EE architecture notes | Medium | ⬜ |
| 10.2 Document key rotation procedure | Medium | ⬜ |
| 10.3 Document admin moderation procedure | Medium | ⬜ |
| 10.4 Create deployment checklist | Medium | ⬜ |
| 10.5 Deploy migrations to non-prod first | High | ⬜ |
| 10.6 Test on non-prod thoroughly | High | ⬜ |
| 10.7 Deploy to production | High | ⬜ |

---

## Utility Functions

```typescript
// utils.ts

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

export function chunkString(str: string, size: number): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < str.length; i += size) {
    chunks.push(str.slice(i, i + size));
  }
  return chunks;
}
```

---

## TypeScript Types

```typescript
// types.ts

export interface KeysMetadata {
  sender_wrapped_key: string;
  recipient_wrapped_key?: string;
  admin_wrapped_key: string;
  admin_key_id: string;
  algorithm: 'AES-256-GCM';
  key_wrap_algorithm: 'RSA-OAEP-SHA256';
  pending_recipient?: boolean;
}

export interface EncryptedMessagePayload {
  version: 2;
  encrypted_content: string;
  encryption_iv: string;
  keys_metadata: KeysMetadata;
}

export interface EncryptedMediaPayload {
  encryptedFileUri: string;
  encryption_iv: string;
  keys_metadata: KeysMetadata;
}

export interface DecryptedContent {
  content: string | null;
  mediaUrl: string | null;
}

export interface DecryptedMessageState {
  content: string | null;
  mediaUri: string | null;
  isDecrypting: boolean;
  error: Error | null;
}
```

---

## Security Considerations

### Key Storage
- Private keys stored in iOS Keychain / Android Keystore via SecureStore
- Keys accessible only when device is unlocked (`WHEN_UNLOCKED_THIS_DEVICE_ONLY`)
- Private keys never transmitted (except admin key stored in env)

### Device Change Recovery
- When user gets new device, old private key is lost
- Admin key used to re-wrap all message AES keys with new public key
- User regains access to all historical messages automatically

### Admin Access
- Admin can decrypt any message for moderation purposes
- Admin private key stored securely in environment variable
- Audit logging recommended for accountability

### Key Rotation (Admin)
- Old master keys archived (remain in `master_keys` table with `is_active: false`)
- Messages encrypted with old admin keys remain decryptable
- New messages use active master key

### Couple Breakup
- Both users retain their private keys
- Both can still decrypt their own sent/received messages
- No special handling required

---

## Future Enhancements

1. **Passphrase-based Key Backup**: Allow users to backup their private key encrypted with a passphrase to iCloud/Google Drive for manual recovery.

2. **Key Fingerprint Verification**: Show key fingerprints so partners can verify each other's identity out-of-band.

3. **Message Expiry**: Auto-delete decryption keys after a certain period for enhanced privacy.

4. **Multi-device Support**: Sync private keys across user's devices (requires secure key transfer protocol).

---

## Appendix: Admin Key Generation Script

Run this once to generate the initial admin RSA key pair:

```javascript
// scripts/generate-admin-keys.js
// Run with: node scripts/generate-admin-keys.js

const crypto = require('crypto');

async function generateAdminKeyPair() {
  const { publicKey, privateKey } = await crypto.subtle.generateKey(
    {
      name: 'RSA-OAEP',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['encrypt', 'decrypt']
  );

  const publicKeyJwk = await crypto.subtle.exportKey('jwk', publicKey);
  const privateKeyJwk = await crypto.subtle.exportKey('jwk', privateKey);

  console.log('=== PUBLIC KEY (store in master_keys table) ===');
  console.log(JSON.stringify(publicKeyJwk, null, 2));
  
  console.log('\n=== PRIVATE KEY (store in ADMIN_PRIVATE_KEY_JWK env var) ===');
  console.log(JSON.stringify(privateKeyJwk));
}

generateAdminKeyPair().catch(console.error);
```

**Important:** Keep the private key secure. Never commit it to version control.
