---
id: 2026-08-30-ios-extension-version-verification
date: 2026-08-30
status: promoted
scope: iOS release artifact verification
evidence: v1.0.6 exported IPA inspection and reproduced v1.0.7 Xcode build-setting mismatch
destination: apps/mobile/scripts/release-preflight.mjs and .codex/skills/release-mobile/SKILL.md
review_after: 2027-02-28
---

## Symptom

The signed iOS build logged that the widget extension build number 44 did not
match the containing app build number 45, even though export completed.

## Reproduction

Build iOS version 1.0.6 with EAS auto-increment from build 44 to 45 and retain the
archive log. Extract the resulting IPA with `ditto`, then read the containing app
and every packaged extension `Info.plist` with `PlistBuddy`.

## Cause

The v1.0.6 archive warning described an intermediate state and was not
authoritative for that exported package. The later v1.0.7 reproduction found a
separate real hazard: `CURRENT_PROJECT_VERSION` in both LiveDrawWidget
configurations can override the widget plist and package an older build number.

## Remediation

Before every iOS release, require public-version parity across app config, both
plists, and Xcode marketing settings. Require the widget Debug and Release
`CURRENT_PROJECT_VERSION` values to equal both plists. Then inspect the exported
app and all packaged extensions. Reject or rebuild only when the final IPA values
differ; do not accept or reject a release from archive warnings alone.

## Evidence

`PlistBuddy` read `CFBundleShortVersionString` 1.0.6 and `CFBundleVersion` 45 from
both v1.0.6 packaged plists. The v1.0.7 build later proved a stale widget Xcode
setting can survive plist-only review. `release-preflight.mjs` and its node test
now reject that mismatch before EAS allocation; exported IPA inspection remains
the final authority.
