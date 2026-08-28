---
name: release-mobile
description: Prepare and verify Sauci iOS or Android releases. Use for versioning, EAS/native builds, Fastlane upload, release notes, or store submission preparation.
---

# Mobile release

Read `docs/releasing.md`, `apps/mobile/RELEASING.md` when present, and the mobile
scoped instructions. Confirm target platform and release profile. Run repository
verification plus a native acceptance pass before starting a release build.

Before a build from the current upstream branch, fetch, require a clean worktree,
and prove `HEAD` matches its upstream. Sauci tracks its native iOS and Android
projects, so routine release builds must package those checked-in sources. Do not
run `expo prebuild` first; native regeneration is a separate reviewed change.

Use the package scripts in `apps/mobile/package.json`; they create artifacts only.
Never infer upload or submission authority from build authorization. Store upload
uses a separately authorized command. Preserve platform signing and local EAS
versioning. After a build, verify that tracked changes are limited to the expected
version metadata, then independently read the artifact version and signature.
Report the artifact, version/build number, upload result when authorized, and
read-back state.
