---
name: release-mobile
description: Prepare and verify Sauci iOS or Android releases. Use for versioning, EAS/native builds, Fastlane upload, release notes, or store submission preparation.
---

# Mobile release

Read `docs/releasing.md`, `apps/mobile/RELEASING.md` when present, and the mobile
scoped instructions. Confirm target platform and release profile. Run repository
verification plus a native acceptance pass before starting a release build.

Use the package scripts in `apps/mobile/package.json`; preserve platform signing
and versioning. Building or uploading to a store is an external mutation: obtain
explicit authorization for the requested target, then report the build artifact,
version/build number, upload result, and read-back state.
