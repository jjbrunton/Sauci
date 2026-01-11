---
allowed-tools: Read, mcp__sauci-prod__execute_sql, mcp__sauci-prod__list_tables
argument-hint: <pack-name> --category=<category> --intensity=<min-max> [--count=30] [--premium]
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

## Task

Generate a complete question pack following all Sauci content guidelines.

### Step 1: Parse Arguments

Extract from $ARGUMENTS:
- **Pack name**: Required - the name for this pack
- **Category**: Required - which category this belongs to (or "new" to create)
- **Intensity range**: Required - e.g., "2-3", "3-4", "4-5"
- **Question count**: Optional - default 30, can be 25-50
- **Premium**: Optional flag - if pack should be premium

### Step 2: Understand Context

1. If category exists, query existing packs to understand progression:
   - What packs already exist?
   - What intensity levels are covered?
   - Where does this new pack fit in the progression?

2. Check if category is explicit:
   ```sql
   SELECT id, name, is_explicit FROM categories WHERE name ILIKE '%<category>%';
   ```

3. If new category, establish the progression plan:
   - What will the beginner pack cover?
   - What will intermediate cover?
   - What will advanced cover?

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
- If intensity 3+ activities are needed, use suggestive but not explicit language

#### 3.3 Partner Text Rules

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

#### 3.4 Critical: Inverse Questions and Database Linking

For EVERY asymmetric question, create its inverse AND link them using the `inverse_of` column:

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

**Database Schema:**
- `inverse_of` column: UUID referencing the primary question's ID
- Primary questions have `inverse_of = NULL`
- Inverse questions have `inverse_of = <primary_question_id>`

#### 3.5 Intensity Guidelines

| Level | Name | Description | Examples |
|-------|------|-------------|----------|
| 1 | Gentle | Emotional bonding, non-sexual | cooking, cuddling, foot massage |
| 2 | Warm | Romantic, affectionate touch | slow dance, sensual massage, kissing |
| 3 | Playful | Light sexual exploration | oral, mutual masturbation, light roleplay |
| 4 | Steamy | Explicit sex, moderate adventure | intercourse, light bondage, anal play |
| 5 | Intense | Advanced/BDSM/extreme | impact play, power dynamics, taboo kinks |

#### 3.6 Targeting Rules

**Couple Targeting (allowed_couple_genders):**
- DEFAULT: null (ALL couples) unless explicit anatomical requirement
- Options: `['male+male', 'female+male', 'female+female']` or subset
- Restrict to `['male+male', 'female+male']` ONLY if activity requires penis (blowjob, handjob)
- Restrict to `['female+male', 'female+female']` ONLY if activity requires vagina (cunnilingus)
- Sex toys are GENDER-NEUTRAL (vibrators, dildos, plugs work for anyone) -> null

**Initiator Targeting (target_user_genders):**
- DEFAULT: null (anyone can initiate)
- Only for asymmetric questions (those with partner_text)
- Set based on who does the action in "text" field:
  - "Swallow your partner's cum" -> partner has penis -> initiator: `['female']` in M+F couples
  - "Deep throat your partner" -> partner has penis -> `['female']` in M+F couples
  - "Give your partner a massage" -> gender-neutral -> null
- When in doubt, use null

**Anatomical Consistency:**
- NEVER mix male-specific and female-specific acts as alternatives
- BAD: "Finger or give your partner a handjob" (mixed anatomy)
- GOOD: Pick one activity per question

#### 3.7 Required Props

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
- [ ] Is a proposal, not an interview question
- [ ] No wishy-washy language
- [ ] No time-specific words
- [ ] 5-12 words (concise)
- [ ] No cheesy/cliche language
- [ ] Varied sentence structures

**Structure:**
- [ ] All asymmetric questions have inverses (these are NOT duplicates - they're required pairs)
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
- [ ] Fits progression within category

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

-- Then insert questions with inverse_of linking
-- For inverse pairs: insert primary first (inverse_of = NULL), then inverse pointing to primary

-- Generate UUIDs for inverse pairs upfront
-- Pair 1: Primary and its inverse
WITH pair1_primary AS (
  INSERT INTO questions (pack_id, text, partner_text, intensity, inverse_of)
  VALUES ('[pack_id]', 'Spank your partner', 'Be spanked by your partner', 3, NULL)
  RETURNING id
)
INSERT INTO questions (pack_id, text, partner_text, intensity, inverse_of)
SELECT '[pack_id]', 'Be spanked by your partner', 'Spank your partner', 3, id
FROM pair1_primary;

-- Symmetric questions (no inverse_of needed)
INSERT INTO questions (pack_id, text, partner_text, intensity, allowed_couple_genders, target_user_genders, required_props, inverse_of) VALUES
('[pack_id]', 'Symmetric question text', NULL, 2, NULL, NULL, NULL, NULL);

-- Or bulk insert with explicit UUIDs for pairs:
INSERT INTO questions (id, pack_id, text, partner_text, intensity, inverse_of) VALUES
-- Pair 1
('uuid-primary-1', '[pack_id]', 'Give your partner a massage', 'Receive a massage from your partner', 2, NULL),
('uuid-inverse-1', '[pack_id]', 'Receive a massage from your partner', 'Give your partner a massage', 2, 'uuid-primary-1'),
-- Pair 2
('uuid-primary-2', '[pack_id]', 'Blindfold your partner', 'Be blindfolded by your partner', 3, NULL),
('uuid-inverse-2', '[pack_id]', 'Be blindfolded by your partner', 'Blindfold your partner', 3, 'uuid-primary-2'),
-- Symmetric (no pair)
(gen_random_uuid(), '[pack_id]', 'Cook dinner together', NULL, 1, NULL);
```

**Field notes:**
- `inverse_of`: NULL for primary/symmetric questions, UUID of primary question for inverses
- `allowed_couple_genders`: NULL for all couples, or array like `ARRAY['male+male', 'female+male']`
- `target_user_genders`: NULL for any initiator, or array like `ARRAY['female']`
- `required_props`: NULL if no props needed, or array like `ARRAY['blindfold', 'ice cubes']`

Also provide a summary table:

| Metric | Value |
|--------|-------|
| Total questions | X |
| Unique question concepts | X (total - inverse count) |
| Intensity 1 | X |
| Intensity 2 | X |
| Intensity 3 | X |
| Intensity 4 | X |
| Intensity 5 | X |
| Symmetric (null partner_text) | X |
| Asymmetric pairs (with inverse_of links) | X pairs (X questions) |
| With couple targeting | X |
| With initiator targeting | X |
| With required props | X |

## Example Usage

```
/generate-pack "Testing the Waters" --category="Public Thrills" --intensity=2-3 --count=30
/generate-pack "Kink Discovery" --category="The Kink Lab" --intensity=3-5 --count=50
/generate-pack "Staying Close" --category=new:"Long Distance" --intensity=1 --count=30
```

## Guidelines

- DO ask clarifying questions if the pack concept is unclear
- DO check existing packs in the category first
- DO create inverse questions for ALL asymmetric content AND link them with inverse_of
- DO vary sentence structure and openers
- DO use the inverse_of column to link inverse pairs (inverse points to primary's UUID)
- DON'T use cheesy or cliche language
- DON'T assume heterosexual couples
- DON'T skip the inverse question requirement
- DON'T forget to set inverse_of - this is how we track unique question concepts
- DON'T use interview-style questions ("Would you like to...")
- DON'T treat inverse pairs as duplicates - they are REQUIRED (one's `text` = other's `partner_text`)
