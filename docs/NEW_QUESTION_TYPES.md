# Plan: Add New Question Types (Text, Audio, Photo, Who Is More Likely)

## Overview
Extend Sauci to support Candle-style question types while maintaining full backward compatibility with existing yes/no/maybe swipe questions.

## UI Simplification: Remove Swipe Gestures

**Remove all swipe gesture handling** from the question cards. Users will interact via buttons only:
- Simpler codebase (remove gesture handler complexity)
- More accessible
- Cleaner animations
- Buttons already exist and work well

### Files to Simplify:
- `apps/mobile/src/components/swipe/SwipeCard.native.tsx` - Remove gesture handlers, keep card display + buttons
- `apps/mobile/src/components/swipe/SwipeCard.web.tsx` - Remove PanResponder logic
- `apps/mobile/src/components/tutorials/SwipeTutorial.tsx` - Update or remove (no longer teaching swipe)
- `apps/mobile/src/lib/swipeTutorialSeen.ts` - Can be removed

## New Question Types

### 1. Text Answer Questions
- Example: "If you could be any animal, what would you be?"
- Text input field displayed inline on the card
- YES button disabled until text is entered
- Match when both partners submit text → chat shows both answers

### 2. Audio Questions
- Example: "Record a thoughtful message for your partner"
- Card has record/stop/preview states with waveform visualization
- Max 60 seconds (configurable)
- Match when both partners record → chat shows both with playback controls

### 3. Photo Questions
- Example: "Share the last picture you took of your partner that made you smile"
- Card shows Camera/Photo Library buttons, then preview after selection
- **Photos are permanent** (unlike expiring chat media)
- Match when both partners share → chat shows both photos

### 4. "Who Is More Likely" Questions
- Example: "Who is more likely to snore?"
- Shows both partner profile pictures as tappable buttons
- **Always creates match when both answered** → reveals what each person chose
- No skip option (must choose someone)

---

## Database Changes

### Migration: Add question_type support

```sql
-- 1. Question type enum
CREATE TYPE question_type AS ENUM ('swipe', 'text_answer', 'audio', 'photo', 'who_likely');

-- 2. Add columns to questions table
ALTER TABLE questions
  ADD COLUMN question_type question_type NOT NULL DEFAULT 'swipe',
  ADD COLUMN config JSONB DEFAULT '{}';

-- 3. Add response_data to responses table
ALTER TABLE responses
  ADD COLUMN response_data JSONB DEFAULT NULL;

-- 4. Extend match_type enum
ALTER TYPE match_type ADD VALUE IF NOT EXISTS 'both_answered';

-- 5. Add response_summary to matches table (stores both answers for display)
ALTER TABLE matches
  ADD COLUMN response_summary JSONB DEFAULT NULL;

-- 6. Create storage bucket for response media (audio + photos)
INSERT INTO storage.buckets (id, name, public)
VALUES ('response-media', 'response-media', false);

-- 7. RLS policies for response-media bucket (audio + photos)
```

---

## TypeScript Type Extensions

**packages/shared/src/types/index.ts:**

```typescript
// New question type
export type QuestionType = 'swipe' | 'text_answer' | 'audio' | 'photo' | 'who_likely';

// Extend Question interface
export interface Question {
  // ... existing fields ...
  question_type: QuestionType;
  config?: QuestionConfig;
}

// Question config by type
export interface QuestionConfig {
  max_duration_seconds?: number;  // For audio questions (default: 60)
}

// Response data by question type
export type ResponseData =
  | { type: 'text_answer'; text: string }
  | { type: 'audio'; media_path: string; duration_seconds: number }
  | { type: 'photo'; media_path: string }
  | { type: 'who_likely'; chosen_user_id: string };

// Extend Response interface
export interface Response {
  // ... existing fields ...
  response_data?: ResponseData | null;
}

// Extend Match interface
export interface Match {
  // ... existing fields ...
  response_summary?: Record<string, ResponseData> | null;
}
```

---

## Match Logic Per Question Type

| Type | YES/Confirm | NO | Skip | Match Condition |
|------|-------------|-----|------|-----------------|
| swipe | Record yes | Record no | No response | Both yes/maybe → yes_yes/yes_maybe/maybe_maybe |
| text_answer | Submit with text | Record no (blocks match) | No response | Both answered yes → both_answered |
| audio | Upload & submit | N/A | No response | Both recorded → both_answered |
| photo | Upload & submit | N/A | No response | Both shared → both_answered |
| who_likely | N/A | N/A | N/A | Both selected → both_answered |

**Key distinction:**
- `NO` = Records a "no" response, which **blocks** any future match on that question
- `Skip` = No response recorded, partner can still answer, match still possible if user returns later

---

## UI Components

### Card-Based UI (No Modals)

Each question type transforms the card itself rather than opening modals. The card adapts its content and buttons based on question type and current state.

---

### 1. Standard Swipe Questions (`question_type: 'swipe'`)
**Card content:**
- Question text
- Intensity indicator

**Buttons:** `YES` / `MAYBE` / `NO` + Skip

---

### 2. Text Answer Questions (`question_type: 'text_answer'`)
**Card content:**
- Question text
- **Text input field inline on the card**
- Intensity indicator

**Buttons:** `YES` (submit with text) / `NO` (decline) / Skip

**Behavior:**
- `YES` button is **disabled until text is entered**
- `NO` records a "no" response (blocks match)
- `Skip` moves on without recording any response

---

### 3. Audio Questions (`question_type: 'audio'`)

**State A - Ready to record:**
- Question text
- Waveform placeholder / microphone icon
- Recording duration limit indicator (e.g., "up to 60 seconds")

**Buttons:** `Record` / `Skip`

**State B - Recording:**
- Question text
- **Live waveform visualization**
- Recording timer (counting up)

**Buttons:** `Stop`

**State C - Preview:**
- Question text
- **Playback waveform with play/pause**
- Duration display

**Buttons:** `Confirm` / `Re-record` / `Cancel`

**Behavior:**
- `Record` starts audio capture, transitions to State B
- `Stop` ends recording, transitions to State C
- `Confirm` uploads audio and submits response
- `Re-record` discards recording, returns to State A
- `Cancel` discards recording, returns to State A (stays on question)
- `Skip` moves on without recording

**Storage:**
- Audio files stored in `response-media` bucket (same as photos)
- Format: AAC/M4A (native iOS/Android format, good compression)
- Max duration: 60 seconds (configurable per question via `config`)

---

### 4. Photo Questions (`question_type: 'photo'`)

**State A - Initial (no photo selected):**
- Question text
- Placeholder/prompt area

**Buttons:** `Camera` / `Skip` / `Photo Library`

**State B - Photo selected (preview):**
- Question text
- **Selected photo displayed in card**

**Buttons:** `Confirm` / `Retake` / `Cancel`

**Behavior:**
- `Confirm` uploads photo and submits response
- `Retake` goes back to State A (camera/picker choice)
- `Cancel` clears photo and returns to State A (stays on question)
- `Skip` (State A only) moves on without recording any response

---

### 5. Who Is More Likely (`question_type: 'who_likely'`)
**Card content:**
- Question text
- **Two large tappable partner avatar buttons**

**Buttons:** Partner avatars ARE the buttons (tap to select)

---

### Components to Create:

1. **`QuestionCard.tsx`** - Base card, handles `swipe` type (refactored from SwipeCard)
2. **`QuestionCardText.tsx`** - Card with inline text input
3. **`QuestionCardAudio.tsx`** - Card with record/preview states + waveform visualization
4. **`QuestionCardPhoto.tsx`** - Card with photo capture/preview states
5. **`QuestionCardWhoLikely.tsx`** - Card with partner avatar buttons
6. **`MatchCardTextAnswer.tsx`** - Display both text answers in match card
7. **`MatchCardAudio.tsx`** - Display both audio messages with playback controls
8. **`MatchCardPhoto.tsx`** - Display both photos in match card
9. **`MatchCardWhoLikely.tsx`** - Reveal who each person chose

### Components to Remove:

1. **`SwipeCard.native.tsx`** - Replaced by QuestionCard variants
2. **`SwipeCard.web.tsx`** - No longer needed
3. **`SwipeTutorial.tsx`** - No swipe gestures to teach

### Flow Changes:

**swipe.tsx** - Render correct card component by question type:
```typescript
switch (question.question_type) {
  case 'text_answer':
    return <QuestionCardText ... />
  case 'audio':
    return <QuestionCardAudio ... />
  case 'photo':
    return <QuestionCardPhoto ... />
  case 'who_likely':
    return <QuestionCardWhoLikely ... />
  default: // 'swipe'
    return <QuestionCard ... />
}
```

---

## Edge Function Changes

**submit-response/index.ts:**

```typescript
interface SubmitResponseBody {
  question_id: string;
  answer: Answer;
  response_data?: ResponseData;  // NEW
}

// After saving response, build match with response_summary
if (matchType) {
  const responseSummary = {
    [user.id]: currentResponse.response_data,
    [partnerId]: partnerResponse.response_data,
  };

  await supabase.from("matches").upsert({
    couple_id,
    question_id,
    match_type: matchType,
    response_summary: responseSummary,
    is_new: true,
  });
}
```

---

## Implementation Order

### Phase 0: Remove Swipe Gestures & Create Base Card
1. Create `QuestionCard.tsx` from `SwipeCard.native.tsx` (remove gesture handlers, keep buttons + card styling)
2. Delete `SwipeCard.native.tsx` and `SwipeCard.web.tsx`
3. Update imports in `swipe.tsx` to use new QuestionCard
4. Delete `SwipeTutorial.tsx` and related tutorial tracking
5. Test that button interactions still work for existing swipe-type questions

### Phase 1: Foundation
1. Create database migration with all schema changes
2. Update shared TypeScript types
3. Regenerate Supabase types (`npm run generate:types`)
4. Update submit-response edge function to accept response_data

### Phase 2: Text Answer Questions
1. Create `QuestionCardText` component with inline text input
2. Add disabled state logic for YES button (enabled only when text entered)
3. Extend MatchCard to display both text answers
4. Add sample text_answer questions via admin

### Phase 3: Audio Questions
1. Install `expo-av` for audio recording/playback (if not already installed)
2. Create `useAudioRecorder` hook (record, stop, get duration, get file URI)
3. Create `QuestionCardAudio` component with three states (ready / recording / preview)
4. Create waveform visualization component (can be simplified bars initially)
5. Extend MatchCard with `MatchCardAudio` for dual playback
6. Add sample audio questions via admin

### Phase 4: Photo Questions
1. Create response-media storage bucket and policies (shared with audio)
2. Create `useResponseMediaUpload` hook (adapt from existing media hooks)
3. Create `QuestionCardPhoto` component with two states (picker / preview)
4. Extend MatchCard to display both photos
5. Add sample photo questions via admin

### Phase 5: Who Is More Likely Questions
1. Create `QuestionCardWhoLikely` component with partner avatar buttons
2. Update swipe.tsx to render correct card type via switch statement
3. Extend MatchCard to show choice reveal
4. Add sample who_likely questions via admin

### Phase 6: Admin Dashboard
1. Add question_type selector to question creation form
2. Add config options per question type (e.g., max_duration_seconds for audio)

---

## Key Files to Modify

| File | Changes |
|------|---------|
| `packages/shared/src/types/index.ts` | Add QuestionType, ResponseData types |
| `apps/supabase/migrations/` | New migration for schema changes |
| `apps/supabase/functions/submit-response/index.ts` | Handle response_data, build response_summary |
| `apps/mobile/app/(app)/swipe.tsx` | Route to correct card component by question_type |
| `apps/mobile/src/components/swipe/SwipeCard.native.tsx` | Rename to QuestionCard, remove gesture handlers |
| `apps/mobile/src/components/swipe/SwipeCard.web.tsx` | Delete (no longer needed) |
| `apps/mobile/src/components/tutorials/SwipeTutorial.tsx` | Delete or repurpose as button tutorial |
| `apps/mobile/src/features/chat/components/MatchCard.tsx` | Display response_summary by type |
| `apps/admin/src/pages/QuestionsPage.tsx` | Add question_type field |

---

## Verification

1. **Existing questions**: Tap YES/NO/MAYBE on a regular question → verify it still works
2. **Text answer flow**: Create text_answer question → tap YES → type answer → partner does same → verify match shows both texts
3. **Audio flow**: Create audio question → record message → partner does same → verify match plays both recordings
4. **Photo flow**: Create photo question → tap YES → select photo → partner does same → verify match shows both photos
5. **Who is more likely**: Create who_likely question → tap choice → partner does same → verify reveal works
6. **Edge cases**: Test NO button on new question types (should skip, no match)
7. **Gestures removed**: Verify swipe gestures no longer work (buttons only)
8. **Audio permissions**: Test microphone permission request flow on iOS/Android
