---
id: 2026-08-28-mobile-release-source-integrity
date: 2026-08-28
status: promoted
scope: mobile release build and upload workflow
evidence: clean-source local EAS builds for iOS 43 and Android 46
destination: scripts/lint-harness.mjs
review_after: 2027-02-28
---

## Symptom

A build-only request initially regenerated tracked native projects. The generated
Android widget provider replaced the checked-in implementation, and the Android
release script would also have uploaded after building.

## Reproduction

Run the former mobile release scripts or run `expo prebuild` before a local EAS
build, then inspect `git diff`. The reproduced diff included the Android widget
provider, widget XML, and Xcode project rather than version metadata alone.

## Cause

The release scripts combined three independently reviewed operations: native
regeneration, artifact creation, and store upload. Sauci already tracks native
projects, and EAS skips prebuild when those directories exist.

## Remediation

Keep native regeneration explicit, make release scripts artifact-only, expose
upload separately, and lint the scripts so those responsibilities cannot be
silently recombined.

## Evidence

Corrected local EAS logs reported `PREBUILD` skipped. Both production artifacts
built successfully from the clean tracked sources; the post-build worktree
contained only the four expected build-number files. `npm run lint:harness`
enforces the release-script boundary.
