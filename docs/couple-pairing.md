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

Unpaired and Waiting are not dead ends: both states can answer questions
immediately through the standalone API (`POST /v1/responses`). See
[Solo answering and sealed answers](#solo-answering-and-sealed-answers) below.

## Solo answering and sealed answers

An Unpaired or Waiting user answers straight into the swipe flow instead of
being blocked until a partner joins. `responses.couple_id` is nullable
(`apps/api/drizzle/0022_solo_sealed_answers.sql`): a response submitted with no
couple is inserted with `couple_id IS NULL` and is called a **sealed answer**.
It is banked, not lost, and counts toward the daily response limit like any
other answer, but no match reconciliation runs for it (there is no partner
response to compare against).

`GET /v1/couple` reports `sealed_count`, the caller's count of responses with
`couple_id IS NULL`, alongside `couple` and `partner`, so the client can show
"N sealed answers" before and while waiting to pair. `POST /v1/responses` also
returns `sealed_count` in its response body for a solo submission (its `match`
is always `null`).

### Claim on pair

`PostgresCoupleRepository.join()` (`apps/api/src/domains/couples/repository.ts`)
is the only place membership grows from one member to two. In the same
transaction that adds the second member, it:

1. Reassigns every sealed answer (`couple_id IS NULL`) belonging to either
   member to the new couple.
2. For every question where both members now have an answer, computes the
   match type with the same rule `calculateMatchType` uses for live answers
   and upserts into `matches` (respecting the `(couple_id, question_id)`
   uniqueness), so a couple's history of solo answers surfaces as matches the
   moment they pair, not only for answers given after pairing.

A user who re-pairs after their previous couple was deleted only has
`couple_id IS NULL` answers left to claim (the old couple's responses were
cascade-deleted with it), which this handles the same way as first-time
pairing.

### Push nudge escalation

The unpaired push reminder (`apps/api/src/domains/operations/repository.ts`,
`produce()`) reads each eligible recipient's sealed count and leads with it
once it is greater than zero: "You have N sealed answers waiting. Invite your
partner to unlock what you said about them." Recipients with no sealed
answers yet see the original invite-code copy. The existing 3-day cadence and
18:00-local gate are unchanged.

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

## Invite Funnel (Join Links)

The invite code can also be delivered as a tappable link instead of requiring
the recipient to type it in manually.

**Link forms:**
- Universal/App Link: `https://sauci.app/join/{code}` (served by `apps/web`,
  opens the app directly on a device that has it installed and verified).
- Custom scheme: `app.sauci://join?code={code}` (used by the web join page's
  automatic hand-off attempt, and remains supported for any existing client
  behavior).

**Web fallback (`apps/web/app/join/[code]/page.tsx`):** validates the code
shape client-side only (8-character alphanumeric; never calls a private API),
attempts the custom scheme link, and otherwise shows the code with a copy
button plus App Store / Play Store links. Copying only copies the raw code.

**Association files:** `apps/web/public/.well-known/apple-app-site-association`
and `apps/web/public/.well-known/assetlinks.json` authorize `sauci.app` to open
the app for `/join/*`. The Apple Team ID (`BXVPBATDZY`, from
`apps/mobile/app.json` and `apps/mobile/eas.json`) and bundle/package id
(`com.sauci.app`) are real values already used elsewhere in the repo. The
SHA-256 fingerprint in `assetlinks.json` is the Play App Signing key
certificate fingerprint from the Play Console (Test and release > Setup >
App signing); if the app signing key ever rotates, this file must be updated
or Android App Links will stop verifying.

**Mobile link handling:** `apps/mobile/app.json` declares
`associatedDomains: ["applinks:sauci.app"]` (iOS) and an intent filter for
`https://sauci.app/join/*` (Android), in addition to the existing `app.sauci`
scheme. `apps/mobile/app/_layout.tsx` parses incoming URLs
(`src/lib/inviteLink.ts`) and either routes a signed-in, onboarded user
straight to the pairing screen with the code pre-filled, or stashes the code
(`src/lib/pendingInviteCode.ts`) for signed-out/mid-onboarding users. The
stashed code is applied once the user reaches the pairing screen or the app's
initial route (`apps/mobile/app/index.tsx`) after sign-in/onboarding
completes.

**Deferred clipboard hand-off:** if an unpaired user opens the pairing screen
with no code from a link or stash, the app checks the clipboard once per
session (`src/lib/clipboardInviteOffer.ts`) for a string matching the invite
code shape and offers to use it ("Use code XXXXXXXX from your clipboard?").
The code is never applied automatically; the user must accept the offer.

**Analytics:** `invite_link_opened` (`source`: `universal_link` | `scheme` |
`clipboard`), `pairing_code_prefilled` (mobile, Firebase Analytics), and
`join_page_viewed` / `join_page_code_copied` / `join_page_store_button_clicked`
(web, PostHog).

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
