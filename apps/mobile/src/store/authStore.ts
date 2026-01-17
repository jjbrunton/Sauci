import { create } from "zustand";
import { supabase } from "../lib/supabase";
import { Events } from "../lib/analytics";
import type { Profile, Couple } from "@/types";


interface AuthState {
    user: Profile | null;
    couple: Couple | null;
    partner: Profile | null;
    isLoading: boolean;
    isAuthenticated: boolean;
    isAnonymous: boolean;


    // Actions
    fetchUser: () => Promise<void>;
    fetchCouple: () => Promise<void>;
    refreshPartner: () => Promise<Profile | null>;
    signOut: () => Promise<void>;
    setUser: (user: Profile | null) => void;
    updateLastActive: () => Promise<void>;
}

// Import other stores lazily to avoid circular dependency issues
const getOtherStores = () => {
    const { useMatchStore } = require("./matchStore");
    const { usePacksStore } = require("./packsStore");
    const { useMessageStore } = require("./messageStore");
    const { useSubscriptionStore } = require("./subscriptionStore");
    const { useNotificationPreferencesStore } = require("./notificationPreferencesStore");
    const { useStreakStore } = require("./streakStore");
    return { useMatchStore, usePacksStore, useMessageStore, useSubscriptionStore, useNotificationPreferencesStore, useStreakStore };
};


export const useAuthStore = create<AuthState>((set, get) => ({
    user: null,
    couple: null,
    partner: null,
    isLoading: true,
    isAuthenticated: false,
    isAnonymous: false,

    fetchUser: async () => {
        try {
            // First check if we have a session in storage
            const { data: { session } } = await supabase.auth.getSession();

            if (!session?.user) {
                set({ user: null, isAuthenticated: false, isAnonymous: false, isLoading: false });
                return;
            }

            // Validate the session by fetching the user from the server
            // This will fail if the session was deleted server-side
            const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();

            if (authError || !authUser) {
                console.log("[Auth] Session invalid, signing out:", authError?.message);

                // Session is invalid - clear everything
                set({ user: null, couple: null, partner: null, isAuthenticated: false, isAnonymous: false, isLoading: false });
                // Clear other stores
                const { useMatchStore, usePacksStore, useMessageStore, useSubscriptionStore, useNotificationPreferencesStore, useStreakStore } = getOtherStores();
                useMatchStore.getState().clearMatches();
                usePacksStore.getState().clearPacks();
                useMessageStore.getState().clearMessages();
                useSubscriptionStore.getState().clearSubscription();
                useNotificationPreferencesStore.getState().clearPreferences();
                useStreakStore.getState().clearStreak();
                // Sign out from Supabase (clears storage)
                await supabase.auth.signOut();
                return;
            }

            const { data: profile } = await supabase
                .from("profiles")
                .select("*")
                .eq("id", authUser.id)
                .maybeSingle();

            const isAnonymous = !!(authUser as any).is_anonymous;

            set({
                user: profile,
                isAuthenticated: true,
                isAnonymous,
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

        // Clear local state FIRST to ensure UI updates even if Supabase call fails
         set({
             user: null,
             couple: null,
             partner: null,
             isAuthenticated: false,
             isAnonymous: false,
             isLoading: false,
         });
        // Clear other stores
        const { useMatchStore, usePacksStore, useMessageStore, useSubscriptionStore, useNotificationPreferencesStore, useStreakStore } = getOtherStores();
        useMatchStore.getState().clearMatches();
        usePacksStore.getState().clearPacks();
        useMessageStore.getState().clearMessages();
        useSubscriptionStore.getState().clearSubscription();
        useNotificationPreferencesStore.getState().clearPreferences();
        useStreakStore.getState().clearStreak();

        // Clear badge on sign out
        const { clearBadge } = require("../lib/badge");
        await clearBadge();

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
            ...(user === null && { isAnonymous: false }),
            isLoading: false,
            // Clear couple/partner when user is null (signed out)
            ...(user === null && { couple: null, partner: null })
        });
        // Clear other stores when user signs out
        if (user === null) {
            const { useMatchStore, usePacksStore, useMessageStore, useSubscriptionStore, useNotificationPreferencesStore, useStreakStore } = getOtherStores();
            useMatchStore.getState().clearMatches();
            usePacksStore.getState().clearPacks();
            useMessageStore.getState().clearMessages();
            useSubscriptionStore.getState().clearSubscription();
            useNotificationPreferencesStore.getState().clearPreferences();
            useStreakStore.getState().clearStreak();
            // Clear badge on sign out
            const { clearBadge } = require("../lib/badge");
            clearBadge();
        }
    },

    /**
     * Update the user's last_active_at timestamp.
     * Called when the app comes to the foreground to track user activity.
     * This helps prevent sending notifications to users who are already in the app.
     */
    updateLastActive: async () => {
        const userId = get().user?.id;
        if (!userId) return;

        try {
            await supabase
                .from("profiles")
                .update({ last_active_at: new Date().toISOString() })
                .eq("id", userId);
        } catch (error) {
            // Silently fail - this is not critical
            console.error("Failed to update last_active_at:", error);
        }
    },
}));

