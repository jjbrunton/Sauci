// Dynamic Expo config.
//
// `app.json` stays the static source of truth for everything that is stable
// across environments, including the `version`, `ios.buildNumber`, and
// `android.versionCode` fields that EAS rewrites during a release build. This
// file only layers the over-the-air update configuration on top, because the
// XPREM update server selects a release channel from a build-time request
// header and that value differs per EAS build profile.
//
// See `docs/mobile-ota.md`.

/* global __dirname */

const fs = require('fs');
const path = require('path');

const appJson = require('./app.json');

/** Base URL of the self-hosted XPREM update server. */
const OTA_SERVER_URL = 'https://ota.apps.jbrunton.co.uk';

/** XPREM manifest endpoint. XPREM serves the Expo Updates protocol here. */
const OTA_MANIFEST_URL = `${OTA_SERVER_URL}/manifest`;

/**
 * XPREM application UUID for Sauci, shown in the XPREM dashboard under App
 * Info. Not a secret; overridable for pointing a build at another app.
 */
const OTA_APP_ID = process.env.XPREM_APP_ID || '9a66f3c2-fda7-416f-87e2-6db833b32e9d';

/** Public code-signing certificate downloaded from the XPREM dashboard. */
const CODE_SIGNING_CERTIFICATE_PATH = './certs/certificate.pem';

/** Marker string present only in the committed placeholder certificate. */
const CERTIFICATE_PLACEHOLDER_MARKER = 'XPREM-PLACEHOLDER-CERTIFICATE';

/**
 * Release channel bound to the build. XPREM maps a channel to a branch server
 * side, so a channel can be repointed at a different branch without rebuilding.
 * Set per EAS build profile in `eas.json` and exported before `eoas publish`.
 */
const releaseChannel = process.env.RELEASE_CHANNEL || 'development';

/**
 * Code signing is skipped for local development, where the packager serves the
 * bundle directly and no signed manifest exists:
 *   DISABLE_CODE_SIGNING=1 npx expo start --dev-client
 */
const codeSigningDisabled = Boolean(process.env.DISABLE_CODE_SIGNING);

if (releaseChannel === 'production' && codeSigningDisabled) {
  throw new Error(
    'RELEASE_CHANNEL=production does not permit DISABLE_CODE_SIGNING. ' +
      'Production builds must embed the XPREM code-signing certificate and metadata.',
  );
}

function assertUpdateConfigIsReal() {
  const certificatePath = path.join(__dirname, CODE_SIGNING_CERTIFICATE_PATH);
  const certificate = fs.existsSync(certificatePath)
    ? fs.readFileSync(certificatePath, 'utf8')
    : '';

  if (!certificate || certificate.includes(CERTIFICATE_PLACEHOLDER_MARKER)) {
    throw new Error(
      `RELEASE_CHANNEL=${releaseChannel} requires the real XPREM code-signing ` +
        `certificate at apps/mobile/${CODE_SIGNING_CERTIFICATE_PATH}. ` +
        'Download it from the XPREM dashboard App Info page. See docs/mobile-ota.md.',
    );
  }
}

// A build or publish always names its channel explicitly. Fail loudly there
// rather than shipping a build that can never validate a signed manifest.
if (process.env.RELEASE_CHANNEL) {
  assertUpdateConfigIsReal();
}

module.exports = () => ({
  ...appJson.expo,
  // Updates are gated on the app version. A JavaScript-only change ships over
  // the air; anything that changes native code must ship a new store build with
  // a bumped `version`, which starts a fresh runtime version on the server.
  runtimeVersion: {
    policy: 'appVersion',
  },
  updates: {
    enabled: true,
    url: OTA_MANIFEST_URL,
    checkAutomatically: 'ON_LOAD',
    fallbackToCacheTimeout: 5000,
    codeSigningCertificate: codeSigningDisabled
      ? undefined
      : CODE_SIGNING_CERTIFICATE_PATH,
    codeSigningMetadata: codeSigningDisabled
      ? undefined
      : { keyid: 'main', alg: 'rsa-v1_5-sha256' },
    // expo-updates only sends headers that were declared at build time, so
    // every header XPREM may need has to be present here even when empty.
    requestHeaders: {
      'expo-channel-name': releaseChannel,
      'expo-app-id': OTA_APP_ID,
      // Branch surfing: lets a non-production build be pointed at another
      // branch at runtime. Empty means the channel mapping decides.
      'xprem-branch': '',
    },
  },
});
