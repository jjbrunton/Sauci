# Plan: Remove E2EE and Switch to Server-Side Security

## Overview

This document outlines the plan to remove end-to-end encryption (E2EE) from Sauci's chat system and rely on Supabase's built-in security instead.

### Current State

- Messages are encrypted client-side using AES-256-GCM with triple-wrapped RSA keys
- Each message has sender, recipient, and admin wrapped keys
- Complex key management: generation, storage, rotation, recovery
- ~2500+ lines of encryption code across 21 files
- Edge functions handle key rotation and pending message re-encryption

### Target State

- Messages stored as plaintext in Supabase (protected by RLS policies)
- TLS encryption in transit (Supabase default)
- Encryption at rest (Supabase infrastructure)
- No client-side key management
- Simplified chat code

### Why Remove E2EE?

1. **Complexity** - Triple-wrapped keys, device recovery, key rotation adds significant maintenance burden
2. **Overkill** - For a couples intimacy app, server-side security is sufficient
3. **User Experience** - E2EE adds latency, recovery flows, and potential failure modes
4. **Development Velocity** - Simpler code = faster iteration

### Security Model After Removal

- **In Transit**: TLS 1.3 (Supabase default)
- **At Rest**: Supabase encrypts data at rest
- **Access Control**: RLS policies restrict access to couple's own messages
- **Admin Access**: Admins can read messages (same as current E2EE with admin key)

---

## Migration Strategy for Existing Messages

Existing v2 (encrypted) messages need handling. Options:

### Option A: Decrypt and Convert (Recommended)

Run a one-time migration to decrypt all v2 messages using admin key and store as v1 plaintext.

- Pros: Clean slate, no legacy code needed
- Cons: Requires admin private key, one-time effort

### Option B: Leave v2 Messages As-Is

Keep encrypted messages in database but stop creating new ones. Old messages become unreadable.

- Pros: Simpler migration
- Cons: Users lose access to old messages

### Option C: Hybrid Display

Keep decryption code for reading old v2 messages, but send new messages as v1.

- Pros: No data loss
- Cons: Maintains complexity, defeats purpose of removal

**Recommendation**: Option A - decrypt existing messages during migration window.

---

## Tasks

### Phase 1: Database Migration (Estimated: 2-3 hours)

#### Task 1.1: Create Migration to Decrypt Existing v2 Messages

Create an edge function that:

1. Fetches all messages with `version = 2`
2. Decrypts each using admin private key
3. Updates to `version = 1`, moves decrypted content to `content` column
4. Clears `encrypted_content`, `encryption_iv`, `keys_metadata`

**Files to create:**

- `apps/supabase/functions/migrate-e2ee-to-plaintext/index.ts`

#### Task 1.2: Run Migration

Execute the migration function against both non-prod and prod databases.

#### Task 1.3: Verify Migration

Query to confirm no v2 messages remain:

```sql
SELECT COUNT(*) FROM messages WHERE version = 2;
```

---

### Phase 2: Remove Client-Side Encryption Code (Estimated: 4-6 hours)

#### Task 2.1: Remove Encryption Library

Delete the entire encryption directory:

- `apps/mobile/src/lib/encryption/` (14 files)

**Files to delete:**

- `adminKeys.ts`
- `constants.ts`
- `crypto.ts`
- `index.ts`
- `keyManager.ts`
- `mediaDecryption.ts`
- `mediaEncryption.ts`
- `messageDecryption.ts`
- `messageEncryption.ts`
- `reencryptPendingMessages.ts`
- `repairStaleKey.ts`
- `triggerKeyRotation.ts`
- `types.ts`

#### Task 2.2: Remove Encryption Hooks

Delete the E2EE-specific hooks:

**Files to delete:**

- `apps/mobile/src/hooks/useDecryptedMessage.ts`
- `apps/mobile/src/hooks/useDecryptedMedia.ts`
- `apps/mobile/src/hooks/useEncryptedSend.ts`

#### Task 2.3: Simplify useEncryptionKeys Hook

Either delete entirely or convert to a no-op stub that returns `{ hasKeys: true }` for compatibility.

**File to modify/delete:**

- `apps/mobile/src/hooks/useEncryptionKeys.ts`

#### Task 2.4: Remove EncryptionKeyInitializer Component

Delete the component that initializes E2EE keys on app startup.

**File to delete:**

- `apps/mobile/src/components/EncryptionKeyInitializer.tsx`

#### Task 2.5: Remove from App Layout

Remove `EncryptionKeyInitializer` from the app layout.

**File to modify:**

- `apps/mobile/app/(app)/_layout.tsx`

---

### Phase 3: Simplify Chat Components (Estimated: 3-4 hours)

#### Task 3.1: Simplify ChatScreen.tsx

Remove:

- `useEncryptedSend` hook usage
- `encryptionKeys` from store
- `secureReady` checks
- Recovery UI (`encryptionKeys.isRecovering`)
- Encryption readiness blocking

Change message sending to use plaintext directly.

**File to modify:**

- `apps/mobile/src/features/chat/ChatScreen.tsx`

#### Task 3.2: Simplify MessageContent.tsx

Remove:

- `useDecryptedMessage` hook usage
- `useDecryptedMedia` hook usage
- Decryption loading states
- Decryption error states and retry buttons

Display `message.content` directly.

**File to modify:**

- `apps/mobile/src/features/chat/MessageContent.tsx`

#### Task 3.3: Simplify Media Upload

Remove encryption from media upload flow.

**File to modify:**

- `apps/mobile/src/hooks/useMediaUpload.ts`

Changes:

- Remove `encryptMediaFile` call
- Upload files directly without `.enc` extension
- Remove E2EE readiness checks

#### Task 3.4: Simplify InputBar (if applicable)

Remove any "security not ready" blocking logic.

**File to modify:**

- `apps/mobile/src/features/chat/InputBar.tsx`

---

### Phase 4: Clean Up State Management (Estimated: 1-2 hours)

#### Task 4.1: Remove encryptionKeys from Auth Store

Remove the entire `encryptionKeys` state object and related actions.

**File to modify:**

- `apps/mobile/src/store/authStore.ts`

Remove:

- `EncryptionKeyState` interface
- `encryptionKeys` state
- `setEncryptionKeys` action
- `beginEncryptionRecovery` / `endEncryptionRecovery` actions
- Reset logic in logout

---

### Phase 5: Remove Edge Functions (Estimated: 1 hour)

#### Task 5.1: Delete E2EE Edge Functions

Remove the edge functions that handle key rotation and re-encryption.

**Files to delete:**

- `apps/supabase/functions/handle-key-rotation/`
- `apps/supabase/functions/reencrypt-pending-messages/`

#### Task 5.2: Remove from Supabase Dashboard

If deployed, remove these functions from Supabase dashboard or let them remain (they won't be called).

---

### Phase 6: Database Cleanup (Optional) (Estimated: 1 hour)

#### Task 6.1: Remove E2EE Columns (Optional)

Create migration to drop unused columns. Can be deferred.

```sql
-- Optional cleanup migration
ALTER TABLE messages
  DROP COLUMN IF EXISTS encrypted_content,
  DROP COLUMN IF EXISTS encryption_iv,
  DROP COLUMN IF EXISTS keys_metadata;

ALTER TABLE messages
  DROP CONSTRAINT IF EXISTS messages_e2ee_fields_check;

ALTER TABLE profiles
  DROP COLUMN IF EXISTS public_key_jwk;

DROP TABLE IF EXISTS master_keys;
```

**Note**: Can leave columns in place - they'll just be NULL for new messages.

#### Task 6.2: Update Message Version Default

Ensure new messages use version 1 (or remove version concept entirely).

---

### Phase 7: Cleanup and Testing (Estimated: 2-3 hours)

#### Task 7.1: Remove Unused Dependencies

Check if `react-native-quick-crypto` can be removed (may be needed for other crypto).

**File to modify:**

- `apps/mobile/package.json`

#### Task 7.2: Update CLAUDE.md

Remove E2EE documentation section.

**File to modify:**

- `CLAUDE.md`

#### Task 7.3: Delete E2EE Documentation

Remove the E2EE implementation docs.

**File to delete:**

- `docs/e2ee-implementation.md`

#### Task 7.4: Update iOS Permission Strings

Remove "encrypted" from iOS permission descriptions. These strings mention encryption:

**File to modify:**

- `apps/mobile/app.json`

**Current strings (lines 26-27):**

```json
"NSCameraUsageDescription": "Sauci uses your camera to take photos and videos that you can share privately with your partner in encrypted chat messages.",
"NSPhotoLibraryUsageDescription": "Sauci uses your photo library so you can select photos and videos to share privately with your partner in encrypted chat messages.",
```

**Updated strings:**

```json
"NSCameraUsageDescription": "Sauci uses your camera to take photos and videos that you can share privately with your partner.",
"NSPhotoLibraryUsageDescription": "Sauci uses your photo library so you can select photos and videos to share privately with your partner.",
```

After updating `app.json`, run `npx expo prebuild --clean` to regenerate `ios/Sauci/Info.plist`.

#### Task 7.5: Full Testing

Test all chat functionality:

- [ ] Send text message
- [ ] Receive text message
- [ ] Send image
- [ ] Receive image
- [ ] Send video
- [ ] Receive video
- [ ] View old messages (post-migration)
- [ ] New user signup and chat
- [ ] Device change / reinstall

---

## File Summary

### Files to Delete (19 files)

```text
apps/mobile/src/lib/encryption/adminKeys.ts
apps/mobile/src/lib/encryption/constants.ts
apps/mobile/src/lib/encryption/crypto.ts
apps/mobile/src/lib/encryption/index.ts
apps/mobile/src/lib/encryption/keyManager.ts
apps/mobile/src/lib/encryption/mediaDecryption.ts
apps/mobile/src/lib/encryption/mediaEncryption.ts
apps/mobile/src/lib/encryption/messageDecryption.ts
apps/mobile/src/lib/encryption/messageEncryption.ts
apps/mobile/src/lib/encryption/reencryptPendingMessages.ts
apps/mobile/src/lib/encryption/repairStaleKey.ts
apps/mobile/src/lib/encryption/triggerKeyRotation.ts
apps/mobile/src/lib/encryption/types.ts
apps/mobile/src/hooks/useDecryptedMessage.ts
apps/mobile/src/hooks/useDecryptedMedia.ts
apps/mobile/src/hooks/useEncryptedSend.ts
apps/mobile/src/hooks/useEncryptionKeys.ts
apps/mobile/src/components/EncryptionKeyInitializer.tsx
docs/e2ee-implementation.md
```

### Files to Modify (8 files)

```text
apps/mobile/src/features/chat/ChatScreen.tsx
apps/mobile/src/features/chat/MessageContent.tsx
apps/mobile/src/features/chat/InputBar.tsx
apps/mobile/src/hooks/useMediaUpload.ts
apps/mobile/src/store/authStore.ts
apps/mobile/app/(app)/_layout.tsx
apps/mobile/app.json
CLAUDE.md
```

### Edge Functions to Delete (2 functions)

```text
apps/supabase/functions/handle-key-rotation/
apps/supabase/functions/reencrypt-pending-messages/
```

---

## Estimated Total Effort

| Phase                           | Estimated Time   |
| ------------------------------- | ---------------- |
| Phase 1: Database Migration     | 2-3 hours        |
| Phase 2: Remove Encryption Code | 4-6 hours        |
| Phase 3: Simplify Chat Components | 3-4 hours      |
| Phase 4: Clean Up State         | 1-2 hours        |
| Phase 5: Remove Edge Functions  | 1 hour           |
| Phase 6: Database Cleanup       | 1 hour (optional)|
| Phase 7: Testing                | 2-3 hours        |
| **Total**                       | **14-20 hours**  |

---

## Rollback Plan

If issues arise after deployment:

1. **Messages are preserved** - Content column still has plaintext for v1, migration preserves decrypted content
2. **Re-enable E2EE** - Git revert the client changes
3. **No data loss** - The migration only adds data (decrypts), doesn't delete

---

## Open Questions

1. **Timeline**: When to execute the migration? During maintenance window?
2. **Notification**: Should users be notified about the security model change?
3. **Privacy Policy**: Does the privacy policy mention E2EE? May need update.
4. **App Store**: Any App Store claims about E2EE that need updating?
