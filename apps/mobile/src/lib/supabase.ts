import "react-native-url-polyfill/auto";
import { createClient } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

// In-memory storage fallback for SSR/Node.js environments
const memoryStorage: Record<string, string> = {};

// SecureStore adapter for Supabase auth
const ExpoSecureStoreAdapter = {
    getItem: (key: string) => {
        if (Platform.OS === "web") {
            // Check if we're in a browser environment with localStorage
            if (typeof window !== "undefined" && typeof window.localStorage !== "undefined") {
                return window.localStorage.getItem(key);
            }
            // Fallback for SSR/Node.js
            return memoryStorage[key] ?? null;
        }
        return SecureStore.getItemAsync(key);
    },
    setItem: (key: string, value: string) => {
        if (Platform.OS === "web") {
            if (typeof window !== "undefined" && typeof window.localStorage !== "undefined") {
                window.localStorage.setItem(key, value);
                return;
            }
            // Fallback for SSR/Node.js
            memoryStorage[key] = value;
            return;
        }
        return SecureStore.setItemAsync(key, value);
    },
    removeItem: (key: string) => {
        if (Platform.OS === "web") {
            if (typeof window !== "undefined" && typeof window.localStorage !== "undefined") {
                window.localStorage.removeItem(key);
                return;
            }
            // Fallback for SSR/Node.js
            delete memoryStorage[key];
            return;
        }
        return SecureStore.deleteItemAsync(key);
    },
};

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

// DEBUG: Log which key is being used
console.log("DEBUG - Anon key preview:", supabaseAnonKey?.substring(0, 30) + "...");

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        storage: ExpoSecureStoreAdapter,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: Platform.OS === "web",
    },
});

