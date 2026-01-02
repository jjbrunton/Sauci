const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

// Find the project and workspace directories
const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// 1. Watch all files within the monorepo
// 1. Watch only relevant folders to improve performance on Windows
// watching the entire workspaceRoot is too slow
config.watchFolders = [
    path.resolve(workspaceRoot, 'node_modules'),
    path.resolve(workspaceRoot, 'packages/shared')
];

// 2. Let Metro know where to resolve packages and in which order
config.resolver.nodeModulesPaths = [
    path.resolve(projectRoot, 'node_modules'),
    path.resolve(workspaceRoot, 'node_modules'),
];

// 3. Force Metro to resolve (sub)dependencies from the `node_modules`
//    of the workspace root, unless they are installed in the project root.
config.resolver.disableHierarchicalLookup = true;

// 4. E2EE crypto polyfill: resolve 'crypto' to react-native-quick-crypto
// This enables Web Crypto API for encryption operations
config.resolver.extraNodeModules = {
    ...config.resolver.extraNodeModules,
    crypto: require.resolve('react-native-quick-crypto'),
};

module.exports = config;
