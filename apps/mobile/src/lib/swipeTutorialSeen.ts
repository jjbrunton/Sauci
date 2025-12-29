import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const STORAGE_KEY = "swipe_tutorial_seen";

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
        console.error("Error reading swipe tutorial state:", error);
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
        console.error("Error saving swipe tutorial state:", error);
    }
}

export async function hasSeenSwipeTutorial(): Promise<boolean> {
    return getStorage();
}

export async function markSwipeTutorialSeen(): Promise<void> {
    await setStorage(true);
}

export async function resetSwipeTutorial(): Promise<void> {
    await setStorage(false);
}
