import { create } from "zustand";
import { supabase } from "../lib/supabase";
import { Events } from "../lib/analytics";
import type { QuestionPack, Category } from "@/types";
import { useAuthStore } from "./authStore";

const DEFAULT_MAX_INTENSITY = 2;

const normalizeIntensity = (value?: number | null) => {
    if (typeof value !== "number" || Number.isNaN(value)) return null;
    const rounded = Math.round(value);
    if (rounded < 1 || rounded > 5) return null;
    return rounded;
};

const getUserMaxIntensity = () => {
    const user = useAuthStore.getState().user;
    const normalized = normalizeIntensity(user?.max_intensity ?? null);
    if (normalized) return normalized;
    return user?.show_explicit_content ? 5 : DEFAULT_MAX_INTENSITY;
};

interface PacksState {
    packs: QuestionPack[];
    categories: Category[];
    enabledPackIds: string[];
    isLoading: boolean;
    showAllIntensities: boolean;
    fetchPacks: () => Promise<void>;
    fetchEnabledPacks: () => Promise<void>;
    ensureEnabledPacksLoaded: () => Promise<void>;
    togglePack: (packId: string) => Promise<{ success: boolean; reason?: string }>;
    setShowAllIntensities: (value: boolean) => void;
    clearPacks: () => void;
}

export const usePacksStore = create<PacksState>((set, get) => ({
    packs: [],
    categories: [],
    enabledPackIds: [],
    isLoading: false,
    showAllIntensities: false,

    fetchPacks: async () => {
        set({ isLoading: true });

        // Get user's max intensity preference
        const maxIntensity = getUserMaxIntensity();
        const showAllIntensities = get().showAllIntensities;


        // Fetch categories
        const { data: categories } = await supabase
            .from("categories")
            .select("*")
            .order("sort_order");

        // Hide categories explicitly marked non-public, but keep null for compatibility.
        const visibleCategories = (categories ?? []).filter(category => category.is_public !== false);
        const visibleCategoryIds = new Set(visibleCategories.map(category => category.id));

        // Fetch packs with category info and question count
        let query = supabase
            .from("question_packs")
            .select("*, category:categories(*), questions(count)")
            .eq("is_public", true)
            .order("sort_order");

        // Filter out packs above user's intensity preference (unless showing all)
        if (maxIntensity < 5 && !showAllIntensities) {
            query = query.or(`max_intensity.is.null,max_intensity.lte.${maxIntensity}`);
        }

        const { data: packs } = await query;

        const visiblePacks = (packs ?? []).filter(pack => {
            if (pack.category?.is_public === false) return false;
            if (pack.category_id && visibleCategoryIds.size > 0 && !visibleCategoryIds.has(pack.category_id)) {
                return false;
            }
            return true;
        });

        // Also fetch enabled packs if logged in
        await get().fetchEnabledPacks();

        set({
            packs: visiblePacks,
            categories: visibleCategories,
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

    ensureEnabledPacksLoaded: async () => {
        // Only fetch if not already loaded - lightweight check for swipe screen
        const coupleId = useAuthStore.getState().user?.couple_id;
        if (!coupleId) return;

        if (get().enabledPackIds.length === 0) {
            await get().fetchEnabledPacks();
        }
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

    setShowAllIntensities: (value: boolean) => {
        set({ showAllIntensities: value });
        // Refetch packs with new filter setting
        get().fetchPacks();
    },

    clearPacks: () => {
        set({ enabledPackIds: [] });
    },
}));
