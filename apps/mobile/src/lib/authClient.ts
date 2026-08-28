import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import { Platform } from "react-native";

// Supabase is retained as Sauci's identity provider only. Product data should
// Product data uses apiClient. This client is intentionally Auth-only.
const memoryStorage: Record<string, string> = {};

const ExpoStorageAdapter = {
    getItem: async (key: string): Promise<string | null> => {
        if (Platform.OS === "web") {
            if (typeof window !== "undefined" && typeof window.localStorage !== "undefined") {
                return window.localStorage.getItem(key);
            }
            return memoryStorage[key] ?? null;
        }
        return AsyncStorage.getItem(key);
    },
    setItem: async (key: string, value: string): Promise<void> => {
        if (Platform.OS === "web") {
            if (typeof window !== "undefined" && typeof window.localStorage !== "undefined") {
                window.localStorage.setItem(key, value);
                return;
            }
            memoryStorage[key] = value;
            return;
        }
        await AsyncStorage.setItem(key, value);
    },
    removeItem: async (key: string): Promise<void> => {
        if (Platform.OS === "web") {
            if (typeof window !== "undefined" && typeof window.localStorage !== "undefined") {
                window.localStorage.removeItem(key);
                return;
            }
            delete memoryStorage[key];
            return;
        }
        await AsyncStorage.removeItem(key);
    },
};

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const isTestEnv = process.env.NODE_ENV === "test" || process.env.JEST_WORKER_ID !== undefined;

if (!isTestEnv && (!supabaseUrl || !supabaseAnonKey)) {
    const missing = [];
    if (!supabaseUrl) missing.push("EXPO_PUBLIC_SUPABASE_URL");
    if (!supabaseAnonKey) missing.push("EXPO_PUBLIC_SUPABASE_ANON_KEY");
    const message = `Missing required environment variables: ${missing.join(", ")}. App cannot start.`;
    console.error("[Auth]", message);
    throw new Error(message);
}

const finalUrl = supabaseUrl || (isTestEnv ? "https://test.supabase.co" : "");
const finalKey = supabaseAnonKey || (isTestEnv ? "test-key" : "");

export const authClient = createClient(finalUrl, finalKey, {
    auth: {
        storage: ExpoStorageAdapter,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: Platform.OS === "web",
    },
});
