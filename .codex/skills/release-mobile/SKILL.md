---
name: release-mobile
description: Prepare, verify, and ship Sauci iOS or Android releases end to end. Use for versioning, EAS/native builds, store uploads, App Review / Play review submission, and rollout.
---

# Mobile release

Read `docs/releasing.md`, `apps/mobile/RELEASING.md` when present, and the mobile
scoped instructions. Confirm target platform and release profile. Run repository
verification plus a native acceptance pass before starting a release build.

## OTA update vs full store release

Choose the delivery mechanism before doing anything else; they are different
pipelines with different blast radii. `docs/mobile-ota.md` is the authority.

- **OTA update** (`npm run ota:publish:<env>` in `apps/mobile`): ships only the
  JavaScript bundle and assets to builds already installed on devices. No store
  review, live within minutes, and rolled back by repointing the XPREM channel
  at a previous update. Valid only when the change touches no native code, no
  native dependency, no `ios/`/`android/` project files, and no config that
  alters the native binary. The OTA runtime version equals the public app
  version, so an OTA update can only reach installs of the current
  `expo.version`.
- **Full store release** (this skill): a new signed binary through App Store
  Connect and Google Play, including review. Required whenever native code,
  native dependencies, the checked-in native projects, Expo SDK, permissions,
  entitlements, or `expo.version` change. Rollback is coarser: Play staged
  rollouts can be halted, iOS phased release can be paused, and a bad release is
  otherwise superseded by shipping the next version.

When a change qualifies for OTA, prefer OTA unless the user asks for a store
release. Never present an OTA publish as a store release or vice versa; report
which mechanism was used.

## Authorization

An explicit request for a mobile release authorizes the complete pipeline for
the stated platforms: version bump, build, verification, store upload, review
submission (App Review / Google Play review), and rollout — including full
production rollout. Rollout is recoverable by design (staged-rollout halt,
phased-release pause, OTA supersession, or the next store version), so do not
pause to re-confirm these steps; execute them and report. A request that
explicitly narrows scope (for example "upload only", "TestFlight only", or a
named track) still bounds what you do.

Before a build from the current upstream branch, fetch, require a clean worktree,
and prove `HEAD` matches its upstream. The `generate-release` skill may instead
build a clean, scoped release-preparation commit that descends directly from that
fetched upstream; between its multi-platform builds it commits only independently
verified EAS version metadata. Sauci tracks its native iOS and Android projects,
so routine release builds must package those checked-in sources. Do not run
`expo prebuild` first; native regeneration is a separate reviewed change.

Use the package scripts in `apps/mobile/package.json` to build artifacts and the
Fastlane lanes in `apps/mobile/fastlane/Fastfile` to upload, submit, and roll
out.

## Upload and submission execution

Verification before upload is unchanged and mandatory. Independently verify and
report:

- the platform, exact artifact path, bundle/package identifier, public version,
  build number, signature identity, and SHA-256 digest;
- the exact destination and resulting state: which Play track and rollout
  status, or App Store Connect version state and whether App Review submission
  and automatic release are included.

Once these details match the request, proceed through upload, review
submission, and rollout without requesting further confirmation.

- **Android**: `bundle exec fastlane android release aab:<absolute path>`
  commits the release on the production track (pass `track:` to target another
  track, `rollout:0.1` for a staged rollout). Play review runs automatically;
  rollout proceeds on approval. Use the `upload` lane only when the request is
  explicitly upload-only.
- **iOS**: `bundle exec fastlane ios release ipa:<absolute path>` uploads,
  creates the App Store version, submits for App Review, and releases
  automatically on approval (pass `phased_release:true` for a 7-day phased
  release, `release_notes:"..."` for What's New). Use the `upload` lane for
  TestFlight-only requests. `eas submit` remains valid for upload-only flows;
  when used, pass explicit `--platform`, `--profile production`, `--path`, and
  `--wait` — never `--latest`.

If an upload or submission command returns an ambiguous result, inspect EAS and
the store before doing anything else; do not retry blind. After submission, read
back the store state (Play Console track status / App Store Connect version
state) and report it.

Preserve platform signing and local EAS versioning. After a build, verify that
tracked changes are limited to the expected version metadata, then independently
read the artifact version and signature. For an iOS IPA, inspect every packaged
app extension as well as the containing app and require matching
`CFBundleShortVersionString` and `CFBundleVersion` values. Treat Xcode archive
warnings as diagnostic evidence, not the final artifact state: decide whether to
reject or rebuild only after reading the exported IPA itself. Report the
artifact, version/build number, upload and submission results, rollout state,
and store read-back state.
