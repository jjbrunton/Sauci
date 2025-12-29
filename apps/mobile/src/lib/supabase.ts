import "react-native-url-polyfill/auto";
import { createClient } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

// In-memory storage fallback for SSR/Node.js environments
const memoryStorage: Record<string, string> = {};

// AsyncStorage adapter for Supabase auth
// Note: We use AsyncStorage instead of SecureStore because Supabase JWTs
// can exceed SecureStore's 2048 byte limit
const ExpoStorageAdapter = {
    getItem: async (key: string): Promise<string | null> => {
        if (Platform.OS === "web") {
            // Check if we're in a browser environment with localStorage
            if (typeof window !== "undefined" && typeof window.localStorage !== "undefined") {
                return window.localStorage.getItem(key);
            }
            // Fallback for SSR/Node.js
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
            // Fallback for SSR/Node.js
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
            // Fallback for SSR/Node.js
            delete memoryStorage[key];
            return;
        }
        await AsyncStorage.removeItem(key);
    },
};

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

// DEBUG: Log which key is being used
console.log("DEBUG - Anon key preview:", supabaseAnonKey?.substring(0, 30) + "...");

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        storage: ExpoStorageAdapter,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: Platform.OS === "web",
    },
});

