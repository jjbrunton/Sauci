/**
 * Crypto polyfill for React Native
 * 
 * This file must be imported BEFORE any code that uses crypto.
 * It installs react-native-quick-crypto as the global crypto implementation.
 * 
 * On web, we skip this since the native Web Crypto API is available.
 */

import { Platform } from 'react-native';

if (Platform.OS !== 'web') {
  try {
    // Import react-native-quick-crypto to install its polyfill
    const QuickCrypto = require('react-native-quick-crypto');
    
    // Install the polyfill globally if not already present
    if (typeof global.crypto === 'undefined') {
      (global as any).crypto = QuickCrypto;
    }
    
    // Also ensure subtle is available
    if (global.crypto && !global.crypto.subtle) {
      (global.crypto as any).subtle = QuickCrypto.subtle;
    }
    
    console.log('[Crypto] react-native-quick-crypto polyfill installed');
  } catch (error) {
    console.error('[Crypto] Failed to install crypto polyfill:', error);
    console.error('[Crypto] Make sure you have run: npx expo prebuild --clean');
  }
}
