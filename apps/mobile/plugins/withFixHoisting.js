/**
 * Expo config plugin that ensures hoisted native packages are moved back
 * to apps/mobile/node_modules BEFORE any other plugins try to resolve them.
 *
 * This runs at plugin load time (synchronously), not as a deferred mod,
 * so it fixes the issue before @react-native-firebase/app plugin resolution.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..', '..'); // apps/mobile/../../..
const MOBILE_NM = path.join(ROOT, 'apps', 'mobile', 'node_modules');
const ROOT_NM = path.join(ROOT, 'node_modules');

const PACKAGES_TO_FIX = [
  '@react-native-firebase/app',
  '@react-native-firebase/analytics',
  '@react-native-firebase/crashlytics',
  '@shopify/react-native-skia',
];

for (const pkg of PACKAGES_TO_FIX) {
  const rootPkg = path.join(ROOT_NM, pkg);
  const localPkg = path.join(MOBILE_NM, pkg);

  if (!fs.existsSync(rootPkg)) continue;
  if (fs.existsSync(localPkg)) continue;

  const localParent = path.dirname(localPkg);
  fs.mkdirSync(localParent, { recursive: true });
  fs.renameSync(rootPkg, localPkg);
}

module.exports = function withFixHoisting(config) {
  return config;
};
