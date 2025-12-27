/**
 * SwipeCard component with platform-specific implementations.
 * 
 * - On native (iOS/Android): Uses react-native-gesture-handler with Reanimated
 *   for smooth, native-level gesture performance (SwipeCard.native.tsx)
 * 
 * - On web: Uses React Native's built-in PanResponder which is compatible with
 *   react-native-web (SwipeCard.web.tsx)
 * 
 * Metro bundler automatically picks the right file based on the platform:
 * - .native.tsx for iOS/Android
 * - .web.tsx for web
 * 
 * This file is a fallback that re-exports the web version for any other platform
 * that might not have a specific implementation.
 */
export { default } from "./SwipeCard.web";
