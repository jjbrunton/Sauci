---
id: 2026-08-31-mobile-release-preflight-and-attempts
date: 2026-08-31
status: promoted
scope: mobile production release preparation and local EAS builds
evidence: v1.0.7 Android and iOS local EAS release investigation and verified artifacts
destination: apps/mobile/scripts/release-preflight.mjs, apps/mobile/scripts/release-preflight.test.mjs, docs/releasing.md, and release skills
review_after: 2027-02-28
---

## Symptom

The v1.0.7 release spent repeated attempts on archive, plugin startup, package
installation, disk-space, signing, and iOS extension-version failures before
valid Android and iOS artifacts were accepted.

## Reproduction

Run a local production EAS build with an ignored public OTA certificate, a
package-directory plugin path, insufficient disk space, or divergent widget
`CURRENT_PROJECT_VERSION`. Each condition fails or produces an invalid input
before a valid final artifact can be accepted.

## Cause

Pre-compilation setup failures were treated as rebuild failures. Source parity,
archive inclusion, local EAS plugin shape, disk capacity, and effective iOS widget
build settings were not checked together before EAS allocation.

## Remediation

Run the deterministic mobile release preflight before every production build.
Classify attempts before retrying: archive, plugin, npm, and ENOSPC failures do
not consume a native build; signing, profile, and capability failures require
provider read-back before one replacement build. Retain work directories and logs
at stable ignored paths. Accept only independently inspected artifacts and keep
rejected artifacts out of the upload path.

The Android native input failure was a Gradle task ordering issue: Prefab inputs
must be available before dependent native tasks. Preserve the explicit ordering
fix rather than removing Firebase or changing dependency versions without proof.

## Evidence

The preflight node tests reject an ignored OTA certificate and an effective widget
build-setting mismatch. The checked-in source invariants pass the preflight. The
maintained release guide and skills record local EAS path requirements, provider
read-back, phase-specific status language, artifact inspection, store read-back,
and scoped upload authorization boundaries.
