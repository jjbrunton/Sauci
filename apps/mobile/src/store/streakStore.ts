import { create } from "zustand";
import { supabase } from "../lib/supabase";
import { useAuthStore } from "./authStore";

export interface CoupleStreak {
    couple_id: string;
    current_streak: number;
    longest_streak: number;
    last_active_date: string | null;
    user1_answered_today: boolean;
    user2_answered_today: boolean;
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
            const { data, error } = await supabase
                .from("couple_streaks")
                .select("*")
                .eq("couple_id", coupleId)
                .maybeSingle();

            if (error) throw error;

            set({ streak: data, isLoading: false });
        } catch (error) {
            console.error("Error fetching streak:", error);
            set({ error: "Failed to load streak", isLoading: false });
        }
    },

    clearStreak: () => {
        set({ streak: null, isLoading: false, error: null });
    },
}));
