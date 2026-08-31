---
id: 2026-08-31-local-eas-build-preconditions
date: 2026-08-31
status: promoted
scope: apps/mobile local EAS release builds
evidence: v1.0.8 local EAS build session, commit d8bedea
destination: docs/releasing.md
review_after: 2026-11-30
---

## Symptom

Local EAS release builds failed before native compilation for environment
reasons unrelated to the app source, and a successful iOS build left the
tracked source in a state that fails release-preflight afterward.

## Reproduction

Run `eas build --local` from a non-interactive shell without first exporting
ANDROID_HOME/ANDROID_SDK_ROOT/JAVA_HOME: fails with "SDK location not
found" because non-interactive shells do not load the user profile. Run it
with a non-empty EAS_LOCAL_BUILD_WORKINGDIR: fails with "Workingdir is not
empty". Run it outside apps/mobile: eas cannot find the project. Pipe the
build log through `tail`: the full log needed for diagnosis is lost. After a
successful iOS build, EAS auto-increment updates both Info.plists but not
the widget target's CURRENT_PROJECT_VERSION in the pbxproj, so
release-preflight fails until it is synced.

## Cause

`eas` must be installed as a global CLI (scripts call bare `eas`; eas-cli
23.0.0 verified). Non-interactive shells used for automation do not source
the profile that normally exports the Android/Java environment variables.
EAS_LOCAL_BUILD_WORKINGDIR must not exist or be empty. EAS iOS
auto-increment writes plist versions but does not touch the widget target's
pbxproj CURRENT_PROJECT_VERSION, so it drifts from the app's build number by
one increment after every successful build.

## Remediation

Before a local EAS build: verify `eas` is on PATH, explicitly export
ANDROID_HOME, ANDROID_SDK_ROOT, and JAVA_HOME (JDK 17), ensure
EAS_LOCAL_BUILD_WORKINGDIR does not exist or is empty, and run from
apps/mobile. Capture the full build log to a file rather than piping through
`tail`. After a successful build, sync the widget's CURRENT_PROJECT_VERSION
to the new build number (commit d8bedea, sed 46 to 47) and sync
ios/Podfile.lock from the successful build's working directory when
dependencies changed, since the archive's pod install resolution is
authoritative and local CocoaPods here is broken.

## Evidence

docs/releasing.md's local-build section documents the environment
preconditions and the post-build widget CURRENT_PROJECT_VERSION and
Podfile.lock sync steps; `npm run release:preflight` passes after the sync.
