import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

import { profileSettingsApi } from "./profileSettingsApi";

const STORAGE_KEY_PREFIX = "reported_timezone";

const buildKey = (userId: string): string => `${STORAGE_KEY_PREFIX}_${userId}`;

/** The IANA zone this device is in, or null when the platform can't resolve one. */
export function resolveDeviceTimezone(): string | null {
    try {
        const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        return zone && zone.length <= 64 ? zone : null;
    } catch {
        return null;
    }
}

async function readStored(key: string): Promise<string | null> {
    try {
        if (Platform.OS === "web") {
            if (typeof window !== "undefined" && typeof window.localStorage !== "undefined") {
                return window.localStorage.getItem(key);
            }
            return null;
        }
        return await SecureStore.getItemAsync(key);
    } catch (error) {
        console.error("Error reading reported timezone:", error);
        return null;
    }
}

async function writeStored(key: string, zone: string): Promise<void> {
    try {
        if (Platform.OS === "web") {
            if (typeof window !== "undefined" && typeof window.localStorage !== "undefined") {
                window.localStorage.setItem(key, zone);
            }
            return;
        }
        await SecureStore.setItemAsync(key, zone);
    } catch (error) {
        console.error("Error saving reported timezone:", error);
    }
}

/**
 * Report the device timezone to the server so the daily response limit buckets on the
 * user's local day. Cached locally, so this costs one write on install and one per
 * actual travel event rather than one per foreground.
 */
export async function syncTimezone(userId: string): Promise<void> {
    const zone = resolveDeviceTimezone();
    if (!zone) return;

    const key = buildKey(userId);
    if (await readStored(key) === zone) return;

    try {
        await profileSettingsApi.updateProfile({ timezone: zone });
        await writeStored(key, zone);
    } catch (error) {
        // Non-critical: the server falls back to UTC until this succeeds.
        console.error("Failed to sync timezone:", error);
    }
}
