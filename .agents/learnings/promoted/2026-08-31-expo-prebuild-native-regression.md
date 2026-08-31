---
id: 2026-08-31-expo-prebuild-native-regression
date: 2026-08-31
status: promoted
scope: apps/mobile native projects (ios/, android/) and expo prebuild
evidence: v1.0.8 SDK 54 to 56 upgrade, commits 604eec3, 7aca39a, 6bd04a6, 79233f5, b8cb2add
destination: apps/mobile/scripts/release-preflight.mjs, apps/mobile/scripts/release-preflight.test.mjs, and docs/releasing.md
review_after: 2026-11-30
---

## Symptom

`expo prebuild --clean` during the SDK 54 to 56 upgrade (and the
@bacons/apple-targets 0.1 to 5.0 bump) silently regressed four checked-in
native invariants. Each regression was caught only by a release gate or by
manual diffing against the last shipped tag (3fc6f8a, v1.0.7), not by
prebuild itself.

## Reproduction

Run `expo prebuild --clean` in apps/mobile against the upgraded SDK and diff
the regenerated ios/ and android/ projects against the previously committed
projects.

## Cause

1. Widget identity: apple-targets 5.x derives PRODUCT_BUNDLE_IDENTIFIER from
   the target folder name, changing com.sauci.app.LiveDrawWidget to
   com.sauci.app.widget, and repointed CODE_SIGN_ENTITLEMENTS to the
   gitignored ios/.targets/LiveDrawWidget/generated.entitlements.
2. Android manifest lost the tools:node="remove" attributes on
   READ_MEDIA_IMAGES and READ_MEDIA_VIDEO, so the built AAB regained
   Play-forbidden permissions (verified via bundletool dump on the rejected
   build 50 AAB).
3. iOS Info.plist gained dev-launcher-only keys NSBonjourServices
   (_expo._tcp), NSLocalNetworkUsageDescription, and RCTMetroPort.
4. android/gradle.properties reset to stock -Xmx2048m
   -XX:MaxMetaspaceSize=512m, causing Metaspace OOM in kspReleaseKotlin/CMake
   under RN 0.85.

Separately, a package absent from the new SDK's bundledNativeModules
(expo-av) has no compatible release and fails the iOS archive (EXAV.h
imports removed ExpoModulesCore headers).

## Remediation

Fixed by restoring widget identity and tracking
targets/widget/generated.entitlements with a pinned bundleIdentifier
(604eec3); restoring manifest tools:node="remove" attributes (7aca39a);
removing the dev-launcher-only Info.plist keys (6bd04a6); raising
gradle.properties memory to 4096m/1024m (79233f5); and migrating expo-av to
expo-video/expo-audio (b8cb2add).

Extend apps/mobile/scripts/release-preflight.mjs with executable checks for
items 2 and 3 (item 1 is already covered by the existing LiveDrawWidget
preflight check; item 4 hard-fails the build by itself). Add an "After
native regeneration" checklist to docs/releasing.md.

## Evidence

`node apps/mobile/scripts/release-preflight.mjs` fails if the tracked
AndroidManifest.xml lacks tools:node="remove" on READ_MEDIA_IMAGES or
READ_MEDIA_VIDEO, or if ios/Sauci/Info.plist contains NSBonjourServices,
NSLocalNetworkUsageDescription, or RCTMetroPort.
`node --test apps/mobile/scripts/release-preflight.test.mjs` covers the new
checks.
