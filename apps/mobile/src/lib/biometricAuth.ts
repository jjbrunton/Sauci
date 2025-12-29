import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const BIOMETRIC_ENABLED_KEY = "biometric_auth_enabled";

/**
 * Check if biometric authentication (Face ID/Touch ID) is available on the device
 */
export async function isBiometricAvailable(): Promise<boolean> {
    if (Platform.OS === "web") {
        return false;
    }

    try {
        const compatible = await LocalAuthentication.hasHardwareAsync();
        if (!compatible) return false;

        const enrolled = await LocalAuthentication.isEnrolledAsync();
        return enrolled;
    } catch (error) {
        console.error("Error checking biometric availability:", error);
        return false;
    }
}

/**
 * Get the type of biometric authentication available (Face ID, Touch ID, etc.)
 */
export async function getBiometricType(): Promise<string> {
    if (Platform.OS === "web") {
        return "None";
    }

    try {
        const types = await LocalAuthentication.supportedAuthenticationTypesAsync();

        if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
            return Platform.OS === "ios" ? "Face ID" : "Face Recognition";
        }
        if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
            return Platform.OS === "ios" ? "Touch ID" : "Fingerprint";
        }
        if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) {
            return "Iris";
        }

        return "Biometric";
    } catch (error) {
        console.error("Error getting biometric type:", error);
        return "Biometric";
    }
}

/**
 * Check if biometric authentication is enabled by the user
 */
export async function isBiometricEnabled(): Promise<boolean> {
    if (Platform.OS === "web") {
        return false;
    }

    try {
        const value = await SecureStore.getItemAsync(BIOMETRIC_ENABLED_KEY);
        return value === "true";
    } catch (error) {
        console.error("Error reading biometric setting:", error);
        return false;
    }
}

/**
 * Enable or disable biometric authentication
 */
export async function setBiometricEnabled(enabled: boolean): Promise<void> {
    if (Platform.OS === "web") {
        return;
    }

    try {
        await SecureStore.setItemAsync(BIOMETRIC_ENABLED_KEY, enabled ? "true" : "false");
    } catch (error) {
        console.error("Error saving biometric setting:", error);
        throw error;
    }
}

/**
 * Authenticate the user using biometrics
 * @returns true if authentication was successful, false otherwise
 */
export async function authenticateWithBiometric(): Promise<boolean> {
    if (Platform.OS === "web") {
        return true;
    }

    try {
        const biometricType = await getBiometricType();

        const result = await LocalAuthentication.authenticateAsync({
            promptMessage: `Unlock Sauci with ${biometricType}`,
            cancelLabel: "Cancel",
            disableDeviceFallback: false, // Allow passcode fallback
            fallbackLabel: "Use Passcode",
        });

        return result.success;
    } catch (error) {
        console.error("Error during biometric authentication:", error);
        return false;
    }
}
