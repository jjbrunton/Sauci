# Releasing Sauci Mobile App

This guide covers local release builds for Android and iOS.

## OTA update or full store release?

Decide the delivery mechanism first — they are different pipelines:

- **OTA update** ([Mobile over-the-air updates](mobile-ota.md)) ships only the
  JavaScript bundle and assets to already-installed builds. No store review,
  live in minutes, rolled back by repointing the XPREM channel. Valid only for
  changes that leave the native binary untouched (no native code, native
  dependencies, `ios/`/`android/` project changes, permissions, entitlements,
  Expo SDK, or `expo.version` bump). OTA reaches only installs of the current
  `expo.version`, because the runtime version is synchronized with the app
  version.
- **Full store release** (this document) builds a new signed binary and ships
  it through App Store Connect and Google Play, including store review. It is
  required for anything OTA cannot carry. Rollback is coarser: halt a Play
  staged rollout, pause an iOS phased release, or supersede with the next
  version (an OTA update can often patch a bad JS-level regression in a live
  store build immediately).

Prefer OTA when the change qualifies, and always report which mechanism was
used.

## Prerequisites

- **Java JDK 17** - Required for Android Gradle builds
- **Android Studio** - For SDK and build tools (including Android SDK/NDK)
- **Xcode** - For iOS builds (macOS only)
- **EAS CLI** - `npm install -g eas-cli`
- **Expo account** - Run `eas login` to authenticate

---

## EAS Build Local (Recommended)

The `--local` flag runs the EAS build process on your machine instead of Expo's cloud servers. This automatically handles signing credentials and produces the same output as cloud builds.

### Quick Start

```bash
cd apps/mobile

# Android - produces .aab file (for Play Store)
npm run release:android

# iOS - produces .ipa file (for App Store)
npm run release:ios
```

Output files are placed in the current directory by default.

These scripts create signed artifacts only. An explicit request for a mobile
release authorizes the complete pipeline for the stated platforms: build,
verification, store upload, review submission, and rollout — including full
production rollout. Rollout is recoverable (staged-rollout halt, phased-release
pause, OTA supersession, or the next version), so agents should execute the
whole requested pipeline and report, rather than pausing for re-confirmation. A
request that explicitly narrows scope ("upload only", "TestFlight only", a named
track) still bounds the work. Building an
artifact alone does not authorize an upload.

Before every production build, run the deterministic source gate:

```bash
cd apps/mobile
npm run release:preflight
```

It checks public and OTA runtime version parity, iOS app/widget build parity,
and that the public OTA certificate is tracked and not excluded by root archive
rules. It does not replace inspection of the exported artifact.

## Ship a verified artifact

Credentials are never committed: production submission credentials are managed
by EAS, and the Fastlane iOS lanes read an App Store Connect API key from the
environment (`ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_KEY_PATH`). Never add `.p8`
files, Google service-account JSON files, or local credential paths to the
repository or `eas.json`.

Ship only an independently verified artifact by its exact absolute path. Before
upload, verify and report the platform, exact path, bundle/package identifier,
version, build number, signing identity, SHA-256 digest, and destination — then
proceed through upload, review submission, and rollout without asking for a
second confirmation.

### Full release (upload + review submission + rollout)

```bash
cd apps/mobile

# Android: commits the release on the production track. Play review runs
# automatically and rollout proceeds on approval.
bundle exec fastlane android release aab:/absolute/path/to/sauci.aab
# Optional: track:beta, rollout:0.1 (10% staged rollout)

# iOS: uploads, creates the App Store version, submits for App Review, and
# releases automatically on approval.
bundle exec fastlane ios release ipa:/absolute/path/to/sauci.ipa release_notes:"What's new..."
# Optional: phased_release:true (7-day phased release), automatic_release:false
```

### Upload only (when the request stops short of review)

```bash
cd apps/mobile

# Android internal-track draft; does not roll out the release.
eas submit --platform android --profile production --path /absolute/path/to/sauci.aab --wait

# App Store Connect/TestFlight; does not submit for App Review.
eas submit --platform ios --profile production --path /absolute/path/to/sauci.ipa --wait
```

Agents must not upload an unverified artifact, whether they use EAS, Fastlane,
Xcode Organizer, or a store console. Before upload, they must verify and report
the platform, exact path, bundle/package identifier, version, build number,
signing identity, SHA-256 digest, and destination. Once those details match the
user's stated scope, proceed without asking for a second confirmation.

Before an iOS upload, inspect App Store Connect for automatic TestFlight
distribution. If upload will add the build to existing groups or testers, report
them before proceeding. If the effect cannot be established, stop. Changing
automatic-distribution settings is a separate action and requires its own
authorization.

App Store Connect API group association alone does not reveal whether automatic
distribution is enabled. Verify the switch in an authenticated App Store Connect
UI session before upload. If the UI cannot be checked, stop instead of
inferring the effect from API data.

Do not use `--latest`; always pass the exact verified path. After upload or
submission, read back the resulting state from Google Play Console or App Store
Connect (track/rollout status, App Store version state) and report it. Two
things still need their own authorization, because neither is part of shipping
the requested release: distributing to additional TestFlight groups, and
re-uploading after an ambiguous result. If a command returns an ambiguous
result, inspect EAS and the store first; do not retry unless the user
explicitly authorizes another upload.

### Source integrity

Sauci commits its native `ios/` and `android/` projects. Start a release from a
clean worktree whose `HEAD` matches its fetched upstream, and do not run
`expo prebuild` before a routine release build. EAS detects the native projects
and packages the checked-in sources directly.

After the build, inspect `git diff`. Only the expected local EAS version fields
may change: `app.json`, the platform native version file, and the iOS widget
`Info.plist` for an iOS build. Any widget implementation, resource, or Xcode
project rewrite means the source was regenerated and the artifact must be rebuilt
from the clean tracked sources.

Accept an artifact only after independent inspection. Verify Android package,
version, signer, all four ABIs, required Worklets/Reanimated/Skia libraries,
forbidden media-read permissions, OTA runtime/channel/certificate, and SHA-256.
Verify the iOS IPA's app and every extension version/build/signature after export.
Quarantine or remove a rejected artifact before presenting any artifact for
upload. Tag the exact verified build-source commit, then promote it through
staging and main only after the release gates pass.

The committed Android Gradle ordering fix makes Prefab inputs available before
dependent native tasks. Preserve that explicit dependency ordering. Do not try to
solve Gradle task validation by removing Firebase or cycling dependency versions.

After Android upload, EAS Submit `FINISHED`, the exact internal/DRAFT/no-rollout
submit configuration, and the retained artifact digest are the authoritative
available read-back when direct Play track inspection would require creating an
edit. Never create an edit merely to claim read-only verification.

### Android media permission policy

Sauci uses the Android system photo picker for user-selected images and videos.
Android release manifests must not contain `READ_MEDIA_IMAGES` or
`READ_MEDIA_VIDEO`. Gallery save flows request add-only access and must not add
broad read access. After any Expo, media-library, image-picker, or native Android
change, run `:app:processReleaseMainManifest` and inspect the merged release
manifest before building an artifact for Google Play.

### Building an APK (for Testing)

The production profile creates an AAB (Android App Bundle), which can't be directly installed on devices. To build an APK for testing:

```bash
# Use the preview profile (configured for APK output)
eas build --platform android --profile preview --local
```

Or add a custom profile to `eas.json`:

```json
{
  "build": {
    "local-apk": {
      "android": {
        "buildType": "apk"
      }
    }
  }
}
```

Then run:
```bash
eas build --platform android --profile local-apk --local
```

### Installing the APK

```bash
# Via ADB (device connected via USB)
adb install ./build-*.apk

# Or drag-and-drop onto Android Emulator
```

### Build Profiles

| Profile | Output | Use Case |
|---------|--------|----------|
| `production` | .aab | Play Store / App Store submission |
| `preview` | .apk | Internal testing, device installation |
| `development` | .apk | Dev client with hot reload |

### Environment Variables

Useful for debugging build issues:

| Variable | Purpose |
|----------|---------|
| `EAS_LOCAL_BUILD_SKIP_CLEANUP=1` | Keep build directory after completion |
| `EAS_LOCAL_BUILD_WORKINGDIR=/path` | Custom build directory (default: /tmp) |
| `EAS_LOCAL_BUILD_ARTIFACTS_DIR=/path` | Output directory for build artifacts |

Example with debugging enabled:
```bash
EAS_LOCAL_BUILD_SKIP_CLEANUP=1 \
EAS_LOCAL_BUILD_WORKINGDIR=~/eas-builds \
eas build --platform android --profile production --local
```

For local builds, choose stable ignored working and artifact directories and
retain them with the command log until the artifact is accepted or rejected.
Check free disk space first. `ENOSPC`, EAS plugin startup, archive construction,
and dependency installation failures occur before native compilation: fix and
preflight those inputs without starting another build. Make one meaningful build
per newly proven input state.

Before starting: confirm `eas` is installed and on PATH (scripts call bare
`eas`); explicitly export `ANDROID_HOME`, `ANDROID_SDK_ROOT`, and `JAVA_HOME`
(JDK 17) rather than relying on a shell profile, because non-interactive shells
used for automation do not load it ("SDK location not found" otherwise); ensure
`EAS_LOCAL_BUILD_WORKINGDIR` does not exist or is empty ("Workingdir is not
empty" otherwise); and run every command from `apps/mobile`. Capture the full
build log to a file; do not pipe it through `tail`, which drops the detail
needed to diagnose a failure.

After a successful iOS build, EAS auto-increment updates both app and widget
Info.plists but not the widget target's `CURRENT_PROJECT_VERSION` in the
pbxproj, so `release:preflight` fails until it is synced to the new build
number (for example `sed -i '' 's/CURRENT_PROJECT_VERSION = 46;/CURRENT_PROJECT_VERSION = 47;/' ios/Sauci.xcodeproj/project.pbxproj`
for both Debug and Release). If native dependencies changed, also sync
`ios/Podfile.lock` from the successful build's working directory: the archive's
`pod install` resolution is authoritative when local CocoaPods is broken.

Report provider progress by phase: packaging, native compilation, submission
queue, or store processing. Do not describe every failure as a rebuild.

If the normal EAS invocation cannot find its local-build plugin, use a matching
CLI and plugin version and set `EAS_LOCAL_BUILD_PLUGIN_PATH` to that plugin's
executable `bin/run`, not its package directory. Do not commit or document a
machine-specific package-cache path. Run `npm run release:preflight:local-eas`
after setting the variable. See https://docs.expo.dev/build-reference/local-builds/
and https://github.com/expo/eas-cli/issues/2787.

### Limitations of Local Builds

- **Single platform only** - Can't use `--platform all`
- **Software versions ignored** - `node`, `yarn`, `ndk`, `image` fields in eas.json are ignored
- **No caching** - Each build starts fresh
- **Secret env vars not available** - Set them in your local environment instead
- **macOS/Linux only** - Windows requires WSL (unsupported)

### Troubleshooting Local Builds

**Java version mismatch:**
```bash
# Check Java version (should be 17)
java -version

# On macOS, switch Java version
export JAVA_HOME=$(/usr/libexec/java_home -v 17)
```

**Gradle daemon issues:**
```bash
cd android && ./gradlew --stop && cd ..
```

**Native regeneration after dependency changes:**

Treat `expo prebuild` as a source change, not a release step. Run it separately
only when native dependencies intentionally changed, review the full native diff,
verify it, and commit it before starting the release from a clean worktree. Use
`expo prebuild --clean` (see `docs/mobile-ota.md`); as of `@bacons/apple-targets`
5.x, a non-clean prebuild against an already-generated iOS project fails while
updating the widget's Xcode target.

**After native regeneration:** `expo prebuild --clean` can silently regress
checked-in native invariants (confirmed during the SDK 54 to 56 upgrade). Before
committing a regenerated project:

- Diff pbxproj signing and identity keys (PRODUCT_BUNDLE_IDENTIFIER,
  CODE_SIGN_ENTITLEMENTS) against the last release tag; apple-targets can derive
  a widget's bundle identifier from its folder name instead of the pinned config.
- Semantic-diff Info.plist and entitlements files against the last release tag;
  prebuild can reintroduce dev-launcher-only keys (NSBonjourServices,
  NSLocalNetworkUsageDescription, RCTMetroPort) and drop widget entitlements.
- Check android/gradle.properties for a reset `org.gradle.jvmargs` (prebuild
  resets it to the stock -Xmx2048m/512m, which OOMs release Kotlin/CMake tasks).
- Run `npm run release:preflight`; it enforces the Android manifest media
  permission removal and rejects the dev-launcher-only Info.plist keys.
- Treat `expo-doctor` unmaintained-package warnings as release blockers on an
  SDK upgrade: a package absent from the new SDK's bundledNativeModules can fail
  the iOS archive with no compatible release available.

**Out of memory:**
```bash
# Increase Gradle memory
echo "org.gradle.jvmargs=-Xmx4g" >> android/gradle.properties
```

---

## Manual Android Release Build

### Step 1: Get the Production Keystore

The production keystore is stored in EAS. Download it:

```bash
cd apps/mobile
eas credentials --platform android
```

Select:
1. `production`
2. `Keystore`
3. `Download Keystore`

Save the keystore file and note the **password** and **alias** shown.

### Step 2: Configure Signing

Ensure `android/gradle.properties` has the keystore configuration:

```properties
MYAPP_UPLOAD_STORE_FILE=sauci-release.keystore
MYAPP_UPLOAD_KEY_ALIAS=<alias from EAS>
MYAPP_UPLOAD_STORE_PASSWORD=<password from EAS>
MYAPP_UPLOAD_KEY_PASSWORD=<password from EAS>
```

**Important:** Never commit these credentials to git.

### Step 3: Confirm tracked native sources

The committed `android/` project is the release source. If native dependencies
changed, regenerate and review that project as a separate change before release.

### Step 4: Build the Release Bundle

```bash
cd android
./gradlew bundleRelease
```

The AAB file will be at:
```
android/app/build/outputs/bundle/release/app-release.aab
```

### Step 5: Upload to Play Store

Apply the artifact-verification policy above before opening or changing the
release. A release request covers the rollout, so carry it through to the track
the request named. Prefer the Fastlane `android release` lane; when using the
console:

1. Go to [Google Play Console](https://play.google.com/console)
2. Select **Sauci** app
3. Go to the track named in the request (**Production** for a release request)
4. **Create new release**
5. Upload the `.aab` file
6. Add release notes and roll out the release — Play review runs automatically
   and the rollout proceeds on approval
7. Read back the track and rollout state; halt the rollout if the read-back
   does not match what was uploaded

A release request includes review submission and rollout; a bad rollout is
halted from the same release page or superseded by the next version.

### Verifying Keystore Fingerprint

To verify you're using the correct keystore:

```bash
keytool -list -v -keystore android/sauci-release.keystore -storepass <password>
```

Expected EAS production upload-key SHA1: `F0:60:26:C7:54:B0:46:F2:80:FE:AC:43:8A:69:10:BD:9A:62:B4:59`

---

## iOS Release Build

### Step 1: Confirm tracked native sources

The committed `ios/` project is the release source. If native dependencies
changed, regenerate and review that project as a separate change before release.

### Step 2: Install Pods

```bash
cd ios
pod install
cd ..
```

### Step 3: Build Archive in Xcode

1. Open `ios/Sauci.xcworkspace` in Xcode
2. Select **Any iOS Device (arm64)** as the build target
3. Go to **Product** → **Archive**
4. Wait for the build to complete

### Step 4: Upload to App Store

Apply the artifact-verification policy above before using Xcode Organizer.

1. In Xcode Organizer (Window → Organizer), select the archive
2. Click **Distribute App**
3. Select **App Store Connect** → **Upload**
4. Follow the prompts to upload

### Step 5: Submit in App Store Connect

A release request includes App Review submission and release on approval.
Submission is recoverable: it can be cancelled while waiting for review, and a
phased release can be paused after approval. Prefer the Fastlane `ios release`
lane, which does all of this in one step; manually:

1. Go to [App Store Connect](https://appstoreconnect.apple.com)
2. Select **Sauci**
3. Create a new version or select the uploaded build
4. Fill in release notes and submit for review, with automatic release on
   approval unless the request says otherwise
5. Read back the version state and report it

---

## Version Management

Version is managed locally by EAS with `appVersionSource: "local"` in
`apps/mobile/eas.json`. Production builds auto-increment the platform build
number and synchronize the tracked native version file. For a public-version
bump, use the release version script rather than editing individual sources: it
updates and verifies `app.json`, the explicit Expo runtime string, and the
checked-in iOS and Android public/runtime values together.

```bash
node .codex/skills/generate-release/scripts/set_version.mjs --version 1.0.7
node .codex/skills/generate-release/scripts/set_version.mjs --check
```

To inspect or deliberately set versions:

```bash
# Check current version
eas build:version:get

# Set version manually
eas build:version:set --platform android --version 1.0.1
eas build:version:set --platform ios --version 1.0.1
```

The user-facing version remains in `app.json`:

```json
{
  "expo": {
    "version": "1.0.1"
  }
}
```

And for Android, update `android/app/build.gradle`:

```gradle
versionCode 2
versionName "1.0.1"
```

---

## Troubleshooting

### Wrong Keystore Error

If Play Store rejects with "signed with wrong key":

1. Run `eas credentials --platform android`
2. Download the correct keystore
3. Verify fingerprint matches expected SHA1
4. Replace your local keystore file

### Build Failures After Dependency Changes

```bash
# Clean the existing tracked Android project and rebuild it
cd android && ./gradlew clean && cd ..
cd android && ./gradlew bundleRelease
```

If native regeneration is genuinely required, do it as a separate reviewed and
committed source change before running the release build.

### iOS Signing Issues

Ensure your Apple Developer certificates and provisioning profiles are up to date in Xcode:
- **Xcode** → **Settings** → **Accounts** → Download Manual Profiles

For a checked-in entitlement, first read the corresponding Apple App ID
capability state. EAS capability sync can report success while Apple rejects a
malformed update, as tracked in https://github.com/expo/eas-cli/issues/3986.
Read back Associated Domains, regenerate only the affected profile, and decode
the replacement profile to confirm `com.apple.developer.associated-domains`
before rebuilding. With noninteractive managed App Store Connect key auth, set
`EXPO_APPLE_TEAM_ID` when the command cannot otherwise select the correct team.
Preserve existing certificates and unrelated target profiles.
