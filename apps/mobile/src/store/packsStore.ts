import { create } from "zustand";
import { supabase } from "../lib/supabase";
import { Events } from "../lib/analytics";
import type { QuestionPack, Category } from "@/types";
import { useAuthStore } from "./authStore";

interface PacksState {
    packs: QuestionPack[];
    categories: Category[];
    enabledPackIds: string[];
    isLoading: boolean;
    fetchPacks: () => Promise<void>;
    fetchEnabledPacks: () => Promise<void>;
    togglePack: (packId: string) => Promise<{ success: boolean; reason?: string }>;
    clearPacks: () => void;
}

export const usePacksStore = create<PacksState>((set, get) => ({
    packs: [],
    categories: [],
    enabledPackIds: [],
    isLoading: false,

    fetchPacks: async () => {
        set({ isLoading: true });

        // Get user's explicit content preference
        const showExplicit = useAuthStore.getState().user?.show_explicit_content ?? true;

        // Fetch categories
        const { data: categories } = await supabase
            .from("categories")
            .select("*")
            .order("sort_order");

        // Fetch packs with category info and question count
        let query = supabase
            .from("question_packs")
            .select("*, category:categories(*), questions(count)")
            .eq("is_public", true)
            .order("sort_order");

        // Filter out explicit packs if user doesn't want to see them
        if (!showExplicit) {
            query = query.eq("is_explicit", false);
        }

        const { data: packs } = await query;

        // Also fetch enabled packs if logged in
        await get().fetchEnabledPacks();

        set({
            packs: packs ?? [],
            categories: categories ?? [],
            isLoading: false
        });
    },

    fetchEnabledPacks: async () => {
        const coupleId = useAuthStore.getState().user?.couple_id;
        if (!coupleId) {
            set({ enabledPackIds: [] });
            return;
        }

        const { data: couplePacks } = await supabase
            .from("couple_packs")
            .select("pack_id")
            .eq("couple_id", coupleId)
            .eq("enabled", true);

        const ids = couplePacks?.map(cp => cp.pack_id) || [];
        set({ enabledPackIds: ids });
    },

    togglePack: async (packId: string): Promise<{ success: boolean; reason?: string }> => {
        const coupleId = useAuthStore.getState().user?.couple_id;
        if (!coupleId) {
            return { success: false, reason: "no_couple" };
        }

        const isEnabled = get().enabledPackIds.includes(packId);
        const newValue = !isEnabled;

        // Optimistic update
        const newIds = newValue
            ? [...get().enabledPackIds, packId]
            : get().enabledPackIds.filter(id => id !== packId);

        set({ enabledPackIds: newIds });

        const { error } = await supabase
            .from("couple_packs")
            .upsert({
                couple_id: coupleId,
                pack_id: packId,
                enabled: newValue
            });

        if (error) {
            console.error("Error toggling pack:", error);
            // Revert by refetching
            get().fetchEnabledPacks();
            return { success: false, reason: "error" };
        }

        // Track pack enable/disable
        if (newValue) {
            Events.packEnabled(packId);
        } else {
            Events.packDisabled(packId);
        }

        return { success: true };
    },

    clearPacks: () => {
        set({ enabledPackIds: [] });
    },
}));
