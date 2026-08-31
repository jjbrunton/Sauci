import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const STORAGE_KEY_PREFIX = "matches_tutorial_seen";
const LEGACY_STORAGE_KEY = "matches_tutorial_seen";

const buildKey = (userId: string): string => `${STORAGE_KEY_PREFIX}_${userId}`;

async function getStorage(userId: string): Promise<boolean> {
    try {
        const key = buildKey(userId);

        if (Platform.OS === "web") {
            if (typeof window !== "undefined" && typeof window.localStorage !== "undefined") {
                return window.localStorage.getItem(key) === "true";
            }

            return false;
        }

        const storedValue = await AsyncStorage.getItem(key);
        if (storedValue !== null) {
            return storedValue === "true";
        }

        // Keep dismissals made before the account-scoped AsyncStorage key was
        // introduced. Future reads use the durable app storage key above.
        const legacyValue = await SecureStore.getItemAsync(LEGACY_STORAGE_KEY);
        if (legacyValue === "true") {
            await AsyncStorage.setItem(key, "true");
            return true;
        }

        return false;
    } catch (error) {
        console.error("Error reading matches tutorial state:", error);
    }
    return false;
}

async function setStorage(userId: string, seen: boolean): Promise<void> {
    try {
        const data = seen ? "true" : "false";
        const key = buildKey(userId);

        if (Platform.OS === "web") {
            if (typeof window !== "undefined" && typeof window.localStorage !== "undefined") {
                window.localStorage.setItem(key, data);
            }
        } else {
            await AsyncStorage.setItem(key, data);
        }
    } catch (error) {
        console.error("Error saving matches tutorial state:", error);
    }
}

/** The Matches tutorial is shown at most once per signed-in account. */
export async function hasSeenMatchesTutorial(userId: string): Promise<boolean> {
    return getStorage(userId);
}

export async function markMatchesTutorialSeen(userId: string): Promise<void> {
    await setStorage(userId, true);
}

export async function resetMatchesTutorial(userId: string): Promise<void> {
    await setStorage(userId, false);
}
