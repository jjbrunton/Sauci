# Question Selection Algorithm

This document explains how questions are selected and ordered for users in the swipe interface.

## Overview

Question selection happens in two stages:
1. **Database Layer** - `get_recommended_questions()` PostgreSQL function filters available questions
2. **Client Layer** - `swipe.tsx` applies additional filtering and sorting with bias

## Stage 1: Database Filtering

The `get_recommended_questions(target_pack_id)` function (`apps/supabase/migrations/20251227172500_role_specific_questions.sql`) returns questions the user hasn't answered yet.

### Pack Selection Logic

```
IF target_pack_id provided:
    → Use only that specific pack
ELSE IF couple has any couple_packs entries:
    → Use only packs where enabled = true
ELSE (new couple, no preferences set):
    → Use all public packs (is_public = true)
```

### Question Filtering

For each question in active packs:
- **Excluded**: Questions the current user has already answered
- **Included**: All unanswered questions from active packs

### Returned Fields

| Field | Description |
|-------|-------------|
| `id` | Question UUID |
| `text` | Display text (see two-part logic below) |
| `partner_text` | Original partner text (for reference) |
| `is_two_part` | `true` if question has different text for second responder |
| `pack_id` | Parent pack UUID |
| `intensity` | 1-5 rating |
| `partner_answered` | `true` if partner has already responded |

### Two-Part Questions

Some questions have role-specific text (`partner_text` column). The function handles this:

```
IF partner_text EXISTS AND partner has answered:
    → Return partner_text as display text
ELSE:
    → Return original text
```

This enables questions like:
- First person sees: "Would you like your partner to wake you up with oral?"
- Second person sees: "Would you wake your partner up with oral?"

## Stage 2: Client Sorting & Filtering

Located in `apps/mobile/app/(app)/swipe.tsx`, lines 57-95.

### Skip Filtering

Before sorting, questions are filtered against locally-skipped questions:

```typescript
const filtered = data.filter(q => !skippedIds.has(q.id));
```

**Skip behavior** (`src/lib/skippedQuestions.ts`):
- Swipe down = skip question
- Skipped questions hidden for **24 hours**
- Stored in SecureStore (native) or localStorage (web)
- No server-side record - purely client-side convenience

### Sorting Algorithm with Bias

Questions are sorted by a computed score:

```typescript
const sorted = filtered.sort((a, b) => {
    let scoreA = Math.random();  // Base: 0.0 - 1.0
    let scoreB = Math.random();

    // Apply bias bonuses
    if (a.partner_answered && a.is_two_part) scoreA += 1.5;
    else if (a.partner_answered) scoreA += 0.7;
    else if (a.is_two_part) scoreA += 0.4;

    // Same for scoreB...

    return scoreB - scoreA;  // Descending order
});
```

### Priority Tiers

| Priority | Condition | Score Range | Rationale |
|----------|-----------|-------------|-----------|
| **1st** | `partner_answered` + `is_two_part` | 1.5 - 2.5 | Completes two-part question, immediate match potential |
| **2nd** | `partner_answered` only | 0.7 - 1.7 | High match potential, partner waiting |
| **3rd** | `is_two_part` only | 0.4 - 1.4 | Initiates two-part sequence |
| **4th** | Neither | 0.0 - 1.0 | Standard questions, fully randomized |

### Why This Bias?

1. **Engagement**: Questions partner already answered can immediately create matches, providing instant gratification

2. **Two-part completion**: When partner answered a two-part question first, completing it quickly maintains context and creates better matches

3. **Two-part initiation**: Slightly prioritizes two-part questions to create more engaging interactions

4. **Randomization within tiers**: The random base prevents predictable ordering while maintaining priority bands

## Visual Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    get_recommended_questions()               │
│  ┌─────────────┐    ┌──────────────┐    ┌───────────────┐  │
│  │ Pack Filter │ → │ User Answered │ → │ Two-Part Text │   │
│  │             │    │   Exclusion   │    │  Resolution   │   │
│  └─────────────┘    └──────────────┘    └───────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                     Client (swipe.tsx)                       │
│  ┌─────────────┐    ┌──────────────┐    ┌───────────────┐  │
│  │ Skip Filter │ → │ Bias Scoring │ → │     Sort      │   │
│  │  (24 hour)  │    │              │    │  (Descending) │   │
│  └─────────────┘    └──────────────┘    └───────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              ↓
                    Questions shown to user
```

## Edge Cases

| Scenario | Behavior |
|----------|----------|
| No packs enabled | Shows "No packs enabled" prompt |
| All questions answered | Shows "All caught up!" with refresh button |
| No partner paired | Shows pairing prompt |
| Pack disabled mid-session | Client filters out questions from disabled packs |

## Configuration

| Setting | Value | Location |
|---------|-------|----------|
| Skip duration | 24 hours | `src/lib/skippedQuestions.ts:6` |
| Two-part + answered bias | +1.5 | `swipe.tsx:78` |
| Answered-only bias | +0.7 | `swipe.tsx:79` |
| Two-part-only bias | +0.4 | `swipe.tsx:80` |
