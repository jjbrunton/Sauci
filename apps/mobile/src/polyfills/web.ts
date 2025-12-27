/**
 * Web platform polyfills
 * This file must be imported BEFORE any other React Native imports
 * to ensure the polyfills are applied before libraries like react-native-gesture-handler load.
 * 
 * IMPORTANT: Do NOT use ES6 imports from react-native in this file!
 * Using imports would cause react-native to be loaded before the polyfill runs.
 */

// We need to detect web platform without importing react-native
const isWeb = typeof document !== "undefined";

if (isWeb) {
    // Polyfill findNodeHandle for web platform
    // react-native-gesture-handler uses this internally but react-native-web throws an error
    // We patch it to return null instead, which is safer than throwing
    try {
        // Get react-native module and override findNodeHandle
        const RN = require("react-native");

        // Create a no-op function that returns null
        const webFindNodeHandle = () => null;

        // Override the module's export
        Object.defineProperty(RN, "findNodeHandle", {
            value: webFindNodeHandle,
            writable: true,
            configurable: true,
        });
    } catch (e) {
        console.warn("Failed to polyfill findNodeHandle:", e);
    }
}
