import { create } from "zustand";
import { supabase } from "../lib/supabase";
import { Events } from "../lib/analytics";
import { clearKeys } from "../lib/encryption";
import { clearDecryptedMediaCache } from "../hooks/useDecryptedMedia";
import type { Profile, Couple } from "@/types";
import type { RSAPublicKeyJWK, RSAPrivateKeyJWK } from "../lib/encryption/types";

/**
 * Encryption key state - stored globally to ensure all components
 * share the same key state and avoid race conditions during encryption.
 */
interface EncryptionKeyState {
    privateKeyJwk: RSAPrivateKeyJWK | null;
    publicKeyJwk: RSAPublicKeyJWK | null;
    hasKeys: boolean;
    isLoadingKeys: boolean;
    keysError: Error | null;
    /** Incremented when keys change - consumers can use this to trigger re-renders */
    keysVersion: number;
}

interface AuthState {
    user: Profile | null;
    couple: Couple | null;
    partner: Profile | null;
    isLoading: boolean;
    isAuthenticated: boolean;

    // Encryption key state (global to avoid hook instance sync issues)
    encryptionKeys: EncryptionKeyState;

    // Actions
    fetchUser: () => Promise<void>;
    fetchCouple: () => Promise<void>;
    refreshPartner: () => Promise<Profile | null>;
    signOut: () => Promise<void>;
    setUser: (user: Profile | null) => void;

    // Encryption key actions
    setEncryptionKeys: (keys: Partial<EncryptionKeyState>) => void;
    clearEncryptionKeys: () => void;
}

// Import other stores lazily to avoid circular dependency issues
const getOtherStores = () => {
    const { useMatchStore } = require("./matchStore");
    const { usePacksStore } = require("./packsStore");
    const { useMessageStore } = require("./messageStore");
    const { useSubscriptionStore } = require("./subscriptionStore");
    return { useMatchStore, usePacksStore, useMessageStore, useSubscriptionStore };
};

const initialEncryptionKeyState: EncryptionKeyState = {
    privateKeyJwk: null,
    publicKeyJwk: null,
    hasKeys: false,
    isLoadingKeys: true,
    keysError: null,
    keysVersion: 0,
};

export const useAuthStore = create<AuthState>((set, get) => ({
    user: null,
    couple: null,
    partner: null,
    isLoading: true,
    isAuthenticated: false,
    encryptionKeys: initialEncryptionKeyState,

    fetchUser: async () => {
        try {
            // First check if we have a session in storage
            const { data: { session } } = await supabase.auth.getSession();

            if (!session?.user) {
                set({ user: null, isAuthenticated: false, isLoading: false });
                return;
            }

            // Validate the session by fetching the user from the server
            // This will fail if the session was deleted server-side
            const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();

            if (authError || !authUser) {
                console.log("[Auth] Session invalid, signing out:", authError?.message);
                
                // Clear E2EE keys
                try {
                    await clearKeys();
                } catch (error) {
                    console.error("Failed to clear encryption keys:", error);
                }

                // Session is invalid - clear everything
                set({ user: null, couple: null, partner: null, isAuthenticated: false, isLoading: false });
                // Clear other stores
                const { useMatchStore, usePacksStore, useMessageStore, useSubscriptionStore } = getOtherStores();
                useMatchStore.getState().clearMatches();
                usePacksStore.getState().clearPacks();
                useMessageStore.getState().clearMessages();
                useSubscriptionStore.getState().clearSubscription();
                // Sign out from Supabase (clears storage)
                await supabase.auth.signOut();
                return;
            }

            const { data: profile } = await supabase
                .from("profiles")
                .select("*")
                .eq("id", authUser.id)
                .maybeSingle();

            set({
                user: profile,
                isAuthenticated: true,
            });

            // If user has a couple, fetch couple data; otherwise clear couple/partner
            if (profile?.couple_id) {
                await get().fetchCouple();
            } else {
                set({ couple: null, partner: null });
            }

            set({ isLoading: false });
        } catch (error) {
            console.error("Error fetching user:", error);
            set({ isLoading: false });
        }
    },

    fetchCouple: async () => {
        const user = get().user;
        if (!user?.couple_id) return;

        const { data: couple } = await supabase
            .from("couples")
            .select("*")
            .eq("id", user.couple_id)
            .maybeSingle();

        // Fetch partner
        const { data: partner } = await supabase
            .from("profiles")
            .select("*")
            .eq("couple_id", user.couple_id)
            .neq("id", user.id)
            .maybeSingle();

        set({ couple, partner });
    },

    /**
     * Refresh partner's profile data (useful to get latest public_key_jwk for E2EE)
     * Returns the updated partner profile or null if not found
     */
    refreshPartner: async () => {
        const user = get().user;
        if (!user?.couple_id) return null;

        const { data: partner } = await supabase
            .from("profiles")
            .select("*")
            .eq("couple_id", user.couple_id)
            .neq("id", user.id)
            .maybeSingle();

        if (partner) {
            set({ partner });
        }
        return partner;
    },

    signOut: async () => {
        Events.signOut();

        // Clear E2EE keys from storage
        try {
            await clearKeys();
        } catch (error) {
            console.error("Failed to clear encryption keys:", error);
        }

        // Clear decrypted media cache to free storage
        try {
            await clearDecryptedMediaCache();
        } catch (error) {
            console.error("Failed to clear media cache:", error);
        }

        // Clear local state FIRST to ensure UI updates even if Supabase call fails
        set({
            user: null,
            couple: null,
            partner: null,
            isAuthenticated: false,
            isLoading: false,
            encryptionKeys: initialEncryptionKeyState,
        });
        // Clear other stores
        const { useMatchStore, usePacksStore, useMessageStore, useSubscriptionStore } = getOtherStores();
        useMatchStore.getState().clearMatches();
        usePacksStore.getState().clearPacks();
        useMessageStore.getState().clearMessages();
        useSubscriptionStore.getState().clearSubscription();

        // Then try to sign out from Supabase (don't block on this)
        try {
            await supabase.auth.signOut();
        } catch (error) {
            console.error("Supabase signOut error:", error);
        }
    },

    setUser: (user) => {
        set({
            user,
            isAuthenticated: !!user,
            isLoading: false,
            // Clear couple/partner when user is null (signed out)
            ...(user === null && { couple: null, partner: null })
        });
        // Clear other stores when user signs out
        if (user === null) {
            const { useMatchStore, usePacksStore, useMessageStore, useSubscriptionStore } = getOtherStores();
            useMatchStore.getState().clearMatches();
            usePacksStore.getState().clearPacks();
            useMessageStore.getState().clearMessages();
            useSubscriptionStore.getState().clearSubscription();
        }
    },

    /**
     * Update encryption key state. This is the ONLY way to update keys
     * to ensure all consumers see the same state.
     */
    setEncryptionKeys: (keys) => {
        set((state) => ({
            encryptionKeys: {
                ...state.encryptionKeys,
                ...keys,
                // Increment version when keys actually change
                keysVersion: (keys.publicKeyJwk !== undefined || keys.privateKeyJwk !== undefined)
                    ? state.encryptionKeys.keysVersion + 1
                    : state.encryptionKeys.keysVersion,
            },
        }));
    },

    /**
     * Clear encryption keys (called on sign out or when leaving couple)
     */
    clearEncryptionKeys: () => {
        set({ encryptionKeys: initialEncryptionKeyState });
    },
}));
