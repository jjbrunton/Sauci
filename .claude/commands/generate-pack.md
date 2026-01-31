---
allowed-tools: Read, mcp__sauci-prod__execute_sql, mcp__sauci-prod__list_tables
argument-hint: <pack-name> --category=<category> [--count=30] [--premium] [--types=swipe,who_likely,audio,photo]
description: Generate a question pack for Sauci following established content guidelines
---

# Question Pack Generator

Generate a question pack: $ARGUMENTS

## Prerequisites

First, read the pack generation guidelines:
@PACK_GENERATION_AGENT.md

## Current State

- Existing categories: can be retrieved from supabase with query: SELECT name, id FROM categories ORDER BY sort_order
- Existing packs in target category: Will query once category is identified
- Existing props: can be retrieved with: SELECT DISTINCT unnest(required_props) as prop FROM questions WHERE required_props IS NOT NULL ORDER BY prop
- Current question type distribution in target pack (if adding to existing): SELECT question_type, count(*) FROM questions WHERE pack_id = '[pack_id]' AND deleted_at IS NULL GROUP BY question_type

## Task

Generate a complete question pack following all Sauci content guidelines.

### Step 1: Parse Arguments

Extract from $ARGUMENTS:
- **Pack name**: Required - the name for this pack
- **Category**: Required - which category this belongs to (or "new" to create)
- **Question count**: Optional - default 30, can be 25-50
- **Premium**: Optional flag - if pack should be premium
- **Types**: Optional - comma-separated question types to generate. Default: `swipe,who_likely,audio,photo`. Options: `swipe`, `who_likely`, `audio`, `photo`

### Step 2: Understand Context

1. If category exists, query existing packs to understand what's there:
   - What packs already exist?
   - What question types are represented?
   - Where does this new pack fit?

2. Check if category is explicit:
   ```sql
   SELECT id, name, is_explicit FROM categories WHERE name ILIKE '%<category>%';
   ```

3. Check the current type distribution if adding to an existing pack:
   ```sql
   SELECT question_type, count(*) FROM questions
   WHERE pack_id = '[pack_id]' AND deleted_at IS NULL
   GROUP BY question_type ORDER BY count DESC;
   ```

### Step 3: Generate Questions

Follow these rules strictly:

#### 3.1 Core Language Rules

- ALWAYS use "your partner" - NEVER use "me", "I", "you" (as receiver), "him", "her", or gendered pronouns
- Questions are PROPOSALS, NOT interview questions - "Give your partner a massage" not "Would you like to give a massage?"
- Avoid wishy-washy language - NO "Would you...", "Have you ever...", "Do you think...", "Maybe we could..."
- No time-specific words - NO "tonight", "now", "today", "right now"
- Keep concise: 5-12 words ideal
- Modern language for 25-40 year olds
- Avoid cheesy/cliche phrasing (candlelit dinner, rose petals, bubble bath, Netflix and chill)

#### 3.2 Tone Rules (based on category's is_explicit flag)

**For EXPLICIT categories (is_explicit = true):**
- Use tasteful phrasing for common acts: "Have sex in X" (not "fuck in X"), "Perform oral" or "go down on" (not crude oral terms)
- BUT keep crude/specific terms when they ARE the activity: "Cum on your partner's tits" (cum is the act), "Use a cock ring" (that's the name), "Edge until they beg"
- Rule: crude terms for specific acts/objects, tasteful terms for general sex/oral
- NEVER sanitize "cum" to "come" - they have different meanings

**For NON-EXPLICIT categories (is_explicit = false):**
- CRITICAL: No sexual acts, crude language, or NSFW content
- Keep language romantic, sensual, or playful without graphic terms

#### 3.3 Question Types

Each question MUST have a `question_type`. The default mix should include variety across types.

**`swipe`** (default) - Standard yes/no/maybe proposal
- The classic Sauci format
- Can be symmetric or asymmetric (with partner_text + inverse)
- Example: "Give your partner a back massage"

**`who_likely`** - "Who's more likely to..." format
- ALWAYS symmetric (partner_text = NULL, no inverse needed)
- Both partners pick who they think is more likely
- Match created when both answer
- Format: "Who is more likely to [activity/trait]?"
- Keep fun and lighthearted — these are conversation starters
- Examples:
  - "Who is more likely to cry during a movie?"
  - "Who is more likely to plan a surprise date?"
  - "Who is more likely to fall asleep first?"

**`audio`** - Voice recording prompt
- ALWAYS symmetric (partner_text = NULL, no inverse needed)
- Partners record a voice message in response
- `config`: `{"max_duration_seconds": 60}` (default 60)
- Great for: confessions, storytelling, impressions, compliments, singing
- Format: prompts that invite a spoken response
- Examples:
  - "Record your best impression of your partner"
  - "Describe your favourite memory together"
  - "Say something you've never told your partner"

**`photo`** - Photo prompt
- ALWAYS symmetric (partner_text = NULL, no inverse needed)
- Partners take or share a photo in response
- No special config needed
- Great for: selfies, throwbacks, showing something, creative challenges
- Format: prompts that invite a photo response
- Examples:
  - "Share a photo from your camera roll that makes you think of your partner"
  - "Take a selfie showing how you feel right now"
  - "Share a screenshot of your last text about your partner"

#### 3.4 Type Distribution Guidelines

For a standard 30-question pack, aim for roughly:
- **20-22 swipe** questions (the core experience)
- **4-5 who_likely** questions
- **2-3 audio** questions
- **2-3 photo** questions

Adjust based on what fits the pack's theme. Some packs may lean heavier on certain types.

#### 3.5 Partner Text Rules (swipe questions only)

- **NULL** for symmetric activities (both partners do the same thing together)
- **Filled** for asymmetric activities (one does something to/for the other)
  - `text` = what the INITIATOR does
  - `partner_text` = what the RECEIVER experiences

**Partner Text Quality:**
- Make partner_text APPEALING - don't just grammatically flip, make receiver feel excited
- When initiator causes a response (moan, cum, beg), frame as ALLOWING:
  - text: "Make your partner moan" -> partner_text: "Let your partner make you moan"
  - NOT: "Moan for your partner" (sounds forced, not natural)
- BAD: "Receive oral from your partner" (clinical)
- GOOD: "Let your partner pleasure you with their mouth" (enticing)

#### 3.6 Critical: Inverse Questions and Database Linking (swipe questions only)

Non-swipe types (who_likely, audio, photo) are ALWAYS symmetric — no inverse needed.

For EVERY asymmetric **swipe** question, create its inverse AND link them using the `inverse_of` column:

```
Original (PRIMARY - inverse_of = NULL):
  id: <generated_uuid_1>
  text: "Spank your partner"
  partner_text: "Be spanked by your partner"
  inverse_of: NULL

Inverse (SECONDARY - points to primary):
  id: <generated_uuid_2>
  text: "Be spanked by your partner"
  partner_text: "Spank your partner"
  inverse_of: <generated_uuid_1>
```

This ensures:
1. Both partners are asked about both roles
2. The database tracks which questions are inverses of each other
3. Accurate unique question counts (200 questions = 100 unique concepts with inverses)

#### 3.7 Intensity Guidelines

Each question still needs an `intensity` value (1-5) for backend filtering, even though it's not shown in the UI.

| Level | Name | Description | Examples |
|-------|------|-------------|----------|
| 1 | Gentle | Emotional bonding, non-sexual | cooking, cuddling, foot massage |
| 2 | Warm | Romantic, affectionate touch | slow dance, sensual massage, kissing |
| 3 | Playful | Light sexual exploration | oral, mutual masturbation, light roleplay |
| 4 | Steamy | Explicit sex, moderate adventure | intercourse, light bondage, anal play |
| 5 | Intense | Advanced/BDSM/extreme | impact play, power dynamics, taboo kinks |

#### 3.8 Targeting Rules

**Couple Targeting (allowed_couple_genders):**
- DEFAULT: null (ALL couples) unless explicit anatomical requirement
- Options: `['male+male', 'female+male', 'female+female']` or subset
- Restrict to `['male+male', 'female+male']` ONLY if activity requires penis (blowjob, handjob)
- Restrict to `['female+male', 'female+female']` ONLY if activity requires vagina (cunnilingus)
- Sex toys are GENDER-NEUTRAL (vibrators, dildos, plugs work for anyone) -> null

**Initiator Targeting (target_user_genders):**
- DEFAULT: null (anyone can initiate)
- Only for asymmetric swipe questions (those with partner_text)
- Set based on who does the action in "text" field
- When in doubt, use null

**Note:** who_likely, audio, and photo questions are always NULL for both targeting fields (they're symmetric and gender-neutral).

#### 3.9 Required Props

Identify physical items/accessories needed:
- Props are items like: blindfold, remote vibrator, handcuffs, massage oil, ice cubes
- Props are NOT body parts or acts
- Use lowercase, short, singular names
- Reuse existing prop names from catalog when possible
- Set to null if no props are required

### Step 4: Review & Validate

Before outputting, verify each question against this checklist:

**Language & Format:**
- [ ] Uses "your partner" (no gendered pronouns)
- [ ] Swipe questions are proposals, not interview questions
- [ ] No wishy-washy language
- [ ] No time-specific words
- [ ] 5-12 words (concise)
- [ ] No cheesy/cliche language
- [ ] Varied sentence structures

**Question Types:**
- [ ] who_likely questions use "Who is more likely to..." format
- [ ] audio questions prompt a natural spoken response
- [ ] photo questions prompt something visual and shareable
- [ ] Non-swipe types have partner_text = NULL and no inverse
- [ ] Type distribution is balanced (see 3.4)

**Structure:**
- [ ] All asymmetric swipe questions have inverses (these are NOT duplicates - they're required pairs)
- [ ] Partner text is appealing (not clinical)
- [ ] Partner text frames responses as "allowing" not forced
- [ ] No actual duplicates (same `text` appearing twice)

**Accuracy:**
- [ ] Intensity level matches the activity
- [ ] Couple targeting is correct (or null for universal)
- [ ] Initiator targeting is correct for asymmetric questions
- [ ] Required props are identified
- [ ] Considers same-sex couples

**Consistency:**
- [ ] No mixed anatomy in alternatives
- [ ] Tone matches explicit/non-explicit category
- [ ] Fits within the category

### Step 5: Output

Provide the pack in SQL format ready for insertion:

```sql
-- First, create the pack (get category_id from earlier query)
INSERT INTO question_packs (name, description, category_id, is_premium)
VALUES (
  '[Pack Name]',
  '[Description]',
  '[category_id]',
  false
)
RETURNING id;

-- Then insert questions
-- For swipe inverse pairs: insert primary first (inverse_of = NULL), then inverse pointing to primary

-- Swipe pair example
WITH pair1_primary AS (
  INSERT INTO questions (pack_id, text, partner_text, intensity, question_type, config, inverse_of)
  VALUES ('[pack_id]', 'Spank your partner', 'Be spanked by your partner', 3, 'swipe', '{}', NULL)
  RETURNING id
)
INSERT INTO questions (pack_id, text, partner_text, intensity, question_type, config, inverse_of)
SELECT '[pack_id]', 'Be spanked by your partner', 'Spank your partner', 3, 'swipe', '{}', id
FROM pair1_primary;

-- Symmetric swipe (no inverse needed)
INSERT INTO questions (pack_id, text, partner_text, intensity, question_type, config, inverse_of) VALUES
('[pack_id]', 'Cook dinner together', NULL, 1, 'swipe', '{}', NULL);

-- who_likely questions (always symmetric, no inverse)
INSERT INTO questions (pack_id, text, partner_text, intensity, question_type, config, inverse_of) VALUES
('[pack_id]', 'Who is more likely to plan a surprise date?', NULL, 1, 'who_likely', '{}', NULL),
('[pack_id]', 'Who is more likely to cry during a movie?', NULL, 1, 'who_likely', '{}', NULL);

-- audio questions (always symmetric, no inverse)
INSERT INTO questions (pack_id, text, partner_text, intensity, question_type, config, inverse_of) VALUES
('[pack_id]', 'Describe your favourite memory together', NULL, 1, 'audio', '{"max_duration_seconds": 60}', NULL),
('[pack_id]', 'Record your best impression of your partner', NULL, 1, 'audio', '{"max_duration_seconds": 60}', NULL);

-- photo questions (always symmetric, no inverse)
INSERT INTO questions (pack_id, text, partner_text, intensity, question_type, config, inverse_of) VALUES
('[pack_id]', 'Share a photo that makes you think of your partner', NULL, 1, 'photo', '{}', NULL);
```

Also provide a summary table:

| Metric | Value |
|--------|-------|
| Total questions | X |
| Unique question concepts | X (total - inverse count) |
| Swipe questions | X |
| who_likely questions | X |
| audio questions | X |
| photo questions | X |
| Symmetric (null partner_text) | X |
| Asymmetric swipe pairs (with inverse_of links) | X pairs (X questions) |
| With couple targeting | X |
| With initiator targeting | X |
| With required props | X |

## Example Usage

```
/generate-pack "Testing the Waters" --category="Public Thrills" --count=30
/generate-pack "Kink Discovery" --category="The Kink Lab" --count=50 --premium
/generate-pack "Staying Close" --category=new:"Long Distance" --count=30
/generate-pack "Date Night" --category="Quality Time" --types=who_likely,audio,photo
```

## Guidelines

- DO ask clarifying questions if the pack concept is unclear
- DO check existing packs in the category first
- DO create inverse questions for ALL asymmetric swipe content AND link them with inverse_of
- DO include a mix of question types (swipe, who_likely, audio, photo)
- DO vary sentence structure and openers
- DO use the inverse_of column to link inverse pairs (inverse points to primary's UUID)
- DON'T use cheesy or cliche language
- DON'T assume heterosexual couples
- DON'T skip the inverse question requirement for asymmetric swipe questions
- DON'T create inverses for who_likely, audio, or photo questions (they're always symmetric)
- DON'T forget to set question_type - every question needs one
- DON'T use interview-style questions ("Would you like to...")
- DON'T treat inverse pairs as duplicates - they are REQUIRED (one's `text` = other's `partner_text`)
