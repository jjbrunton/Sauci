---
id: 2026-08-30-ios-extension-version-verification
date: 2026-08-30
status: promoted
scope: iOS release artifact verification
evidence: build 45 Xcode archive warning plus direct PlistBuddy inspection of the exported IPA
destination: .codex/skills/release-mobile/SKILL.md
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

The archive warning described an intermediate state and was not authoritative
for the exported package. Direct IPA inspection showed both the app and
`LiveDrawWidget.appex` at version 1.0.6 build 45.

## Remediation

For every iOS release, inspect version and build values in the exported app and
all packaged extensions. Reject or rebuild only when the final IPA values differ;
do not accept or reject a release from archive warnings alone.

## Evidence

`PlistBuddy` read `CFBundleShortVersionString` 1.0.6 and `CFBundleVersion` 45 from
both packaged plists. `codesign --verify --deep --strict` passed for the app, and
the verified IPA SHA-256 was
`9d4779bddac4647911a3a38e4ee37cf794c2b8691e0746a041b629c62b308e7f`.
