import { create } from "zustand";
import { apiClient } from "../lib/apiClient";
import { useAuthStore } from "./authStore";

/**
 * Resolved from the signed-in partner's point of view by the API. The stored row is
 * positional (user1/user2 by member id), which a client cannot act on without
 * re-deriving that ordering, so the endpoint answers in you/partner terms instead.
 */
export interface CoupleStreak {
    couple_id: string;
    current_streak: number;
    longest_streak: number;
    last_active_date: string | null;
    last_completed_date: string | null;
    you_answered_today: boolean;
    partner_answered_today: boolean;
    partner_name: string | null;
    /** The couple's shared IANA zone, which is the day boundary the streak is counted in. */
    timezone: string;
    streak_celebrated_at: number;
    created_at: string;
    updated_at: string;
}

interface StreakState {
    streak: CoupleStreak | null;
    isLoading: boolean;
    error: string | null;
    /**
     * Null until the first successful read. A couple with no streak yet resolves to a
     * null `streak`, which is a loaded answer rather than a reason to ask again.
     */
    loadedAt: number | null;
    /** Bumped on clear/sign-out so a response that outlives it cannot write into the next account's store. */
    generation: number;

    // Actions
    fetchStreak: () => Promise<void>;
    /** Loads the streak once; later callers reuse the cached value. */
    ensureStreakLoaded: () => Promise<void>;
    /** Silent re-read of an already-loaded streak; leaves the cached value on screen if it fails. */
    refreshStreak: () => Promise<void>;
    clearStreak: () => void;
}

// The streak is rendered by a badge, the home screen and the swipe screen, so
// concurrent mounts must share one request rather than each issuing their own.
// Tagged with the generation that started it: clearing/signing out bumps the
// generation, so a stale response can no longer write into the next account's
// store, and a stale `finally` cannot clear a newer generation's guard.
let inFlight: { generation: number; promise: Promise<void> } | null = null;

export const useStreakStore = create<StreakState>((set, get) => ({
    streak: null,
    isLoading: false,
    error: null,
    loadedAt: null,
    generation: 0,

    fetchStreak: async () => {
        const coupleId = useAuthStore.getState().user?.couple_id;
        const myGeneration = get().generation;
        if (!coupleId) {
            set({ streak: null, isLoading: false, loadedAt: null });
            return;
        }

        if (inFlight && inFlight.generation === myGeneration) return inFlight.promise;

        set({ isLoading: true, error: null });

        const promise = (async () => {
            try {
                const { streak } = await apiClient.get<{streak: CoupleStreak | null}>("/v1/me/streak");
                if (get().generation !== myGeneration) return;
                set({ streak, isLoading: false, loadedAt: Date.now() });
            } catch (error) {
                if (get().generation !== myGeneration) return;
                console.error("Error fetching streak:", error);
                set({ error: "Failed to load streak", isLoading: false });
            } finally {
                if (inFlight?.generation === myGeneration) inFlight = null;
            }
        })();

        inFlight = { generation: myGeneration, promise };
        return promise;
    },

    ensureStreakLoaded: async () => {
        if (get().loadedAt !== null) return;
        await get().fetchStreak();
    },

    refreshStreak: async () => {
        // Only silently refresh a streak the UI has actually loaded; an unopened
        // screen has nothing cached to keep honest.
        if (get().loadedAt === null) return;
        await get().fetchStreak();
    },

    clearStreak: () => {
        set((state) => ({
            streak: null, isLoading: false, error: null, loadedAt: null,
            // Invalidates any request already in flight for the signed-out user.
            generation: state.generation + 1,
        }));
    },
}));
