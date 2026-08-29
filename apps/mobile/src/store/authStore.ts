import { create } from "zustand";
import { ApiError, apiClient } from "../lib/apiClient";
import { authClient } from "../lib/authClient";
import { coupleApi } from "../lib/coupleApi";
import { profileSettingsApi } from "../lib/profileSettingsApi";
import { syncTimezone } from "../lib/reportedTimezone";
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
    const { useResponsesStore } = require("./responsesStore");
    return { useMatchStore, usePacksStore, useMessageStore, useSubscriptionStore, useNotificationPreferencesStore, useStreakStore, useResponsesStore };
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
            const { data: { session } } = await authClient.auth.getSession();

            if (!session?.user) {
                set({ user: null, isAuthenticated: false, isAnonymous: false, isLoading: false });
                return;
            }

            // This endpoint verifies the Supabase access token and creates the
            // product profile on first use, keeping profile data out of Supabase.
            const { profile } = await apiClient.get<{ profile: Profile }>("/v1/me");

            const isAnonymous = !!(session.user as { is_anonymous?: boolean }).is_anonymous;

            // Only update user if data actually changed to avoid unnecessary re-renders
            const currentUser = get().user;
            const userChanged = !currentUser || JSON.stringify(currentUser) !== JSON.stringify(profile);
            if (userChanged) {
                set({
                    user: profile,
                    isAuthenticated: true,
                    isAnonymous,
                });
            } else if (!get().isAuthenticated) {
                set({ isAuthenticated: true, isAnonymous });
            }

            // If user has a couple, fetch couple data; otherwise clear couple/partner
            if (profile?.couple_id) {
                await get().fetchCouple();
            } else {
                set({ couple: null, partner: null });
            }

            set({ isLoading: false });
        } catch (error) {
            if (error instanceof ApiError && error.status === 401) {
                console.log("[Auth] Session rejected by API, signing out");
                set({ user: null, couple: null, partner: null, isAuthenticated: false, isAnonymous: false, isLoading: false });
                const { useMatchStore, usePacksStore, useMessageStore, useSubscriptionStore, useNotificationPreferencesStore, useStreakStore, useResponsesStore } = getOtherStores();
                useMatchStore.getState().clearMatches();
                usePacksStore.getState().clearPacks();
                useMessageStore.getState().clearMessages();
                useSubscriptionStore.getState().clearSubscription();
                useNotificationPreferencesStore.getState().clearPreferences();
                useStreakStore.getState().clearStreak();
                useResponsesStore.getState().clearResponses();
                await authClient.auth.signOut();
                return;
            }
            console.error("Error fetching user:", error);
            set({ isLoading: false });
        }
    },

    fetchCouple: async () => {
        const user = get().user;
        if (!user?.couple_id) {
            set({ couple: null, partner: null });
            return;
        }

        const { couple, partner } = await coupleApi.getState();
        set({ couple, partner });
    },

    /**
     * Refresh partner's profile data (useful to get latest public_key_jwk for E2EE)
     * Returns the updated partner profile or null if not found
     */
    refreshPartner: async () => {
        const user = get().user;
        if (!user?.couple_id) return null;

        const { partner } = await coupleApi.getState();

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
        const { useMatchStore, usePacksStore, useMessageStore, useSubscriptionStore, useNotificationPreferencesStore, useStreakStore, useResponsesStore } = getOtherStores();
        useMatchStore.getState().clearMatches();
        usePacksStore.getState().clearPacks();
        useMessageStore.getState().clearMessages();
        useSubscriptionStore.getState().clearSubscription();
        useNotificationPreferencesStore.getState().clearPreferences();
        useStreakStore.getState().clearStreak();
        useResponsesStore.getState().clearResponses();

        // Clear badge on sign out
        const { clearBadge } = require("../lib/badge");
        await clearBadge();

        // Then try to sign out from Supabase (don't block on this)
        try {
            await authClient.auth.signOut();
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
            const { useMatchStore, usePacksStore, useMessageStore, useSubscriptionStore, useNotificationPreferencesStore, useStreakStore, useResponsesStore } = getOtherStores();
            useMatchStore.getState().clearMatches();
            usePacksStore.getState().clearPacks();
            useMessageStore.getState().clearMessages();
            useSubscriptionStore.getState().clearSubscription();
            useNotificationPreferencesStore.getState().clearPreferences();
            useStreakStore.getState().clearStreak();
            useResponsesStore.getState().clearResponses();
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
            await profileSettingsApi.updateLastActive();
        } catch (error) {
            // Silently fail - this is not critical
            console.error("Failed to update last_active_at:", error);
        }

        // Keep the server's idea of the user's timezone current so the daily
        // response limit resets at their local midnight, not 00:00 UTC.
        void syncTimezone(userId);
    },
}));

