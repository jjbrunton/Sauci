---
id: 2026-08-27-migration-context-conflict
date: 2026-08-27
status: promoted
scope: database migration instructions
evidence: root and scoped agent context comparison
destination: AGENTS.md and scripts/lint-harness.mjs
review_after: 2027-02-27
---

## Symptom

Root instructions prohibited remote migration application while scoped Supabase
instructions authorized it.

## Reproduction

Compare the former root `AGENTS.md` migration rule with the former
`apps/supabase/agents.md` migration section.

## Cause

Runtime-specific instruction files evolved independently without an executable
consistency check.

## Remediation

Make root context authoritative, scope only additional local rules, and reject
positive `apply_migration` instructions in the harness lint.

## Evidence

`npm run lint:harness` checks instruction consistency and the authoritative
migration location.
