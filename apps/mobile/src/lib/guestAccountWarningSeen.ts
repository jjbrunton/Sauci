import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY_PREFIX = "guest_account_recovery_warning_seen";

const buildKey = (userId: string): string => `${STORAGE_KEY_PREFIX}_${userId}`;

async function getStorage(key: string): Promise<boolean> {
    try {
        return (await AsyncStorage.getItem(key)) === "true";
    } catch (error) {
        console.error("Error reading guest warning state:", error);
    }
    return false;
}

async function setStorage(key: string, seen: boolean): Promise<void> {
    try {
        await AsyncStorage.setItem(key, seen ? "true" : "false");
    } catch (error) {
        console.error("Error saving guest warning state:", error);
    }
}

/** The recovery warning is shown at most once for each anonymous account. */
export async function hasSeenGuestAccountWarning(userId: string): Promise<boolean> {
    return getStorage(buildKey(userId));
}

export async function markGuestAccountWarningSeen(userId: string): Promise<void> {
    await setStorage(buildKey(userId), true);
}
