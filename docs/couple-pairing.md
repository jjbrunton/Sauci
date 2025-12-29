# Couple Pairing System

This document explains how couples are created, joined, and managed in Sauci.

## Overview

Couples are the core relationship unit in Sauci. Two users link via an invite code to form a couple, enabling shared question answering and match detection.

## States

A user can be in one of three states:

| State | `couple_id` | `partner` | Description |
|-------|-------------|-----------|-------------|
| **Unpaired** | `null` | `null` | Not in any couple |
| **Waiting** | Set | `null` | Created couple, waiting for partner |
| **Paired** | Set | Exists | Both partners joined |

## Edge Functions

### `manage-couple` (POST)

Handles creating and joining couples.

**Create Couple** (empty body):
```javascript
// Request
{ }

// Response
{ success: true, couple_id: "uuid", invite_code: "abc12345" }
```

**Join Couple** (with invite code):
```javascript
// Request
{ invite_code: "abc12345" }

// Response
{ success: true, couple_id: "uuid" }
```

**Validations:**
- User cannot already be in a couple
- Invite code must exist
- Target couple must have < 2 members

### `manage-couple` (DELETE)

Leaves current couple (sets `couple_id` to null).

```javascript
// Response
{ success: true }
```

### `delete-relationship` (DELETE)

**Destructive** - Completely deletes the couple and all associated data.

**What Gets Deleted:**
1. Chat media from storage (iterates through all match folders)
2. Both partners' `couple_id` set to `null`
3. Couple record deleted (cascades to):
   - All responses
   - All matches
   - All messages
   - All couple_packs settings

## Database Schema

### Couple Record

```sql
CREATE TABLE public.couples (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invite_code TEXT UNIQUE DEFAULT substr(md5(random()::text), 1, 8),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Invite Code:**
- 8 character hex string (e.g., `a1b2c3d4`)
- Auto-generated on insert
- Case-insensitive matching (lowercased on lookup)

### Profile Link

```sql
-- profiles table
couple_id UUID REFERENCES couples(id) ON DELETE SET NULL
```

When a couple is deleted, both profiles automatically have `couple_id` set to `null` (preserving accounts).

### Size Enforcement

Database trigger prevents > 2 members per couple:

```sql
CREATE TRIGGER enforce_couple_size
BEFORE INSERT OR UPDATE OF couple_id ON profiles
FOR EACH ROW EXECUTE FUNCTION check_couple_size();

-- Raises exception if count >= 2
```

This prevents race conditions where multiple users try to join simultaneously.

## Client Flow

### Pairing Screen (`app/(app)/pairing.tsx`)

**Unpaired State:**
```
┌─────────────────────────────┐
│        🔗 Pair Up           │
│                             │
│  ┌───────────────────────┐  │
│  │ Have a code?          │  │
│  │ [Enter invite code]   │  │
│  │ [Join Partner]        │  │
│  └───────────────────────┘  │
│                             │
│         ── or ──            │
│                             │
│     [Create New Code]       │
└─────────────────────────────┘
```

**Waiting State:**
```
┌─────────────────────────────┐
│      ❤️ Partner Code        │
│                             │
│   Share this code with      │
│   your partner              │
│                             │
│   ┌───────────────────┐     │
│   │   ABC12345   📋   │     │
│   └───────────────────┘     │
│                             │
│      [Share Code]           │
│                             │
│  Waiting for partner...     │
│         ⏳                   │
└─────────────────────────────┘
```

### Real-Time Partner Detection

When waiting for partner, the screen listens for updates:

```typescript
// Polling fallback every 5 seconds
const pollInterval = setInterval(() => {
    fetchCouple();
}, 5000);

// Real-time subscription
const subscription = supabase
    .channel(`couple-${couple.id}`)
    .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "profiles",
        filter: `couple_id=eq.${couple.id}`,
    }, async (payload) => {
        if (payload.new.id !== user?.id) {
            await fetchCouple();
        }
    })
    .subscribe();
```

### Auto-Redirect

When partner is detected, user is redirected:

```typescript
useEffect(() => {
    if (couple && partner) {
        router.replace("/(app)/");
    }
}, [couple, partner]);
```

## Flow Diagrams

### Create & Share Flow

```
User A: Unpaired
    │
    ▼
[Create New Code]
    │
    ▼
POST manage-couple (empty body)
    │
    ├──▶ Create couple record
    │    (generates invite_code)
    │
    ├──▶ Set user A's couple_id
    │
    ▼
User A: Waiting
    │
    ├──▶ Display invite code
    │
    ├──▶ [Share Code] → Native share sheet
    │
    └──▶ Subscribe to realtime + poll
```

### Join Flow

```
User B: Unpaired
    │
    ▼
[Enter Code] → "abc12345"
    │
    ▼
POST manage-couple { invite_code: "abc12345" }
    │
    ├──▶ Validate code exists
    │
    ├──▶ Check couple has < 2 members
    │
    ├──▶ Set user B's couple_id
    │
    ▼
User B: Paired
    │
    ├──▶ Realtime event fires
    │
    ▼
User A: Receives update → Paired
```

### Delete Relationship Flow

```
User: Profile → Settings → Delete Relationship
    │
    ▼
Confirmation Dialog
    │
    ▼
DELETE delete-relationship
    │
    ├──▶ List all matches for couple
    │
    ├──▶ Delete chat-media storage files
    │
    ├──▶ Set both profiles.couple_id = null
    │
    ├──▶ DELETE couple record
    │    (cascades to responses, matches, messages, couple_packs)
    │
    ▼
Both users: Unpaired
```

## Cascade Behavior

When a couple is deleted, foreign key cascades clean up:

| Table | Action |
|-------|--------|
| `profiles` | `couple_id` set to `null` |
| `responses` | Rows deleted |
| `matches` | Rows deleted |
| `messages` | Rows deleted |
| `couple_packs` | Rows deleted |

Storage (chat-media) is manually cleaned before the cascade.

## Error Handling

| Error | Cause | Message |
|-------|-------|---------|
| Already paired | User tries to create/join while in couple | "You are already in a couple" |
| Invalid code | Invite code doesn't exist | "Invalid invite code" |
| Couple full | Couple already has 2 members | "This couple already has two partners" |
| DB trigger | Race condition caught | "A couple can only have 2 members" |
