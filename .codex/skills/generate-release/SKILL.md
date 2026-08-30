---
name: generate-release
description: Generate a signed Sauci mobile release by bumping the public version, writing on-brand release notes, building and verifying iOS and Android binaries, committing release metadata, and tagging the release commit. Use for an actual production mobile release; use release-mobile for preparation, one-platform builds, uploads, or submission work that does not require the complete release lifecycle.
---

# Generate release

Create a reproducible release whose tag identifies the reviewed release source
and final platform build metadata. Read `apps/mobile/AGENTS.md`,
`docs/releasing.md`, and the `release-mobile` and `commit` skills before acting. Read
[references/release-notes-voice.md](references/release-notes-voice.md) before
drafting notes and [references/artifact-verification.md](references/artifact-verification.md)
before accepting a build.

A request to generate or create a release authorizes the scoped version edits,
release notes, local builds, release commits, and one local annotated tag. It
does not authorize pushing commits or tags, uploading binaries, submitting a
store release, changing signing credentials, or regenerating native projects.

## Defaults

- Build both iOS and Android production binaries unless the user narrows the
  platforms.
- Increment the patch version unless the user specifies `minor`, `major`, or an
  exact SemVer version.
- Use `v<version>` for the annotated Git tag.
- Write artifacts beneath ignored `dist/releases/v<version>/`; never commit
  binaries, credentials, logs, or build directories.

## Preflight

Fetch the remote and inspect the worktree, branch, upstream, existing tags,
toolchains, EAS authentication, and signing availability without changing them.
Require all of the following:

- a named branch, normally `main` for a production release;
- a clean starting worktree with `HEAD` equal to its fetched upstream;
- the previous reachable `v[0-9]*` release tag and no collision for the next tag;
- consistent public and OTA runtime versions across `app.json`, explicit
  `app.config.js` runtime, Android, and every iOS target
  (`scripts/set_version.mjs --check`);
- Node 20, JDK 17 for Android, and Xcode/CocoaPods for iOS;
- the configured production API/Auth/RevenueCat environment, without printing
  secret values.

For an OTA release, run `npm run ota:preflight:production -w @sauci/mobile`
before any publish. This exercises the EOAS-compatible Expo export environment
without contacting the update server or uploading an update.

Do not switch branches, discard work, repair credentials, push, or weaken branch
protection merely to pass preflight. Stop with the exact blocker. Never run
`expo prebuild` as part of this workflow.

## Prepare the release

1. Derive the next version with `scripts/set_version.mjs --bump <kind>` or set an
   explicit version with `--version <x.y.z>`. The script updates the checked-in
   public-version sources but deliberately leaves platform build numbers to EAS.
2. Review the complete first-parent and ordinary commit diff from the previous
   reachable release tag to the starting commit. Inspect the actual product diff
   for every user-facing claim; commit subjects alone are not evidence.
3. Add the new entry immediately below the title in `docs/release-notes.md`.
   Describe user-visible value, meaningful fixes, privacy or reliability changes,
   and only claims supported by the diff. Omit internal migrations, refactors,
   CI, infrastructure, dependency churn, and implementation jargon unless the
   user experiences a direct result. Use a temporary `Build numbers pending
   artifact verification` line until the binaries have been inspected; never
   guess or predict build numbers.
4. Run `npm run verify:full` and the native acceptance required by the
   `release-mobile` skill. A missing prerequisite is a failure/limitation, not a
   pass.
5. Review the scoped diff and create `chore(release): prepare v<version>`. Do not
   stage unrelated paths. This clean release-preparation commit must descend
   directly from the fetched upstream commit.

## Build and capture platform metadata

Build from the clean prepared source using the package scripts in
`apps/mobile/package.json`, with `EAS_LOCAL_BUILD_ARTIFACTS_DIR` set to the
versioned artifact directory. When building both platforms, build Android first,
then iOS.

After each build:

1. Inspect the worktree before doing anything else. Accept only the documented
   EAS build-number changes in `app.json`, that platform's native version source,
   and the iOS widget plist when applicable. Treat any implementation, resource,
   dependency, or native-project regeneration as a failed build.
2. Independently inspect the binary for package/bundle identifier, public
   version, platform build number, production endpoint configuration where
   inspectable, and signing identity/fingerprint. Require the embedded public
   version to equal the requested version.
3. Record the verified platform build number in the new release-note entry.
4. Commit only the expected metadata and release-note update as
   `chore(<platform>): record v<version> build <number>`. The worktree must be
   clean before starting the next platform build.

Do not accept a successful EAS exit code as proof of a valid artifact. If either
requested platform fails, do not tag a partial release.

## Tag and prove the result

Re-run focused version checks and `npm run verify:fast`. Confirm every requested
artifact exists, has a SHA-256 digest, passed independent version/signature
inspection, and was produced from the release commit chain. Require a clean
worktree, then create the annotated local tag `v<version>` at `HEAD`.

Read back the tag object and prove:

- the tag resolves to `HEAD`;
- the tag version equals all public-version sources and embedded artifacts;
- recorded build numbers equal the embedded platform build numbers;
- no binary or ignored build output entered the commit;
- the release commits descend from the fetched starting branch commit;
- for a two-platform release, the Android artifact's source commit differs from
  the final tag only by the later verified iOS build metadata.

Report the branch, tag, commit, release-note summary, artifact paths, versions,
build numbers, signatures, SHA-256 digests, checks run, and any environmental
limitations. State explicitly that the tag and commits remain local unless a
separate authorized push was completed.
