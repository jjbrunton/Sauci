import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const STORAGE_KEY = "guest_account_recovery_warning_seen";

async function getStorage(): Promise<boolean> {
    try {
        let data: string | null = null;

        if (Platform.OS === "web") {
            if (typeof window !== "undefined" && typeof window.localStorage !== "undefined") {
                data = window.localStorage.getItem(STORAGE_KEY);
            }
        } else {
            data = await SecureStore.getItemAsync(STORAGE_KEY);
        }

        return data === "true";
    } catch (error) {
        console.error("Error reading guest warning state:", error);
    }
    return false;
}

async function setStorage(seen: boolean): Promise<void> {
    try {
        const data = seen ? "true" : "false";

        if (Platform.OS === "web") {
            if (typeof window !== "undefined" && typeof window.localStorage !== "undefined") {
                window.localStorage.setItem(STORAGE_KEY, data);
            }
        } else {
            await SecureStore.setItemAsync(STORAGE_KEY, data);
        }
    } catch (error) {
        console.error("Error saving guest warning state:", error);
    }
}

export async function hasSeenGuestAccountWarning(): Promise<boolean> {
    return getStorage();
}

export async function markGuestAccountWarningSeen(): Promise<void> {
    await setStorage(true);
}
