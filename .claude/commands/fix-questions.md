---
allowed-tools: Read, mcp__sauci-prod__execute_sql, mcp__sauci-prod__list_tables
argument-hint: <category name> [--all] [--explicit] [--apply] [--limit=100]
description: Review and automatically fix issues with questions (text, targeting, intensity, props, duplicates)
---

# Question Fix Agent

Fix questions in category: $ARGUMENTS

## Task Overview

Analyze questions across all packs in a category and apply fixes for issues across 5 dimensions:
1. **Text Phrasing** - Improve wording, remove wishy-washy language
2. **Audience Targeting** - Fix couple/initiator gender targeting
3. **Intensity Levels** - Correct misassigned intensity ratings
4. **Required Props** - Identify missing physical props/accessories
5. **Deletions** - Remove true duplicates, unsafe, or broken questions

## Step 1: Parse Arguments

Extract from $ARGUMENTS:
- **Category identifier**: Category name (partial match) OR category ID (UUID)
- **--all**: Flag indicating the agent should work through all categories sequentially
- **--explicit**: Flag indicating this is an explicit/adult category (auto-detected from category.is_explicit if not specified)
- **--apply**: If set, apply fixes automatically after review. If not set, just show suggestions.
- **--limit**: Max questions to analyze per category (default: 100)

## Step 2: Fetch Data

Query the database to get the category and its questions:

```sql
-- Get category info
SELECT id, name
FROM categories
WHERE id::text = '<category_id>' OR name ILIKE '%<category_name>%'
LIMIT 1;
```

```sql
-- Get all packs in the category
SELECT p.id, p.name, p.is_explicit
FROM question_packs p
WHERE p.category_id = '<category_id>'
ORDER BY p.name;
```

```sql
-- Get questions for all packs in the category
SELECT q.id, q.text, q.partner_text, q.intensity, q.allowed_couple_genders, q.target_user_genders, q.required_props, p.name as pack_name
FROM questions q
JOIN question_packs p ON q.pack_id = p.id
WHERE p.category_id = '<category_id>' AND q.deleted_at IS NULL
ORDER BY p.name, q.created_at
LIMIT <limit>;
```

```sql
-- Get existing props catalog for consistency
SELECT DISTINCT unnest(required_props) as prop
FROM questions
WHERE required_props IS NOT NULL
ORDER BY prop;
```

If **--all** flag is set, first list all categories:
```sql
SELECT id, name, is_explicit FROM categories ORDER BY name;
```
Then process each category sequentially.

## Step 3: Analyze Each Question

For each question, evaluate against these criteria:

### 3.1 Text Analysis

**Language Rules:**
- ALWAYS use "your partner" - NEVER use "me", "I", "you" (as receiver), "him", "her", or gendered pronouns
- Cards are PROPOSALS, NOT interview questions - "Give your partner a massage" not "Would you like to give a massage?"
- Avoid wishy-washy language - NO "Would you...", "Have you ever...", "Do you think...", "Maybe we could..."
- No time-specific words - NO "tonight", "now", "today", "right now"
- Keep concise - ideal length is 5-12 words

**Tone Rules (based on is_explicit):**

For EXPLICIT packs:
- Use tasteful phrasing for common acts: "Have sex in X" (not "fuck in X"), "Perform oral" or "go down on" (not crude oral terms)
- BUT keep crude/specific terms when they ARE the activity: "Cum on your partner's tits" (cum is the act), "Use a cock ring" (that's the name)
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

### 3.2 Intensity Analysis

Check if current intensity matches the activity:

| Level | Name | Description | Examples |
|-------|------|-------------|----------|
| 1 | Gentle | Emotional bonding, non-sexual | cooking, cuddling, foot massage |
| 2 | Warm | Romantic, affectionate touch | slow dance, sensual massage, kissing |
| 3 | Playful | Light sexual exploration | oral, mutual masturbation, light roleplay |
| 4 | Steamy | Explicit sex, moderate adventure | intercourse, light bondage, anal play |
| 5 | Intense | Advanced/BDSM/extreme | impact play, power dynamics, taboo kinks |

### 3.3 Targeting Analysis

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

### 3.4 Props Analysis

**Rules:**
- Props are physical items/accessories, not body parts or acts
- Use lowercase, short, singular names (e.g., "blindfold", "remote vibrator")
- Reuse existing prop names from the catalog when possible
- If no props are required, set to null

### 3.5 Deletion Analysis

**Deletion Categories:**
- `duplicate`: Same `text` AND same initiator as another question
- `redundant`: Minor variation with no added value
- `off-tone`: Violates explicit vs non-explicit rules
- `unsafe`: Coercion, minors, illegal acts, or consent violations
- `too-vague`: Not actionable or not a clear proposal
- `broken`: Grammar too broken to repair without inventing content
- `off-topic`: Not relevant to a couples intimacy app

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
- If you see two questions where one's `text` matches the other's `partner_text`, they are a VALID INVERSE PAIR
- Do NOT flag inverse pairs as duplicates or redundant
- Only flag as duplicate if TWO questions have the SAME `text` (or nearly identical `text`) with the SAME initiator role

**Rules:**
- Prefer edits over deletions when possible
- For true duplicates: delete the weaker/less specific version
- Do NOT delete for minor wording issues

## Step 4: Output Results

Present findings grouped by fix type:

### Summary

| Category | Issues Found | Will Fix |
|----------|--------------|----------|
| Text fixes | X | X |
| Intensity fixes | X | X |
| Targeting fixes | X | X |
| Props fixes | X | X |
| Deletions | X | X |
| No changes needed | X | - |

### Detailed Changes

For each question needing changes, show:

```
**Question ID:** <id>
**Current:** <text> / <partner_text or null>
**Issues:**
- Text: <issue description>
- Intensity: <current> -> <suggested> (<reason>)
- Targeting: <issue description>
- Props: <current> -> <suggested>
- DELETE: <category> - <reason>

**Fix:**
- Text: "<new text>"
- Partner Text: "<new partner_text>" or null
- Intensity: <new intensity>
- Couple Targets: <new allowed_couple_genders or null>
- Initiator Targets: <new target_user_genders or null>
- Required Props: <new required_props or null>
```

## Step 5: Apply Fixes (if --apply flag)

If --apply flag is set, execute the SQL updates:

```sql
-- Text/Partner Text/Intensity fixes
UPDATE questions SET
  text = '<new_text>',
  partner_text = '<new_partner_text>',
  intensity = <new_intensity>
WHERE id = '<question_id>';

-- Targeting fixes
UPDATE questions SET
  allowed_couple_genders = ARRAY['...'] or NULL,
  target_user_genders = ARRAY['...'] or NULL
WHERE id = '<question_id>';

-- Props fixes
UPDATE questions SET
  required_props = ARRAY['...'] or NULL
WHERE id = '<question_id>';

-- Deletions (soft delete)
UPDATE questions SET deleted_at = NOW() WHERE id IN ('<id1>', '<id2>', ...);
```

After applying, report:
- X questions updated
- X questions deleted
- Any errors encountered

If --apply is NOT set, output the SQL statements for manual review.

## Example Usage

```
/fix-questions "Kink"                                  # Review all questions in "Kink" category
/fix-questions "Romantic Classics" --apply             # Review and apply fixes to category
/fix-questions --all                                   # Process all categories sequentially
/fix-questions --all --apply                           # Process and fix all categories
/fix-questions 123e4567-e89b-12d3-a456-426614174000 --limit=50
```

## Guidelines

- DO ask for clarification if category name matches multiple categories
- DO group similar issues together for batch fixes
- DO prioritize safety issues (delete unsafe content first)
- DO preserve the core intent of questions when suggesting text fixes
- DO verify inverse pairs exist before flagging duplicates
- DON'T change questions that are already well-formed
- DON'T suggest overly restrictive targeting (prefer inclusive by default)
- DON'T create new prop names when existing ones match
- DON'T flag inverse pairs as duplicates (one's text = other's partner_text)
