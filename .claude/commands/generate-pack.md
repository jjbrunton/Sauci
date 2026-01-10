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

- Existing categories: !`mcp__sauci-prod__execute_sql` with query: SELECT name, id FROM categories ORDER BY sort_order
- Existing packs in target category: Will query once category is identified

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

2. If new category, establish the progression plan:
   - What will the beginner pack cover?
   - What will intermediate cover?
   - What will advanced cover?

### Step 3: Generate Questions

Follow these rules strictly:

#### Format Rules
- Questions are PROPOSALS, not interview questions
- Use "your partner" - never gendered pronouns
- No time-specific language (tonight, now, today)
- Keep concise: 5-15 words ideal
- Modern language for 25-40 year olds
- Avoid cheesy/cliche phrasing

#### Partner Text Rules
- **NULL** for symmetric activities (both do the same thing)
- **Filled** for asymmetric activities (different roles)

#### Critical: Inverse Questions
For EVERY asymmetric question, create its inverse:

```
Original:
  text: "Spank your partner"
  partner_text: "Be spanked by your partner"

Inverse (MUST CREATE):
  text: "Be spanked by your partner"
  partner_text: "Spank your partner"
```

This ensures both partners are asked about both roles.

#### Intensity Guidelines
- **1**: Non-sexual bonding (cooking, gaming, quality time)
- **2**: Romantic, flirty (kisses, cuddles, sweet messages)
- **3**: Light sexual (oral, mutual masturbation, basic toys)
- **4**: Explicit sexual (sex, light bondage, anal play)
- **5**: Intense/BDSM (impact play, power exchange, edge play)

### Step 4: Review & Validate

Before outputting, verify:
- [ ] All asymmetric questions have inverses
- [ ] No gendered pronouns
- [ ] No time-specific language
- [ ] Questions are proposals, not questions
- [ ] Intensity levels are accurate
- [ ] No cheesy language
- [ ] Varied sentence structures
- [ ] Considers same-sex couples
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

-- Then insert questions (use returned pack_id)
INSERT INTO questions (pack_id, text, partner_text, intensity) VALUES
('[pack_id]', 'Question text', 'Partner text or NULL', intensity),
-- ... all questions
```

Also provide a summary table:

| Metric | Value |
|--------|-------|
| Total questions | X |
| Intensity 1 | X |
| Intensity 2 | X |
| Intensity 3 | X |
| Intensity 4 | X |
| Intensity 5 | X |
| Symmetric (null partner_text) | X |
| Asymmetric (with inverses) | X pairs |

## Example Usage

```
/generate-pack "Testing the Waters" --category="Public Thrills" --intensity=2-3 --count=30
/generate-pack "Kink Discovery" --category="The Kink Lab" --intensity=3-5 --count=50
/generate-pack "Staying Close" --category=new:"Long Distance" --intensity=1 --count=30
```

## Guidelines

- DO ask clarifying questions if the pack concept is unclear
- DO check existing packs in the category first
- DO create inverse questions for ALL asymmetric content
- DO vary sentence structure and openers
- DON'T use cheesy or cliche language
- DON'T assume heterosexual couples
- DON'T skip the inverse question requirement
- DON'T use interview-style questions ("Would you like to...")
