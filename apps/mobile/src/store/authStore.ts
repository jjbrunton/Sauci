import { create } from "zustand";
import { ApiError, apiClient } from "../lib/apiClient";
import { authClient } from "../lib/authClient";
import { coupleApi } from "../lib/coupleApi";
import { profileSettingsApi } from "../lib/profileSettingsApi";
import { syncTimezone } from "../lib/reportedTimezone";
import { Events } from "../lib/analytics";
import type { Profile, Couple } from "@/types";

export interface AuthSessionSnapshot {
    userId: string;
    accessToken: string;
    isAnonymous: boolean;
}

let fetchUserGeneration = 0;

const snapshotSession = (session: { user?: { id: string; is_anonymous?: boolean }; access_token?: string } | null): AuthSessionSnapshot | null => {
    if (!session?.user?.id || !session.access_token) return null;
    return {
        userId: session.user.id,
        accessToken: session.access_token,
        isAnonymous: !!session.user.is_anonymous,
    };
};

interface AuthState {
    user: Profile | null;
    couple: Couple | null;
    partner: Profile | null;
    /** This user's banked (sealed) answers with no couple yet. Zero once claimed at pairing. */
    sealedCount: number;
    isLoading: boolean;
    isAuthenticated: boolean;
    isAnonymous: boolean;
    /** First-authorization Apple name held only until the API profile reflects it. */
    pendingAppleDisplayName: { userId: string; name: string } | null;


    // Actions
    fetchUser: (expectedSession?: AuthSessionSnapshot) => Promise<void>;
    fetchCouple: () => Promise<void>;
    refreshPartner: () => Promise<Profile | null>;
    signOut: () => Promise<void>;
    setUser: (user: Profile | null) => void;
    setPendingAppleDisplayName: (pending: { userId: string; name: string } | null) => void;
    clearPendingAppleDisplayName: (userId: string) => void;
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
    const { useQuizStore } = require("./quizStore");
    return { useMatchStore, usePacksStore, useMessageStore, useSubscriptionStore, useNotificationPreferencesStore, useStreakStore, useResponsesStore, useQuizStore };
};


export const useAuthStore = create<AuthState>((set, get) => ({
    user: null,
    couple: null,
    partner: null,
    sealedCount: 0,
    isLoading: true,
    isAuthenticated: false,
    isAnonymous: false,
    pendingAppleDisplayName: null,

    fetchUser: async (expectedSession) => {
        const generation = ++fetchUserGeneration;
        let snapshot: AuthSessionSnapshot | null = expectedSession ?? null;
        const isCurrentSession = async (snapshot: AuthSessionSnapshot): Promise<boolean> => {
            if (generation !== fetchUserGeneration) return false;

            const { data: { session } } = await authClient.auth.getSession();
            return generation === fetchUserGeneration
                && session?.user?.id === snapshot.userId
                && session.access_token === snapshot.accessToken;
        };

        try {
            // Capture the session that owns this refresh. All following API calls
            // and state writes remain bound to it, never the ambient auth session.
            snapshot = expectedSession ?? snapshotSession((await authClient.auth.getSession()).data.session);

            if (!snapshot) {
                if (generation !== fetchUserGeneration) return;
                set({ user: null, isAuthenticated: false, isAnonymous: false, isLoading: false, pendingAppleDisplayName: null });
                return;
            }

            // This endpoint verifies the Supabase access token and creates the
            // product profile on first use, keeping profile data out of Supabase.
            const { profile } = await apiClient.getWithAccessToken<{ profile: Profile }>("/v1/me", snapshot.accessToken);

            if (!(await isCurrentSession(snapshot))) return;

            if (profile.id !== snapshot.userId) {
                console.error("[Auth] API profile subject did not match the authenticated session");
                // Fail closed rather than leaving the prior account visible when
                // an API response cannot be proven to belong to this session.
                set({ user: null, couple: null, partner: null, sealedCount: 0, isAuthenticated: false, isAnonymous: false, isLoading: false, pendingAppleDisplayName: null });
                const { useMatchStore, usePacksStore, useMessageStore, useSubscriptionStore, useNotificationPreferencesStore, useStreakStore, useResponsesStore, useQuizStore } = getOtherStores();
                useMatchStore.getState().clearMatches();
                usePacksStore.getState().clearPacks();
                useMessageStore.getState().clearMessages();
                useSubscriptionStore.getState().clearSubscription();
                useNotificationPreferencesStore.getState().clearPreferences();
                useStreakStore.getState().clearStreak();
                useResponsesStore.getState().clearResponses();
                useQuizStore.getState().clearQuiz();
                return;
            }

            const isAnonymous = snapshot.isAnonymous;

            // Only update user if data actually changed to avoid unnecessary re-renders
            const currentUser = get().user;
            const userChanged = !currentUser || JSON.stringify(currentUser) !== JSON.stringify(profile);
            // Always fetch couple state: it reports the sealed answer count for a
            // solo user even before any couple exists, not just once paired.
            const { couple, partner, sealed_count } = await coupleApi.getStateWithAccessToken(snapshot.accessToken);

            if (!(await isCurrentSession(snapshot))) return;

            if (userChanged) {
                set({
                    user: profile,
                    couple,
                    partner,
                    sealedCount: sealed_count,
                    isAuthenticated: true,
                    isAnonymous,
                    isLoading: false,
                });
            } else {
                set({
                    couple,
                    partner,
                    sealedCount: sealed_count,
                    isAuthenticated: true,
                    isAnonymous,
                    isLoading: false,
                });
            }
        } catch (error) {
            if (generation !== fetchUserGeneration) return;

            const currentSnapshot = snapshot;
            if (currentSnapshot && !(await isCurrentSession(currentSnapshot))) return;

            if (error instanceof ApiError && error.status === 401) {
                console.log("[Auth] Session rejected by API, signing out");
                set({ user: null, couple: null, partner: null, sealedCount: 0, isAuthenticated: false, isAnonymous: false, isLoading: false, pendingAppleDisplayName: null });
                const { useMatchStore, usePacksStore, useMessageStore, useSubscriptionStore, useNotificationPreferencesStore, useStreakStore, useResponsesStore, useQuizStore } = getOtherStores();
                useMatchStore.getState().clearMatches();
                usePacksStore.getState().clearPacks();
                useMessageStore.getState().clearMessages();
                useSubscriptionStore.getState().clearSubscription();
                useNotificationPreferencesStore.getState().clearPreferences();
                useStreakStore.getState().clearStreak();
                useResponsesStore.getState().clearResponses();
                useQuizStore.getState().clearQuiz();
                await authClient.auth.signOut();
                return;
            }
            console.error("Error fetching user:", error);
            set({ isLoading: false });
        }
    },

    fetchCouple: async () => {
        // Fetches unconditionally: getState() reports sealed_count for a solo user
        // who has no couple yet too, not only once paired.
        const { couple, partner, sealed_count } = await coupleApi.getState();
        set({ couple, partner, sealedCount: sealed_count });
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
             sealedCount: 0,
             isAuthenticated: false,
             isAnonymous: false,
             isLoading: false,
             pendingAppleDisplayName: null,
         });
        // Clear other stores
        const { useMatchStore, usePacksStore, useMessageStore, useSubscriptionStore, useNotificationPreferencesStore, useStreakStore, useResponsesStore, useQuizStore } = getOtherStores();
        useMatchStore.getState().clearMatches();
        usePacksStore.getState().clearPacks();
        useMessageStore.getState().clearMessages();
        useSubscriptionStore.getState().clearSubscription();
        useNotificationPreferencesStore.getState().clearPreferences();
        useStreakStore.getState().clearStreak();
        useResponsesStore.getState().clearResponses();
        useQuizStore.getState().clearQuiz();

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
            ...(user === null && { isAnonymous: false, pendingAppleDisplayName: null }),
            isLoading: false,
            // Clear couple/partner when user is null (signed out)
            ...(user === null && { couple: null, partner: null, sealedCount: 0 })
        });
        // Clear other stores when user signs out
        if (user === null) {
            const { useMatchStore, usePacksStore, useMessageStore, useSubscriptionStore, useNotificationPreferencesStore, useStreakStore, useResponsesStore, useQuizStore } = getOtherStores();
            useMatchStore.getState().clearMatches();
            usePacksStore.getState().clearPacks();
            useMessageStore.getState().clearMessages();
            useSubscriptionStore.getState().clearSubscription();
            useNotificationPreferencesStore.getState().clearPreferences();
            useStreakStore.getState().clearStreak();
            useResponsesStore.getState().clearResponses();
            useQuizStore.getState().clearQuiz();
            // Clear badge on sign out
            const { clearBadge } = require("../lib/badge");
            clearBadge();
        }
    },

    setPendingAppleDisplayName: (pending) => set({ pendingAppleDisplayName: pending }),

    clearPendingAppleDisplayName: (userId) => {
        if (get().pendingAppleDisplayName?.userId === userId) {
            set({ pendingAppleDisplayName: null });
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
