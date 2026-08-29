import { create } from "zustand";
import { apiClient } from "../lib/apiClient";
import { Events } from "../lib/analytics";
import type { QuestionPack, Category } from "@/types";
import { useAuthStore } from "./authStore";

// The catalog load fans out into three requests, so a second caller arriving mid-flight
// must wait for the first rather than triple the cost. Keyed to the generation that
// started the request: a stale generation's entry must not block the next account's
// request for the same key, and its `finally` must not clear a newer generation's guard.
const inFlight = new Map<string, number>();

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
    /**
     * When the catalog, enabled set and progress were last read together. Null means
     * never — which is not the same as "empty", so a couple with no packs enabled
     * stops refetching after the first load.
     */
    catalogLoadedAt: number | null;
    /** Tracked separately because the swipe screen loads the enabled set on its own. */
    enabledPacksLoadedAt: number | null;
    /** Bumped on clear/sign-out so a response that outlives it cannot write into the next account's store. */
    generation: number;
    fetchPacks: () => Promise<void>;
    fetchEnabledPacks: () => Promise<void>;
    fetchPackProgress: () => Promise<void>;
    ensurePacksLoaded: () => Promise<void>;
    ensureEnabledPacksLoaded: () => Promise<void>;
    /** Marks the cached catalog stale without spending a request; the next ensure reloads it. */
    invalidatePacks: () => void;
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
    catalogLoadedAt: null,
    enabledPacksLoadedAt: null,
    generation: 0,

    fetchPacks: async () => {
        const myGeneration = get().generation;
        if (inFlight.get('catalog') === myGeneration) return;
        inFlight.set('catalog', myGeneration);
        set({ isLoading: true });
        try {
            const catalog = await apiClient.get<{ categories: Category[]; packs: QuestionPack[] }>(
                '/v1/packs?showAllIntensities=false',
            );
            if (get().generation !== myGeneration) return;
            set({ packs: catalog.packs, categories: catalog.categories });
            await get().fetchEnabledPacks();
            await get().fetchPackProgress();
            if (get().generation !== myGeneration) return;
            set({ catalogLoadedAt: Date.now() });
        } finally {
            if (inFlight.get('catalog') === myGeneration) inFlight.delete('catalog');
            if (get().generation === myGeneration) set({ isLoading: false });
        }
    },

    ensurePacksLoaded: async () => {
        if (get().catalogLoadedAt !== null) return;
        await get().fetchPacks();
    },

    invalidatePacks: () => {
        set({ catalogLoadedAt: null });
    },

    fetchEnabledPacks: async () => {
        const coupleId = useAuthStore.getState().user?.couple_id;
        const myGeneration = get().generation;
        if (!coupleId) {
            set({ enabledPackIds: [], enabledPacksLoadedAt: null });
            return;
        }

        const result = await apiClient.get<{ enabledPackIds: string[] }>("/v1/me/enabled-packs");
        if (get().generation !== myGeneration) return;
        set({ enabledPackIds: result.enabledPackIds, enabledPacksLoadedAt: Date.now() });
    },

    ensureEnabledPacksLoaded: async () => {
        // Only fetch if not already loaded - lightweight check for swipe screen.
        // Keyed off the load marker, not the array: "no packs enabled" is a real
        // answer and must not be retried on every visit.
        const coupleId = useAuthStore.getState().user?.couple_id;
        if (!coupleId) return;

        if (get().enabledPacksLoadedAt === null) {
            await get().fetchEnabledPacks();
        }
    },

    togglePack: async (packId: string): Promise<{ success: boolean; reason?: string }> => {
        const coupleId = useAuthStore.getState().user?.couple_id;
        if (!coupleId) {
            return { success: false, reason: "no_couple" };
        }

        const myGeneration = get().generation;
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
            // These ids belong to the couple that asked; a clear while the request
            // was open means they would land in a different couple's selection.
            if (get().generation !== myGeneration) return { success: false, reason: "stale" };
            set({ enabledPackIds: result.enabledPackIds });
        } catch (error) {
            console.error("Error toggling pack:", error);
            // The optimistic update this reverts was cleared along with everything
            // else, so reverting now would only push a stale pack id into the next
            // couple's list.
            if (get().generation !== myGeneration) return { success: false, reason: "stale" };
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

    fetchPackProgress: async () => {
        const myGeneration = get().generation;
        if (!useAuthStore.getState().user?.id) {
            set({ packProgress: new Map() });
            return;
        }
        const result = await apiClient.get<{ progress: Array<PackProgressData & { packId: string }> }>(
            "/v1/me/pack-progress",
        );
        if (get().generation !== myGeneration) return;
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
        set((state) => ({
            enabledPackIds: [],
            packProgress: new Map(),
            catalogLoadedAt: null,
            enabledPacksLoadedAt: null,
            // Invalidates any request already in flight for the signed-out user.
            generation: state.generation + 1,
        }));
        // See matchStore.clearMatches: the previous user's in-flight catalog read
        // must not block the next user's.
        inFlight.clear();
    },
}));
