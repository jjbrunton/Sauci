import { create } from "zustand";
import { supabase } from "../lib/supabase";
import { Events } from "../lib/analytics";
import type { QuestionPack, Category } from "@/types";
import { useAuthStore } from "./authStore";

// Progress data for a pack
export interface PackProgressData {
    totalQuestions: number;
    answeredQuestions: number;
}

interface PacksState {
    packs: QuestionPack[];
    categories: Category[];
    enabledPackIds: string[];
    packProgress: Map<string, PackProgressData>;
    isLoading: boolean;
    fetchPacks: () => Promise<void>;
    fetchEnabledPacks: () => Promise<void>;
    fetchPackProgress: () => Promise<void>;
    ensureEnabledPacksLoaded: () => Promise<void>;
    togglePack: (packId: string) => Promise<{ success: boolean; reason?: string }>;
    clearPacks: () => void;
    getPackProgress: (packId: string) => PackProgressData | undefined;
}

export const usePacksStore = create<PacksState>((set, get) => ({
    packs: [],
    categories: [],
    enabledPackIds: [],
    packProgress: new Map(),
    isLoading: false,

    fetchPacks: async () => {
        set({ isLoading: true });

        // Fetch categories
        const { data: categories } = await supabase
            .from("categories")
            .select("*")
            .order("sort_order");

        // Hide categories explicitly marked non-public, but keep null for compatibility.
        const visibleCategories = (categories ?? []).filter(category => category.is_public !== false);
        const visibleCategoryIds = new Set(visibleCategories.map(category => category.id));

        // Fetch packs with category info and question count
        const query = supabase
            .from("question_packs")
            .select("*, category:categories(*), questions(count)")
            .eq("is_public", true)
            .order("sort_order");

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

        // Fetch progress after packs are loaded
        get().fetchPackProgress();
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

    fetchPackProgress: async () => {
        const userId = useAuthStore.getState().user?.id;
        if (!userId) {
            set({ packProgress: new Map() });
            return;
        }

        const packs = get().packs;
        if (packs.length === 0) return;

        // Fetch user's response counts grouped by pack
        const { data: responseCounts, error } = await supabase
            .from("responses")
            .select("question:questions!inner(pack_id)")
            .eq("user_id", userId);

        if (error) {
            console.error("Error fetching pack progress:", error);
            return;
        }

        // Debug: log response counts
        console.log("[PackProgress] userId:", userId);
        console.log("[PackProgress] total responses:", responseCounts?.length ?? 0);

        // Count responses per pack
        const responsesByPack = new Map<string, number>();
        responseCounts?.forEach((r) => {
            const packId = (r.question as any)?.pack_id;
            if (packId) {
                responsesByPack.set(packId, (responsesByPack.get(packId) || 0) + 1);
            }
        });

        // Debug: log responses by pack
        if (responsesByPack.size > 0) {
            console.log("[PackProgress] responses by pack:", Object.fromEntries(responsesByPack));
        }

        // Build progress map
        const progressMap = new Map<string, PackProgressData>();
        packs.forEach((pack) => {
            const totalQuestions = pack.questions?.[0]?.count ?? 0;
            const answeredQuestions = responsesByPack.get(pack.id) || 0;
            progressMap.set(pack.id, { totalQuestions, answeredQuestions });
        });

        set({ packProgress: progressMap });
    },

    getPackProgress: (packId: string) => {
        return get().packProgress.get(packId);
    },

    clearPacks: () => {
        set({ enabledPackIds: [], packProgress: new Map() });
    },
}));
