// Deferred hand-off storage for an invite code received before the user is
// signed in or has finished onboarding. The code is applied once the user
// reaches the pairing screen (see app/(app)/pairing.tsx and app/index.tsx).

import AsyncStorage from "@react-native-async-storage/async-storage";
import { isValidInviteCode, normalizeInviteCode } from "./inviteLink";

const STORAGE_KEY = "pending_invite_code";
let storageOperation = Promise.resolve();

function withStorageLock<T>(operation: () => Promise<T>): Promise<T> {
    const next = storageOperation.then(operation, operation);
    storageOperation = next.then(() => undefined, () => undefined);
    return next;
}

interface PendingInviteCode {
    code: string;
    /** The account that received or first claimed this deferred invite. */
    userId: string | null;
}

function parsePendingInviteCode(value: string | null): PendingInviteCode | null {
    if (!value) return null;

    // Treat legacy, unscoped values as a pre-auth hand-off. The first account
    // that intentionally enters the pairing flow claims it below.
    if (isValidInviteCode(value)) return { code: normalizeInviteCode(value), userId: null };

    try {
        const parsed = JSON.parse(value) as Partial<PendingInviteCode>;
        if (typeof parsed.code !== "string" || !isValidInviteCode(parsed.code)) return null;
        if (parsed.userId !== null && typeof parsed.userId !== "string") return null;
        return { code: normalizeInviteCode(parsed.code), userId: parsed.userId ?? null };
    } catch {
        return null;
    }
}

export async function stashPendingInviteCode(code: string, userId: string | null = null): Promise<void> {
    try {
        await withStorageLock(() => AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ code: normalizeInviteCode(code), userId } satisfies PendingInviteCode)));
    } catch (error) {
        console.error("Error stashing pending invite code:", error);
    }
}

export async function getPendingInviteCode(userId: string): Promise<string | null> {
    try {
        return await withStorageLock(async () => {
            const pending = parsePendingInviteCode(await AsyncStorage.getItem(STORAGE_KEY));
            if (!pending || (pending.userId && pending.userId !== userId)) return null;

            // A hand-off made before sign-in becomes owned by the account that
            // reaches pairing. Later account switches cannot consume it.
            if (!pending.userId) {
                await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ ...pending, userId }));
            }
            return pending.code;
        });
    } catch (error) {
        console.error("Error reading pending invite code:", error);
        return null;
    }
}

export async function clearPendingInviteCode(userId?: string): Promise<void> {
    try {
        await withStorageLock(async () => {
            if (userId) {
                const pending = parsePendingInviteCode(await AsyncStorage.getItem(STORAGE_KEY));
                if (pending?.userId && pending.userId !== userId) return;
            }
            await AsyncStorage.removeItem(STORAGE_KEY);
        });
    } catch (error) {
        console.error("Error clearing pending invite code:", error);
    }
}
