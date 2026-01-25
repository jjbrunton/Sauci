# Admin Portal Plan: New Question Types + Category Multi-Content

## Context
- This plan scopes **admin portal** updates needed for the new question types defined in `docs/NEW_QUESTION_TYPES.md`.
- Categories now group **multiple content types** (question packs + dare packs), so admin UI should reflect multi-content counts and navigation.

## Goals
- Allow admins to **create, edit, and review** the new question types (`swipe`, `text_answer`, `audio`, `photo`, `who_likely`).
- Make type-specific configuration (ex: audio duration) visible and editable.
- Surface question type metadata in lists and analytics.
- Update category views to reflect multi-content grouping.

## Admin Changes: Questions Management

### 1) Data model updates (admin-side types + queries)
- Extend admin `Question` interfaces to include:
  - `question_type` (enum)
  - `config` (JSON)
- Ensure queries (list + edit + review) select `question_type` + `config`.

### 2) Question create/edit form
- Add **Question Type** selector with default `swipe`.
- Show **type-specific fields** below the selector:
  - `text_answer`: no extra config required (optional helper text).
  - `audio`: `max_duration_seconds` (default 60) stored in `config`.
  - `photo`: no extra config required (optional helper text).
  - `who_likely`: no extra config required (optional helper text).
- Persist `question_type` and `config` on create/update.
- Confirm which fields still apply to all types (intensity, partner text, props, targeting).

### 3) Question list + bulk actions
- Add a **Question Type** column with badge styling.
- Add filters for `question_type` (multi-select).
- Show `config` summaries where meaningful (ex: audio duration).
- Ensure bulk delete / selection still works with new columns.

### 4) AI generation + review flows
- **AI Generator**: add a question type selector (or keep `swipe` default and set `question_type` accordingly).
- **Review Questions dialog**:
  - Show question type in the review table.
  - Skip or adapt suggestions for non-swipe types (avoid AI suggesting “partner text” for audio/photo).

### 5) Question analytics
- Segment analytics by `question_type`.
- Add per-type counts in summary cards and charts (if present).

## Admin Changes: Category Multi-Content Grouping

### 1) Categories page
- Replace single `pack_count` with **multi-content counts**:
  - `question_pack_count`
  - `dare_pack_count`
- Update the category card UI to show both counts.
- Provide **two entry points** from each category:
  - View Question Packs
  - View Dare Packs

### 2) Pack list pages
- Ensure both `PacksPage` and `DarePacksPage` can be scoped by category.
- Keep category filters consistent between both pages.
- Consider a shared category “detail” header showing both counts.

## Dependencies / Open Questions
- Confirm whether `intensity` is required for non-swipe question types.
- Decide whether `partner_text` applies to `who_likely` or should be hidden.
- Align on any additional `config` fields beyond audio duration.

## QA Checklist
- Create each new question type in admin and confirm persistence.
- Verify question list filtering by type.
- Validate category cards show both pack counts and route correctly.
- Confirm analytics breakdown renders by question type.
