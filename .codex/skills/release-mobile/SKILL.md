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
Never infer upload or submission authority from build authorization. Store upload
uses a separately authorized command.

## Upload authorization gate

After an artifact passes verification, stop immediately before the external
upload and ask the user for confirmation. The request must identify:

- the platform, exact artifact path, bundle/package identifier, public version,
  build number, signature identity, and SHA-256 digest;
- the exact destination and resulting state: Google Play internal-track draft or
  App Store Connect/TestFlight processing;
- that the upload does not authorize a public rollout or App Review submission.

For iOS, inspect the current App Store Connect automatic-distribution behavior
before asking. If the build would be distributed automatically, name the exact
TestFlight groups or testers in the request and include that effect in the fresh
authorization. If the effect cannot be established, stop; changing an automatic-
distribution setting also requires separate authorization.

Even when the original request includes building, releasing, uploading, or
submitting, require this fresh confirmation once the exact verified artifact and
destination are known. End the request with: `Upload this verified artifact to
<destination> now?` A clear affirmative response authorizes one upload of that
artifact to that destination, plus only any automatic TestFlight distribution
explicitly disclosed in the request. Run `eas submit` with the explicit
`--platform`, `--profile production`, `--path`, and `--wait` arguments; never
select `--latest`. If the result is ambiguous, inspect EAS and the store before
doing anything else, do not retry, and ask again before another upload.

Apply this gate to every upload method, including EAS, Fastlane, Xcode Organizer,
and the store consoles. A later public rollout, App Review submission, or
additional TestFlight distribution requires another fresh authorization.

Preserve platform signing and local EAS versioning. After a build, verify that
tracked changes are limited to the expected version metadata, then independently
read the artifact version and signature. For an iOS IPA, inspect every packaged
app extension as well as the containing app and require matching
`CFBundleShortVersionString` and `CFBundleVersion` values. Treat Xcode archive
warnings as diagnostic evidence, not the final artifact state: decide whether to
reject or rebuild only after reading the exported IPA itself. Report the artifact,
version/build number, upload result when authorized, and store read-back state.
