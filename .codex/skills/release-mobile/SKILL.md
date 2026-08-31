---
name: release-mobile
description: Prepare and verify Sauci iOS or Android releases. Use for versioning, EAS/native builds, Fastlane upload, release notes, or store submission preparation.
---

# Mobile release

Read `docs/releasing.md`, `apps/mobile/RELEASING.md` when present, and the mobile
scoped instructions. Confirm target platform and release profile. Run repository
verification plus a native acceptance pass before starting a release build.

Before a build from the current upstream branch, fetch, require a clean worktree,
and prove `HEAD` matches its upstream. The `generate-release` skill may instead
build a clean, scoped release-preparation commit that descends directly from that
fetched upstream; between its multi-platform builds it commits only independently
verified EAS version metadata. Sauci tracks its native iOS and Android projects,
so routine release builds must package those checked-in sources. Do not run
`expo prebuild` first; native regeneration is a separate reviewed change.

Use the package scripts in `apps/mobile/package.json`; they create artifacts only.
An explicit request for a mobile release, upload, or store-submission workflow
authorizes the requested store upload within its stated platform and destination
scope. Building an artifact alone does not authorize an upload.

## Upload execution

Before an external upload, independently verify and report:

- the platform, exact artifact path, bundle/package identifier, public version,
  build number, signature identity, and SHA-256 digest;
- the exact destination and resulting state: Google Play internal-track draft or
  App Store Connect/TestFlight processing;
- that the upload does not authorize a public rollout or App Review submission.

For iOS, inspect the current App Store Connect automatic-distribution behavior
before uploading. If the build would be distributed automatically, report the
exact TestFlight groups or testers. If the effect cannot be established, stop;
changing an automatic-distribution setting is a separately authorized action.

Once these details match the user's stated scope, upload without requesting a
second confirmation. Run `eas submit` with the explicit
`--platform`, `--profile production`, `--path`, and `--wait` arguments; never
select `--latest`. If the result is ambiguous, inspect EAS and the store before
doing anything else; do not retry unless the user explicitly authorizes another
upload.

Apply this policy to every upload method, including EAS, Fastlane, Xcode
Organizer, and the store consoles. A public rollout, App Review submission, or
additional TestFlight distribution requires separate explicit authorization
unless it was expressly included in the original request.

Preserve platform signing and local EAS versioning. After a build, verify that
tracked changes are limited to the expected version metadata, then independently
read the artifact version and signature. For an iOS IPA, inspect every packaged
app extension as well as the containing app and require matching
`CFBundleShortVersionString` and `CFBundleVersion` values. Treat Xcode archive
warnings as diagnostic evidence, not the final artifact state: decide whether to
reject or rebuild only after reading the exported IPA itself. Report the artifact,
version/build number, upload result when authorized, and store read-back state.
