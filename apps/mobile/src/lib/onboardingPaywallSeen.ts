import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const STORAGE_KEY_PREFIX = "onboarding_paywall_seen";

const buildKey = (userId: string): string => `${STORAGE_KEY_PREFIX}_${userId}`;

async function getStorage(key: string): Promise<boolean> {
    try {
        let data: string | null = null;

        if (Platform.OS === "web") {
            if (typeof window !== "undefined" && typeof window.localStorage !== "undefined") {
                data = window.localStorage.getItem(key);
            }
        } else {
            data = await SecureStore.getItemAsync(key);
        }

        return data === "true";
    } catch (error) {
        console.error("Error reading onboarding paywall state:", error);
    }
    return false;
}

async function setStorage(key: string, seen: boolean): Promise<void> {
    try {
        const data = seen ? "true" : "false";

        if (Platform.OS === "web") {
            if (typeof window !== "undefined" && typeof window.localStorage !== "undefined") {
                window.localStorage.setItem(key, data);
            }
        } else {
            await SecureStore.setItemAsync(key, data);
        }
    } catch (error) {
        console.error("Error saving onboarding paywall state:", error);
    }
}

export async function hasSeenOnboardingPaywall(userId: string): Promise<boolean> {
    return getStorage(buildKey(userId));
}

export async function markOnboardingPaywallSeen(userId: string): Promise<void> {
    await setStorage(buildKey(userId), true);
}
