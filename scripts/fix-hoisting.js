/**
 * Fixes npm workspace hoisting for React Native native modules.
 *
 * npm workspaces hoists all deps to the root node_modules by default.
 * Native modules like @react-native-firebase/* and @shopify/react-native-skia
 * break when hoisted because:
 *   - Firebase podspecs use relative paths to sibling packages (../app/package.json)
 *   - Skia native bindings must resolve from the app's node_modules
 *
 * This script moves hoisted native packages back into apps/mobile/node_modules
 * so CocoaPods autolinking and Metro resolve them correctly.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const MOBILE_NM = path.join(ROOT, 'apps', 'mobile', 'node_modules');
const ROOT_NM = path.join(ROOT, 'node_modules');

// Packages that must live in apps/mobile/node_modules, not root
const PACKAGES_TO_FIX = [
  '@react-native-firebase/analytics',
  '@shopify/react-native-skia',
];

for (const pkg of PACKAGES_TO_FIX) {
  const rootPkg = path.join(ROOT_NM, pkg);
  const localPkg = path.join(MOBILE_NM, pkg);

  if (!fs.existsSync(rootPkg)) continue;
  if (fs.existsSync(localPkg)) continue; // already local

  // Ensure parent scope dir exists (e.g. @react-native-firebase)
  const localParent = path.dirname(localPkg);
  fs.mkdirSync(localParent, { recursive: true });

  // Move from root to local
  fs.renameSync(rootPkg, localPkg);
  console.log(`fix-hoisting: moved ${pkg} → apps/mobile/node_modules/`);
}
