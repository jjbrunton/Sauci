---
id: 2026-09-05-question-type-contract-drift
date: 2026-09-05
status: promoted
scope: question interaction contract documentation
evidence: npm run lint:harness and npm run learn:check
destination: docs/question-types.md, scripts/lint-harness.mjs, AGENTS.md, and .codex/skills/question-pack/SKILL.md
review_after: 2026-12-05
---

## Symptom

Maintained documentation did not identify the implemented question interaction
types, their response payloads, or their matching semantics. The only detailed
reference was a historical implementation plan, so content and product work
could not rely on maintained documentation.

## Reproduction

Compare `QuestionType` in `packages/shared/src/types/index.ts` and the question
renderer and answer matching code with `docs/index.md`, `docs/schema.md`, and
`docs/question-selection.md`.

## Cause

The interaction contract was added to code without a maintained documentation
owner or a verification check linking the document to the canonical union.

## Remediation

Create `docs/question-types.md` as the maintained interaction contract. Require
agents and the question-pack workflow to update it with type or semantic
changes. Add a harness invariant that compares its type marker to the shared
`QuestionType` union.

## Evidence

`npm run lint:harness` reads the shared union and the documentation marker and
fails when their ordered type lists differ. `npm run learn:check` validates this
promoted learning record and its destination metadata.
