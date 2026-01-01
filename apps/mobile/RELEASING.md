# Releasing Sauci Mobile App

This guide covers local release builds for Android and iOS.

## Prerequisites

- **Java JDK 17** - Required for Android Gradle builds
- **Android Studio** - For SDK and build tools
- **Xcode** - For iOS builds
- **EAS CLI** - `npm install -g eas-cli`

---

## Recommended: EAS Build Local

The easiest way to build locally with correct signing credentials:

```bash
cd apps/mobile

# Android - produces .aab file
eas build --platform android --profile production --local

# iOS - produces .ipa file
eas build --platform ios --profile production --local
```

This runs the build on your machine but automatically uses the correct keystore/certificates from EAS credentials.

Output files will be in the current directory.

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

### Step 3: Prebuild (if needed)

If the `android/` folder doesn't exist or native dependencies changed:

```bash
npx expo prebuild --platform android --clean
```

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

1. Go to [Google Play Console](https://play.google.com/console)
2. Select **Sauci** app
3. Go to **Production** (or testing track)
4. **Create new release**
5. Upload the `.aab` file
6. Add release notes and submit

### Verifying Keystore Fingerprint

To verify you're using the correct keystore:

```bash
keytool -list -v -keystore android/sauci-release.keystore -storepass <password>
```

Expected SHA1: `C3:70:C5:8C:85:E5:B5:92:97:82:A9:B0:47:98:40:99:AC:C8:47:43`

---

## iOS Release Build

### Step 1: Prebuild (if needed)

```bash
npx expo prebuild --platform ios --clean
```

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

1. In Xcode Organizer (Window → Organizer), select the archive
2. Click **Distribute App**
3. Select **App Store Connect** → **Upload**
4. Follow the prompts to upload

### Step 5: Submit in App Store Connect

1. Go to [App Store Connect](https://appstoreconnect.apple.com)
2. Select **Sauci**
3. Create a new version or select the uploaded build
4. Fill in release notes and submit for review

---

## Version Management

Version is managed by EAS with `appVersionSource: "remote"` in `eas.json`.

To sync or bump versions:

```bash
# Check current version
eas build:version:get

# Set version manually
eas build:version:set --platform android --version 1.0.1
eas build:version:set --platform ios --version 1.0.1
```

For local builds, you may need to update `app.json` version manually:

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
# Clean and rebuild
cd android && ./gradlew clean && cd ..
npx expo prebuild --platform android --clean
cd android && ./gradlew bundleRelease
```

### iOS Signing Issues

Ensure your Apple Developer certificates and provisioning profiles are up to date in Xcode:
- **Xcode** → **Settings** → **Accounts** → Download Manual Profiles
