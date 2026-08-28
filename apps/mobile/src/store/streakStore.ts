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

    // Actions
    fetchStreak: () => Promise<void>;
    clearStreak: () => void;
}

export const useStreakStore = create<StreakState>((set) => ({
    streak: null,
    isLoading: false,
    error: null,

    fetchStreak: async () => {
        const coupleId = useAuthStore.getState().user?.couple_id;
        if (!coupleId) {
            set({ streak: null, isLoading: false });
            return;
        }

        set({ isLoading: true, error: null });

        try {
            const { streak } = await apiClient.get<{streak: CoupleStreak | null}>("/v1/me/streak");
            set({ streak, isLoading: false });
        } catch (error) {
            console.error("Error fetching streak:", error);
            set({ error: "Failed to load streak", isLoading: false });
        }
    },

    clearStreak: () => {
        set({ streak: null, isLoading: false, error: null });
    },
}));
