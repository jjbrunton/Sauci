import AsyncStorage from "@react-native-async-storage/async-storage";

const keyFor = (userId: string, coupleId: string) => `paired_unlock_seen_${userId}_${coupleId}`;

export async function hasSeenPairedUnlock(userId: string, coupleId: string): Promise<boolean> {
    return (await AsyncStorage.getItem(keyFor(userId, coupleId))) === "true";
}

export async function markPairedUnlockSeen(userId: string, coupleId: string): Promise<void> {
    await AsyncStorage.setItem(keyFor(userId, coupleId), "true");
}

export async function clearPairedUnlockSeen(userId: string, coupleId: string | null): Promise<void> {
    if (coupleId) await AsyncStorage.removeItem(keyFor(userId, coupleId));
}
