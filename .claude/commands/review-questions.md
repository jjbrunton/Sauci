---
allowed-tools: Read, mcp__sauci-prod__execute_sql, mcp__sauci-prod__list_tables
argument-hint: <pack-name-or-id> [--explicit] [--limit=100]
description: Review and fix questions for text, targeting, intensity, props, and duplicates
---

# Question Review Command

Review and validate questions: $ARGUMENTS

## Task Overview

Analyze questions for issues and suggest fixes across 6 dimensions:
1. **Text Phrasing** - Improve wording, remove wishy-washy language
2. **Audience Targeting** - Fix couple/initiator gender targeting
3. **Intensity Levels** - Correct misassigned intensity ratings
4. **Required Props** - Identify missing physical props/accessories
5. **Inverse Linking** - Detect and link inverse question pairs using inverse_of column
6. **Deletions** - Flag duplicates, redundant, or broken questions

## Step 1: Parse Arguments

Extract from $ARGUMENTS:
- **Pack identifier**: Pack name (partial match) OR pack ID (UUID)
- **--explicit**: Flag indicating this is an explicit/adult pack (default: false if not specified)
- **--limit**: Max questions to analyze (default: 100)

## Step 2: Fetch Questions

Query the database:

```sql
-- If pack name provided (include inverse_of for pair detection):
SELECT q.id, q.text, q.partner_text, q.intensity, q.allowed_couple_genders, q.target_user_genders, q.required_props, q.inverse_of
FROM questions q
JOIN question_packs p ON q.pack_id = p.id
WHERE p.name ILIKE '%<pack_name>%' AND q.deleted_at IS NULL
ORDER BY q.created_at
LIMIT <limit>;

-- If pack ID provided:
SELECT id, text, partner_text, intensity, allowed_couple_genders, target_user_genders, required_props, inverse_of
FROM questions
WHERE pack_id = '<pack_id>' AND deleted_at IS NULL
ORDER BY created_at
LIMIT <limit>;
```

Also fetch existing props for consistency:
```sql
SELECT DISTINCT unnest(required_props) as prop
FROM questions
WHERE required_props IS NOT NULL
ORDER BY prop;
```

## Step 3: Determine Content Type

Check if the pack is explicit:
```sql
SELECT p.name, c.is_explicit
FROM question_packs p
JOIN categories c ON p.category_id = c.id
WHERE p.id = '<pack_id>' OR p.name ILIKE '%<pack_name>%'
LIMIT 1;
```

Use this to set the content type rules below.

## Step 4: Analyze Questions

For each question, evaluate against these criteria:

### 4.1 Text Analysis

**Language Rules:**
- ALWAYS use "your partner" - NEVER use "me", "I", "you" (as receiver), "him", "her", or gendered pronouns
- Cards are PROPOSALS, NOT interview questions - "Give your partner a massage" not "Would you like to give a massage?"
- Avoid wishy-washy language - NO "Would you...", "Have you ever...", "Do you think...", "Maybe we could..."
- No time-specific words - NO "tonight", "now", "today", "right now"
- Keep concise - ideal length is 5-12 words

**Tone Rules (based on explicit flag):**

For EXPLICIT packs:
- Use tasteful phrasing for common acts: "Have sex in X" (not "fuck in X"), "Perform oral" or "go down on" (not crude oral terms)
- BUT keep crude/specific terms when they ARE the activity: "Cum on your partner's tits" (cum is the act), "Use a cock ring" (that's the name)
- Rule: crude terms for specific acts/objects, tasteful terms for general sex/oral
- NEVER sanitize "cum" to "come" - they have different meanings

For NON-EXPLICIT packs:
- CRITICAL: No sexual acts, crude language, or NSFW content
- Keep language romantic, sensual, or playful without graphic terms
- Flag explicit content for removal

**Partner Text Rules:**
- NULL for symmetric activities (both partners do the same thing together)
- FILLED for asymmetric activities (one does something to/for the other)
- text = what the INITIATOR does
- partner_text = what the RECEIVER experiences
- Make partner_text APPEALING - frame receiver's experience positively
- When initiator causes a response (moan, cum, beg), frame as ALLOWING:
  - text: "Make your partner moan" -> partner_text: "Let your partner make you moan"
  - NOT: "Moan for your partner" (sounds forced)

### 4.2 Intensity Analysis

Check if current intensity matches the activity:

| Level | Name | Description | Examples |
|-------|------|-------------|----------|
| 1 | Gentle | Emotional bonding, non-sexual | cooking, cuddling, foot massage |
| 2 | Warm | Romantic, affectionate touch | slow dance, sensual massage, kissing |
| 3 | Playful | Light sexual exploration | oral, mutual masturbation, light roleplay |
| 4 | Steamy | Explicit sex, moderate adventure | intercourse, light bondage, anal play |
| 5 | Intense | Advanced/BDSM/extreme | impact play, power dynamics, taboo kinks |

### 4.3 Targeting Analysis

**Couple Targeting (allowed_couple_genders):**
- DEFAULT: null (ALL couples) unless explicit anatomical requirement
- Restrict to `['male+male', 'female+male']` ONLY if activity requires penis
- Restrict to `['female+male', 'female+female']` ONLY if activity requires vagina
- Sex toys are GENDER-NEUTRAL (vibrators, dildos, plugs work for anyone)

**Initiator Targeting (target_user_genders):**
- DEFAULT: null (anyone can initiate)
- Only for asymmetric questions (those with partner_text)
- Set based on who does the action in "text" field:
  - "Swallow your partner's cum" -> partner has penis -> initiator: ['female'] in M+F
  - "Deep throat your partner" -> partner has penis -> ['female'] in M+F
  - "Give your partner a massage" -> gender-neutral -> null

### 4.4 Props Analysis

**Rules:**
- Props are physical items/accessories, not body parts or acts
- Use lowercase, short, singular names (e.g., "blindfold", "remote vibrator")
- Reuse existing prop names from the catalog when possible
- If no props are required, set to null

### 4.5 Inverse Linking Analysis

**Purpose:** Detect inverse question pairs and link them using the `inverse_of` database column.

**Detection:**
1. For each asymmetric question (has partner_text), look for its inverse:
   - Inverse exists if another question has: `text` = this question's `partner_text` AND `partner_text` = this question's `text`
2. Check if the `inverse_of` column is correctly set

**Fixes:**
- If pair exists but not linked: set inverse_of on the second question to point to the first
- Symmetric questions should have inverse_of = NULL

### 4.6 Deletion Analysis

**Deletion Categories:**
- `duplicate`: Same core action as another question
- `redundant`: Minor variation with no added value
- `off-tone`: Violates explicit vs non-explicit rules
- `unsafe`: Coercion, minors, illegal acts, or consent violations
- `too-vague`: Not actionable or not a clear proposal
- `broken`: Grammar too broken to repair without inventing content
- `off-topic`: Not relevant to a couples intimacy app

**Rules:**
- Prefer edits over deletions when possible
- For duplicates: delete the weaker/less specific version
- Do NOT delete for minor wording issues

**CRITICAL: Inverse Questions are NOT Duplicates**

Asymmetric questions MUST exist in pairs (original + inverse). These are NOT duplicates:

```
Question A:
  text: "Spank your partner"
  partner_text: "Be spanked by your partner"

Question B (INVERSE - NOT A DUPLICATE):
  text: "Be spanked by your partner"
  partner_text: "Spank your partner"
```

These are intentionally paired so both partners get asked about both roles. When reviewing:
- If you see two questions where one's `text` matches the other's `partner_text`, they are a valid inverse pair
- Do NOT flag inverse pairs as duplicates or redundant
- Only flag as duplicate if TWO questions have the SAME `text` (or nearly identical `text`)

## Step 5: Output Results

Present findings in a structured format:

### Summary
| Category | Count |
|----------|-------|
| Text fixes | X |
| Intensity fixes | X |
| Targeting fixes | X |
| Props fixes | X |
| Inverse linking fixes | X |
| Deletions suggested | X |
| No changes needed | X |

### Suggested Changes

For each question needing changes:

```
**Question ID:** <id>
**Current Text:** <text>
**Current Partner Text:** <partner_text or null>
**Current Intensity:** <intensity>
**Current inverse_of:** <uuid or null>

Issues Found:
- [ ] Text: <description of issue>
- [ ] Intensity: <current> -> <suggested> (<reason>)
- [ ] Targeting: <description>
- [ ] Props: <current> -> <suggested>
- [ ] Inverse Link: <missing/broken> - <inverse question id if found>
- [ ] DELETE: <category> - <reason>

Suggested Fix:
- Text: "<new text>"
- Partner Text: "<new partner_text>" or null
- Intensity: <new intensity>
- Couple Targets: <new allowed_couple_genders or null>
- Initiator Targets: <new target_user_genders or null>
- Required Props: <new required_props or null>
- inverse_of: <uuid or null>
```

### SQL to Apply Fixes

After user approval, provide UPDATE statements:

```sql
-- Text/Partner Text/Intensity fixes
UPDATE questions SET
  text = '<new_text>',
  partner_text = '<new_partner_text>',
  intensity = <new_intensity>
WHERE id = '<question_id>';

-- Targeting fixes
UPDATE questions SET
  allowed_couple_genders = '<new_targets>',
  target_user_genders = '<new_initiator>'
WHERE id = '<question_id>';

-- Props fixes
UPDATE questions SET
  required_props = ARRAY[<new_props>]
WHERE id = '<question_id>';

-- Inverse linking fixes
UPDATE questions SET inverse_of = '<primary_question_id>' WHERE id = '<inverse_question_id>';

-- Deletions (soft delete)
UPDATE questions SET deleted_at = NOW() WHERE id IN ('<id1>', '<id2>', ...);
```

## Example Usage

```
/review-questions "Foreplay Favorites"
/review-questions "Kink Discovery" --explicit
/review-questions 123e4567-e89b-12d3-a456-426614174000 --limit=50
```

## Guidelines

- DO ask for clarification if pack name matches multiple packs
- DO group similar issues together for batch fixes
- DO prioritize safety issues (delete unsafe content first)
- DO preserve the core intent of questions when suggesting text fixes
- DO detect and link inverse pairs using the inverse_of column
- DON'T change questions that are already well-formed
- DON'T suggest overly restrictive targeting (prefer inclusive by default)
- DON'T create new prop names when existing ones match
- DON'T flag inverse pairs as duplicates (one's text = other's partner_text)
- DON'T forget to set inverse_of for detected inverse pairs
