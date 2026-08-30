# Mobile over-the-air updates

Sauci ships JavaScript-only mobile changes over the air with `expo-updates`
against a self-hosted XPREM update server (formerly `expo-open-ota`) at
`https://ota.apps.jbrunton.co.uk`. XPREM speaks the official Expo Updates
protocol, so the client is stock `expo-updates`; only the endpoint, the request
headers, and the code-signing certificate are Sauci specific.

Store releases still follow [Mobile release process](releasing.md). OTA never
replaces a store build; it only refreshes the JavaScript bundle and assets of an
already installed build.

## Status

The client is wired but not yet live. Two values from the server deployment are
still outstanding; see [Pending server values](#pending-server-values).

## How it works

1. A build embeds a manifest URL, a release channel, an app id, and a public
   code-signing certificate.
2. On launch the app requests `https://ota.apps.jbrunton.co.uk/manifest`, sending
   `expo-channel-name`, `expo-app-id`, `xprem-branch`, and the standard
   `expo-runtime-version` and `expo-platform` headers.
3. XPREM resolves the channel to a branch, finds the newest update published for
   that branch and runtime version, and returns a signed manifest.
4. The client verifies the signature against the embedded certificate, downloads
   the bundle, and launches it on the next start.

### Branches and channels

XPREM separates storage from delivery. A **branch** groups updates for a release
line. A **release channel** is bound to a build at build time and points at a
branch. Repointing a channel at a different branch promotes or reverts an update
without a rebuild.

| EAS build profile | `RELEASE_CHANNEL` | Publish branch |
| --- | --- | --- |
| `development` | `development` | `development` |
| `preview` | `staging` | `staging` |
| `production` | `production` | `production` |

Channels and their branch mappings are created in the XPREM dashboard under
Channels. The client cannot create them.

### Runtime version

`apps/mobile/app.config.js` sets:

```js
runtimeVersion: { policy: 'appVersion' }
```

The runtime version is therefore the `expo.version` field in `app.json`, for
example `1.0.6`. An update is only offered to builds whose runtime version
matches exactly.

The practical rule: **any change that touches native code, native dependencies,
or the `ios/`/`android/` projects requires a new store build with a bumped
`expo.version`.** Bumping `version` starts a fresh runtime version on the server,
so old builds stop receiving updates that assume the new native surface.
JavaScript, asset, and configuration changes that do not alter the native binary
can ship over the air against the current `version`.

`appVersion` is chosen over `fingerprint` deliberately. Sauci commits its native
projects and ships several config plugins and an Apple widget target, so a
fingerprint would churn on native edits that never reach a device, and it would
be harder to reason about from a store release. `appVersion` ties the runtime
version to the number already visible in App Store Connect and Google Play.

## Client configuration

`apps/mobile/app.config.js` is a dynamic Expo config that spreads `app.json` and
layers on the `updates` block. `app.json` remains the static source of truth for
`version`, `ios.buildNumber`, and `android.versionCode`, which EAS rewrites
during a release build.

Resolved configuration:

| Key | Value |
| --- | --- |
| `updates.url` | `https://ota.apps.jbrunton.co.uk/manifest` |
| `updates.enabled` | `true` |
| `updates.checkAutomatically` | `ON_LOAD` |
| `updates.fallbackToCacheTimeout` | `5000` |
| `updates.codeSigningCertificate` | `./certs/certificate.pem` |
| `updates.codeSigningMetadata` | `{ keyid: 'main', alg: 'rsa-v1_5-sha256' }` |
| `updates.requestHeaders['expo-channel-name']` | `process.env.RELEASE_CHANNEL`, defaulting to `development` |
| `updates.requestHeaders['expo-app-id']` | `process.env.XPREM_APP_ID` |
| `updates.requestHeaders['xprem-branch']` | `''` |
| `runtimeVersion` | `{ policy: 'appVersion' }` |

`expo-updates` only sends request headers that were declared at build time, so
`xprem-branch` is declared even though it is empty. Removing it would not disable
branch surfing, it would strip the header from every poll for the life of the
install.

`RELEASE_CHANNEL` is set per profile in `apps/mobile/eas.json`. The config throws
a descriptive error whenever `RELEASE_CHANNEL` is set but the app id or the
certificate is still a placeholder, so a misconfigured build fails at config
resolution rather than shipping a client that can never validate a manifest.

### Local development

The dev server serves bundles directly and no signed manifest exists, so disable
code signing when running a dev client:

```bash
cd apps/mobile
DISABLE_CODE_SIGNING=1 npx expo start --dev-client
```

## Code signing

XPREM signs every manifest with an RSA private key held by the server. The app
embeds only the matching public certificate.

- `apps/mobile/certs/certificate.pem` is the public certificate. It is public key
  material and is committed.
- `private-key.pem` belongs to the update server only. `apps/mobile/certs/.gitignore`
  blocks it. It must never be committed or kept in a developer checkout.

The keypair is generated once, on the machine that configures the server:

```bash
npx eoas generate-certs
```

The certificate can also be downloaded from the XPREM dashboard App Info page for
the Sauci app.

## Native projects

`apps/mobile/ios` and `apps/mobile/android` are committed but generated by Expo
CNG, and `docs/releasing.md` treats `expo prebuild` as a source change rather
than a release step. The native projects currently still carry the
updates-disabled defaults:

- `ios/Sauci/Supporting/Expo.plist`: `EXUpdatesEnabled` is `false`.
- `android/app/src/main/AndroidManifest.xml`: `expo.modules.updates.ENABLED` is
  `false`.

The `expo-updates` config plugin writes the URL, the resolved runtime version,
the request headers, the code-signing metadata, and the certificate contents into
these files. Those values embed the real app id and certificate, so the native
projects are deliberately left untouched until both land.

Once the pending values below are in place, regenerate and commit the native
projects as a reviewed source change:

```bash
cd apps/mobile
RELEASE_CHANNEL=production npx expo prebuild
git diff   # expect only expo-updates related native changes
```

A build produced before that prebuild will not check for updates.

## Publishing an update

Publishing uses the XPREM CLI, `eoas`, pinned as a dev dependency of
`apps/mobile`. Authentication is an app-scoped API token generated in the XPREM
dashboard and supplied as `EOO_TOKEN`; it is a secret and must not be committed.

```bash
cd apps/mobile

# Staging: consumed by builds made with the EAS `preview` profile.
EOO_TOKEN=<token> npm run ota:publish:staging

# Production.
EOO_TOKEN=<token> npm run ota:publish:production
```

Both scripts wrap `eoas publish --branch <branch>` with the matching
`RELEASE_CHANNEL`. Useful flags to pass through:

| Flag | Purpose |
| --- | --- |
| `--platform ios\|android\|all` | Defaults to `all`. |
| `-m "<text>"` | Update description shown in the dashboard. |
| `--rollout-percentage <1-99>` | Progressive rollout to a fraction of devices. |
| `--nonInteractive` | Required in CI. |

`eoas publish` refuses to run against a dirty git working tree. Commit first
rather than reaching for `--disableRepositoryCheck` or `EAS_NO_VCS=1`; the
published update records the commit it came from.

Publish only from a commit that has passed `npm run verify:full`. An OTA update
reaches installed devices without store review, so it carries the same risk as a
production deploy and none of the review latency.

### Verifying a published update

```bash
curl -sD - "https://ota.apps.jbrunton.co.uk/manifest" \
  -H "expo-app-id: <xprem-app-id>" \
  -H "expo-channel-name: production" \
  -H "expo-runtime-version: 1.0.6" \
  -H "expo-platform: ios"
```

## Rollback

Two mechanisms, in order of preference:

1. **Repoint the channel.** In the XPREM dashboard, map the affected channel to a
   branch holding the last known good update. This takes effect at each app's
   next update check and needs no rebuild and no republish.
2. **Roll back from the CLI.**

   ```bash
   cd apps/mobile
   EOO_TOKEN=<token> npm run ota:rollback
   ```

   `eoas rollback` publishes a rollback directive for a branch and runtime
   version, sending clients back to the bundle embedded in the store build.
   `eoas republish` can instead re-serve a specific earlier update.

A bad update that prevents the app from starting cannot be fixed over the air on
devices that never complete a launch. Keep `fallbackToCacheTimeout` short and
treat a startup-path change as store-release risk, not OTA risk.

## Pending server values

The client wiring is complete apart from two values owned by the XPREM server
deployment. Both are non-secret.

| Value | Where it goes | How to obtain it |
| --- | --- | --- |
| XPREM app id (UUID) | `OTA_APP_ID_PLACEHOLDER` in `apps/mobile/app.config.js`, or the `XPREM_APP_ID` env var | XPREM dashboard, App Info page for the Sauci app |
| Code-signing certificate (PEM) | Replace the whole of `apps/mobile/certs/certificate.pem` | XPREM dashboard App Info download, or `npx eoas generate-certs` |

Also required, outside this repository:

- An `EOO_TOKEN` publish token per environment, stored as a secret.
- `development`, `staging`, and `production` channels created in the dashboard
  and mapped to branches of the same names.
- The `private-key.pem` counterpart of the certificate installed in the server key
  store.

After both values land: replace them, run the prebuild described in
[Native projects](#native-projects), commit the native diff, and cut a new store
build. Only builds produced after that point can receive updates.
