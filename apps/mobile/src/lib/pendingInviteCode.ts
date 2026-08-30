// Deferred hand-off storage for an invite code received before the user is
// signed in or has finished onboarding. The code is applied once the user
// reaches the pairing screen (see app/(app)/pairing.tsx and app/index.tsx).

import AsyncStorage from "@react-native-async-storage/async-storage";
import { isValidInviteCode, normalizeInviteCode } from "./inviteLink";

const STORAGE_KEY = "pending_invite_code";

export async function stashPendingInviteCode(code: string): Promise<void> {
    try {
        await AsyncStorage.setItem(STORAGE_KEY, normalizeInviteCode(code));
    } catch (error) {
        console.error("Error stashing pending invite code:", error);
    }
}

export async function getPendingInviteCode(): Promise<string | null> {
    try {
        const value = await AsyncStorage.getItem(STORAGE_KEY);
        if (value && isValidInviteCode(value)) {
            return normalizeInviteCode(value);
        }
        return null;
    } catch (error) {
        console.error("Error reading pending invite code:", error);
        return null;
    }
}

export async function clearPendingInviteCode(): Promise<void> {
    try {
        await AsyncStorage.removeItem(STORAGE_KEY);
    } catch (error) {
        console.error("Error clearing pending invite code:", error);
    }
}
