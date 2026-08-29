# Release artifact verification

Use the strongest locally available platform tools and record the commands and
results. Never print provisioning profiles, keys, tokens, or environment values.

## Android AAB

Require a production `.aab`. Inspect its manifest with `bundletool dump manifest`
or Android SDK `apkanalyzer`, and verify:

- package `com.sauci.app`;
- `versionName` equals the release version;
- `versionCode` equals the recorded Android build number.

Verify the archive signature with `jarsigner -verify -verbose -certs`. Compare the
signing certificate SHA-1 to the production fingerprint documented in
`docs/releasing.md`; do not copy credentials into commands or reports. Calculate
the artifact SHA-256 with `shasum -a 256`.

## iOS IPA

Extract the `.ipa` into a new temporary directory created with `mktemp -d`. Read
the application `Info.plist` with `/usr/libexec/PlistBuddy` or `plutil` and verify:

- `CFBundleIdentifier` is `com.sauci.app`;
- `CFBundleShortVersionString` equals the release version;
- `CFBundleVersion` equals the recorded iOS build number.

Use `codesign -dvvv` and `codesign --verify --deep --strict` on the extracted app
to inspect and verify signing without exposing the embedded profile. Calculate the
original `.ipa` SHA-256 with `shasum -a 256`. Remove only the explicit temporary
extraction directory after inspection.

## Source correspondence

For both platforms, retain the build command, artifact path, build completion
time, and digest in the final report. Compare the post-build tracked diff with the
documented allowed version files. A binary with the right version but unexpected
source regeneration, wrong signing, or an unverifiable manifest is not accepted.
