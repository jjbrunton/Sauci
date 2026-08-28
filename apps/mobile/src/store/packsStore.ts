import { create } from "zustand";
import { apiClient } from "../lib/apiClient";
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
    showAllIntensities: boolean;
    fetchPacks: () => Promise<void>;
    fetchEnabledPacks: () => Promise<void>;
    fetchPackProgress: () => Promise<void>;
    ensureEnabledPacksLoaded: () => Promise<void>;
    togglePack: (packId: string) => Promise<{ success: boolean; reason?: string }>;
    setShowAllIntensities: (value: boolean) => void;
    clearPacks: () => void;
    getPackProgress: (packId: string) => PackProgressData | undefined;
}

export const usePacksStore = create<PacksState>((set, get) => ({
    packs: [],
    categories: [],
    enabledPackIds: [],
    packProgress: new Map(),
    isLoading: false,
    showAllIntensities: false,

    fetchPacks: async () => {
        set({ isLoading: true });
        try {
            const showAllIntensities = get().showAllIntensities;
            const catalog = await apiClient.get<{ categories: Category[]; packs: QuestionPack[] }>(
                `/v1/packs?showAllIntensities=${showAllIntensities}`,
            );
            set({ packs: catalog.packs, categories: catalog.categories });
            await get().fetchEnabledPacks();
            await get().fetchPackProgress();
        } finally {
            set({ isLoading: false });
        }
    },

    fetchEnabledPacks: async () => {
        const coupleId = useAuthStore.getState().user?.couple_id;
        if (!coupleId) {
            set({ enabledPackIds: [] });
            return;
        }

        const result = await apiClient.get<{ enabledPackIds: string[] }>("/v1/me/enabled-packs");
        set({ enabledPackIds: result.enabledPackIds });
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

        try {
            const result = await apiClient.put<{ enabledPackIds: string[] }>(
                `/v1/me/enabled-packs/${packId}`,
                { enabled: newValue },
            );
            set({ enabledPackIds: result.enabledPackIds });
        } catch (error) {
            console.error("Error toggling pack:", error);
            set({ enabledPackIds: isEnabled
                ? [...new Set([...get().enabledPackIds, packId])]
                : get().enabledPackIds.filter(id => id !== packId) });
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

    fetchPackProgress: async () => {
        if (!useAuthStore.getState().user?.id) {
            set({ packProgress: new Map() });
            return;
        }
        const result = await apiClient.get<{ progress: Array<PackProgressData & { packId: string }> }>(
            "/v1/me/pack-progress",
        );
        const progressMap = new Map<string, PackProgressData>();
        result.progress.forEach(({ packId, totalQuestions, answeredQuestions }) => {
            progressMap.set(packId, { totalQuestions, answeredQuestions });
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
