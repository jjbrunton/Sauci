# Match & Notification System

This document explains how matches are detected, stored, and how push notifications are triggered.

## Overview

A **match** occurs when both partners in a couple answer a question positively (not "no"). Matches unlock a chat thread for discussing that topic.

## Match Types

| Type | Partner A | Partner B | Description |
|------|-----------|-----------|-------------|
| `yes_yes` | Yes | Yes | Both enthusiastic |
| `yes_maybe` | Yes | Maybe | One enthusiastic, one open |
| `maybe_maybe` | Maybe | Maybe | Both open to exploring |

**No Match Cases:**
- Either partner answers "No" → No match created
- Only one partner has answered → No match yet (waiting)

## Match Detection Flow

```
┌─────────────────────────────────────────────────────────────┐
│                   submit-response Edge Function              │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ 1. Validate user JWT                                        │
│ 2. Get user's couple_id from profiles                       │
│ 3. UPSERT response (user_id, question_id, answer)           │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. Query partner's response for same question               │
│    SELECT answer FROM responses                             │
│    WHERE couple_id = ? AND question_id = ? AND user_id != ? │
└─────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
     Partner answered?                   No partner response
              │                               │
              ▼                               ▼
    calculateMatch(a1, a2)              Return { response }
              │                          (no match yet)
              ▼
┌─────────────────────────────────────────────────────────────┐
│ function calculateMatch(a1, a2):                            │
│   if (a1 === "no" || a2 === "no") return null               │
│   if (a1 === "yes" && a2 === "yes") return "yes_yes"        │
│   if (a1 === "maybe" && a2 === "maybe") return "maybe_maybe"│
│   return "yes_maybe"                                        │
└─────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
        Match type found                 null (no match)
              │                               │
              ▼                               ▼
┌──────────────────────────┐          Return { response }
│ UPSERT match record      │
│ (couple_id, question_id) │
└────────────┬─────────────┘
             │
             ▼
┌──────────────────────────┐
│ Invoke send-notification │
│ { couple_id, match_id }  │
└────────────┬─────────────┘
             │
             ▼
      Return { response, match }
```

## Match Storage

```sql
CREATE TABLE public.matches (
    id UUID PRIMARY KEY,
    couple_id UUID NOT NULL REFERENCES couples(id),
    question_id UUID NOT NULL REFERENCES questions(id),
    match_type match_type NOT NULL,  -- yes_yes, yes_maybe, maybe_maybe
    is_new BOOLEAN DEFAULT TRUE,      -- For notification badge
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(couple_id, question_id)    -- One match per question per couple
);
```

**UPSERT Behavior:**
Matches use `onConflict: "couple_id,question_id"` so if a user changes their answer, the match type updates rather than creating duplicates.

## Push Notifications

### Match Notification (`send-notification`)

Triggered when a new match is created.

**Input:**
```json
{ "couple_id": "uuid", "match_id": "uuid" }
```

**Behavior:**
1. Fetch all profiles in couple with push tokens
2. Build notification for both partners:
   ```javascript
   {
       to: profile.push_token,
       title: "It's a match! 💕",
       body: "You and your partner matched on something new!",
       sound: "default",
       data: { match_id, type: "match" }
   }
   ```
3. Send via Expo Push API

**Privacy:** Notification content is generic - doesn't reveal the question topic.

### Message Notification (`send-message-notification`)

Triggered when a chat message is sent.

**Input:**
```json
{ "match_id": "uuid", "sender_id": "uuid" }
```

**Behavior:**
1. Find the match's couple_id
2. Get recipient's push token (partner, not sender)
3. Build notification:
   ```javascript
   {
       to: recipient.push_token,
       title: "New message",
       body: "Your partner sent you a message",
       sound: "default",
       data: { type: "message", match_id, message_id }
   }
   ```
4. Send via Expo Push API

**Privacy:** Message content not included in notification.

## Client State Management

### Match Store (`src/store/index.ts`)

```typescript
interface MatchState {
    matches: Match[];
    newMatchesCount: number;
    fetchMatches: () => Promise<void>;
    markAsSeen: (matchId: string) => Promise<void>;
    markAllAsSeen: () => Promise<void>;
    addMatch: (match: Match) => void;
    clearMatches: () => void;
}
```

### Fetching Matches

The `fetchMatches` function:
1. Queries matches with joined question data
2. Fetches all responses to determine who answered first (for two-part display)
3. Counts unread messages per match
4. Calculates new matches count (where `is_new = true`)

```typescript
const { data: matches } = await supabase
    .from("matches")
    .select(`*, question:questions(*)`)
    .order("created_at", { ascending: false });
```

### Match Display

The matches screen shows:
- Question text (user's version for two-part questions)
- Partner's question text (if two-part)
- Match type badge (`YES + YES` or `YES + MAYBE`)
- Unread message indicator
- Date

**Two-Part Question Display Logic:**
```typescript
// Determine which text each person saw based on response timestamps
if (userResponse.created_at > partnerResponse.created_at) {
    userText = question.partner_text;    // User was second
    partnerText = question.text;         // Partner was first
}
```

## Chat System

Each match unlocks a chat thread stored in `messages` table:

```sql
CREATE TABLE public.messages (
    id UUID PRIMARY KEY,
    match_id UUID NOT NULL REFERENCES matches(id),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    content TEXT,
    media_path TEXT,  -- Storage path for images
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ,
    CONSTRAINT content_or_media CHECK (content IS NOT NULL OR media_path IS NOT NULL)
);
```

### Real-Time Chat

Messages use Supabase Realtime:
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
```

### Message Read Tracking

- `read_at` is `NULL` for unread messages
- Updated when recipient opens chat thread
- Used to calculate unread counts and badges

## Notification Flow Diagram

```
User A swipes "Yes"
        │
        ▼
submit-response
        │
        ├──▶ Save response
        │
        ├──▶ Check partner response
        │         │
        │         ▼
        │    Partner said "Yes"?
        │         │
        │         ▼
        │    Create match (yes_yes)
        │         │
        └─────────┼──▶ Invoke send-notification
                  │
                  ▼
        ┌─────────────────────┐
        │  Expo Push Service  │
        └─────────────────────┘
                  │
        ┌─────────┴─────────┐
        ▼                   ▼
   User A Phone        User B Phone
   "It's a match!"     "It's a match!"
```

## RLS Policies

Users can only see matches for their couple:

```sql
CREATE POLICY "Users can view their couple matches"
    ON public.matches FOR SELECT
    USING (
        couple_id IN (
            SELECT couple_id FROM profiles WHERE id = auth.uid()
        )
    );
```

## Badge Management

### New Match Badge

- Set to `is_new = TRUE` on match creation
- Updated to `FALSE` when user views matches screen
- Count displayed on tab bar badge

```typescript
// On matches screen focus
useEffect(() => {
    if (matches.length > 0) {
        markAllAsSeen();  // Clears is_new flags
    }
}, [matches.length]);
```

### Unread Message Badge

- Counted per match from messages where `read_at IS NULL`
- Displayed as bubble on match card
- Cleared when entering chat thread
