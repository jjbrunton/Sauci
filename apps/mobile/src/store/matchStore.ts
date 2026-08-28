import { create } from "zustand";
import { ApiError, apiClient } from "../lib/apiClient";
import { appDataApi } from "../lib/appDataApi";
import type { Match, Question, QuestionPack, AnswerType } from "@/types";
import { useAuthStore } from "./authStore";

const BATCH_SIZE = 20;

// Question waiting for user's response (partner has answered)
export interface PendingQuestion {
    id: string; // Partner's response ID
    question: Question & { pack?: Pick<QuestionPack, "id" | "name" | "icon"> };
    partnerAnsweredAt: string;
}

type MatchViewType = 'active' | 'archived' | 'pending' | 'their_turn';

// Rate limit: 12 hours in milliseconds
const NUDGE_COOLDOWN_MS = 12 * 60 * 60 * 1000;

interface NudgeResponse {
    success: boolean;
    notification_sent?: boolean;
    reason?: string;
    next_nudge_available_at?: string;
    error?: string;
    cooldown_remaining_seconds?: number;
}

interface MatchState {
    matches: Match[];
    newMatchesCount: number;
    totalCount: number | null;
    isLoading: boolean;
    isLoadingMore: boolean;
    page: number;
    hasMore: boolean;
    error: string | null;
    // Archive state
    archivedMatches: Match[];
    archivedMatchIds: Set<string>;
    showArchived: boolean;
    isLoadingArchived: boolean;
    // Pending (Your Turn) state
    pendingQuestions: PendingQuestion[];
    isLoadingPending: boolean;
    // Their Turn state (user answered, partner hasn't)
    theirTurnQuestions: PendingQuestion[];
    isLoadingTheirTurn: boolean;
    currentView: MatchViewType;
    // Nudge state
    nudgeCooldownUntil: Date | null;
    isNudging: boolean;
    // Methods
    fetchMatches: (refresh?: boolean) => Promise<void>;
    markAsSeen: (matchId: string) => Promise<void>;
    markAllAsSeen: () => Promise<void>;
    addMatch: (match: Match) => void;
    updateMatchUnreadCount: (matchId: string, delta: number) => void;
    clearMatches: () => void;
    // Archive methods
    archiveMatch: (matchId: string) => Promise<void>;
    unarchiveMatch: (matchId: string) => Promise<void>;
    fetchArchivedMatches: () => Promise<void>;
    toggleShowArchived: () => void;
    isMatchArchived: (matchId: string) => boolean;
    // Pending methods
    fetchPendingQuestions: () => Promise<void>;
    fetchTheirTurnQuestions: () => Promise<void>;
    setCurrentView: (view: MatchViewType) => void;
    // Nudge methods
    sendNudge: () => Promise<{ success: boolean; notificationSent: boolean }>;
    checkNudgeCooldown: () => Promise<void>;
}

export const useMatchStore = create<MatchState>((set, get) => ({
    matches: [],
    newMatchesCount: 0,
    totalCount: null,
    isLoading: false,
    isLoadingMore: false,
    page: 0,
    hasMore: true,
    error: null,
    // Archive state
    archivedMatches: [],
    archivedMatchIds: new Set<string>(),
    showArchived: false,
    isLoadingArchived: false,
    // Pending (Your Turn) state
    pendingQuestions: [],
    isLoadingPending: false,
    // Their Turn state
    theirTurnQuestions: [],
    isLoadingTheirTurn: false,
    currentView: 'pending' as MatchViewType,
    // Nudge state
    nudgeCooldownUntil: null,
    isNudging: false,

    fetchMatches: async (refresh = false) => {
        const userId = useAuthStore.getState().user?.id;
        const coupleId = useAuthStore.getState().user?.couple_id;

        // Early return if no couple - user isn't paired yet
        if (!coupleId) {
            set({ matches: [], newMatchesCount: 0, totalCount: 0, isLoading: false });
            return;
        }

        const state = get();
        if (state.isLoading || (state.isLoadingMore && !refresh)) return;

        if (refresh) {
            set({ isLoading: true, error: null, page: 0, hasMore: true });
        } else {
            if (!state.hasMore) return;
            set({ isLoadingMore: true });
        }

        try {
            const currentPage = refresh ? 0 : state.page;
            const result = await apiClient.get<{ matches: Match[]; totalCount: number }>(`/v1/matches?page=${currentPage}&limit=${BATCH_SIZE}`);
            const nonArchivedMatches = result.matches;
            const totalCount = result.totalCount;
            const archivedMatchIds = state.archivedMatchIds;

            if (nonArchivedMatches.length === 0) {
                 if (refresh) {
                    set({ matches: [], newMatchesCount: 0, totalCount: totalCount ?? 0, isLoading: false, hasMore: false, archivedMatchIds });
                } else {
                    set({ isLoadingMore: false, hasMore: false });
                }
                return;
            }

            const sortedData = nonArchivedMatches;

            // Calculate new matches count - this is tricky with pagination
            // Ideally we should have a separate query for count, but we'll just count in current batch
            const newMatchesInBatch = sortedData.filter((m) => m.is_new).length;
            
            set((state) => {
                // Deduplicate matches by ID when appending new pages
                const mergedMatches = refresh
                    ? sortedData
                    : [...state.matches, ...sortedData].reduce<Match[]>((acc, match) => {
                        if (!acc.some((m: Match) => m.id === match.id)) {
                            acc.push(match);
                        }
                        return acc;
                    }, []);

                return {
                matches: mergedMatches,
                newMatchesCount: refresh ? newMatchesInBatch : state.newMatchesCount + newMatchesInBatch,
                totalCount: refresh ? totalCount : state.totalCount,
                isLoading: false,
                isLoadingMore: false,
                page: currentPage + 1,
                hasMore: nonArchivedMatches.length === BATCH_SIZE,
                archivedMatchIds: refresh ? archivedMatchIds : state.archivedMatchIds,
                };
            });
        } catch (err) {
            console.error("Error fetching matches:", err);
            set({ error: "Failed to load matches", isLoading: false, isLoadingMore: false });
        }
    },

    markAsSeen: async (matchId) => {
        await apiClient.patch("/v1/matches/seen", { ids: [matchId] });

        const matches = get().matches.map((m) =>
            m.id === matchId ? { ...m, is_new: false } : m
        );
        const newCount = matches.filter((m) => m.is_new).length;
        set({ matches, newMatchesCount: newCount });
    },

    markAllAsSeen: async () => {
        const newMatches = get().matches.filter((m) => m.is_new);
        if (newMatches.length === 0) return;

        const newMatchIds = newMatches.map((m) => m.id);
        await apiClient.patch("/v1/matches/seen", { ids: newMatchIds });

        const matches = get().matches.map((m) =>
            m.is_new ? { ...m, is_new: false } : m
        );
        set({ matches, newMatchesCount: 0 });
    },

    addMatch: (match) => {
        set((state) => ({
            matches: [match, ...state.matches],
            newMatchesCount: state.newMatchesCount + 1,
            totalCount: (state.totalCount ?? 0) + 1,
        }));
    },

    updateMatchUnreadCount: (matchId, delta) => {
        set((state) => ({
            matches: state.matches.map((m) =>
                m.id === matchId
                    ? { ...m, unreadCount: Math.max(0, (m.unreadCount || 0) + delta) }
                    : m
            ),
        }));
    },

clearMatches: () => {
        set({
            matches: [],
            newMatchesCount: 0,
            totalCount: null,
            isLoading: false,
            error: null,
            page: 0,
            hasMore: true,
            isLoadingMore: false,
            archivedMatches: [],
            archivedMatchIds: new Set<string>(),
            showArchived: false,
            isLoadingArchived: false,
            pendingQuestions: [],
            isLoadingPending: false,
            theirTurnQuestions: [],
            isLoadingTheirTurn: false,
            currentView: 'pending',
            nudgeCooldownUntil: null,
            isNudging: false,
        });
    },

    // Archive methods
    archiveMatch: async (matchId: string) => {
        const userId = useAuthStore.getState().user?.id;
        if (!userId) return;

        // Optimistically update UI
        const state = get();
        const matchToArchive = state.matches.find(m => m.id === matchId);

        if (matchToArchive) {
            const newArchivedMatchIds = new Set(state.archivedMatchIds);
            newArchivedMatchIds.add(matchId);

            set({
                matches: state.matches.filter(m => m.id !== matchId),
                archivedMatches: [...state.archivedMatches, matchToArchive],
                archivedMatchIds: newArchivedMatchIds,
                totalCount: state.totalCount !== null ? state.totalCount - 1 : null,
            });
        }

        try {
            await apiClient.put(`/v1/matches/${matchId}/archive`, { archived: true });
        } catch (error) {
            console.error("Error archiving match:", error);
            // Revert on error
            if (matchToArchive) {
                const revertArchivedIds = new Set(get().archivedMatchIds);
                revertArchivedIds.delete(matchId);
                const currentTotalCount = get().totalCount;
                set({
                    matches: [matchToArchive, ...get().matches],
                    archivedMatches: get().archivedMatches.filter(m => m.id !== matchId),
                    archivedMatchIds: revertArchivedIds,
                    totalCount: currentTotalCount !== null ? currentTotalCount + 1 : null,
                });
            }
        }
    },

    unarchiveMatch: async (matchId: string) => {
        const userId = useAuthStore.getState().user?.id;
        if (!userId) return;

        // Optimistically update UI
        const state = get();
        const matchToUnarchive = state.archivedMatches.find(m => m.id === matchId);

        if (matchToUnarchive) {
            const newArchivedMatchIds = new Set(state.archivedMatchIds);
            newArchivedMatchIds.delete(matchId);

            set({
                archivedMatches: state.archivedMatches.filter(m => m.id !== matchId),
                matches: [matchToUnarchive, ...state.matches],
                archivedMatchIds: newArchivedMatchIds,
                totalCount: state.totalCount !== null ? state.totalCount + 1 : null,
            });
        }

        try {
            await apiClient.put(`/v1/matches/${matchId}/archive`, { archived: false });
        } catch (error) {
            console.error("Error unarchiving match:", error);
            // Revert on error
            if (matchToUnarchive) {
                const revertArchivedIds = new Set(get().archivedMatchIds);
                revertArchivedIds.add(matchId);
                const currentTotalCount = get().totalCount;
                set({
                    archivedMatches: [matchToUnarchive, ...get().archivedMatches],
                    matches: get().matches.filter(m => m.id !== matchId),
                    archivedMatchIds: revertArchivedIds,
                    totalCount: currentTotalCount !== null ? currentTotalCount - 1 : null,
                });
            }
        }
    },

    fetchArchivedMatches: async () => {
        const userId = useAuthStore.getState().user?.id;
        const coupleId = useAuthStore.getState().user?.couple_id;

        if (!coupleId || !userId) return;

        const state = get();
        if (state.isLoadingArchived) return;

        set({ isLoadingArchived: true });

        try {
            const result = await apiClient.get<{matches:Match[];totalCount:number}>(`/v1/matches?archived=true&limit=100`);
            const archivedMatches = result.matches;
            const archivedIds = archivedMatches.map(match => match.id);
            if (archivedMatches.length === 0) {
                set({ archivedMatches: [], isLoadingArchived: false });
                return;
            }

            set({
                archivedMatches,
                isLoadingArchived: false,
                archivedMatchIds: new Set(archivedIds),
            });
        } catch (err) {
            console.error("Error fetching archived matches:", err);
            set({ isLoadingArchived: false });
        }
    },

    toggleShowArchived: () => {
        const state = get();
        const newShowArchived = !state.showArchived;

        set({ showArchived: newShowArchived });

        // Fetch archived matches if switching to archived view and not yet loaded
        if (newShowArchived && state.archivedMatches.length === 0) {
            get().fetchArchivedMatches();
        }
    },

    isMatchArchived: (matchId: string) => {
        return get().archivedMatchIds.has(matchId);
    },

    // Pending (Your Turn) methods
    fetchPendingQuestions: async () => {
        const userId = useAuthStore.getState().user?.id;
        const coupleId = useAuthStore.getState().user?.couple_id;

        if (!coupleId || !userId) {
            set({ pendingQuestions: [], isLoadingPending: false });
            return;
        }

        const state = get();
        if (state.isLoadingPending) return;

        set({ isLoadingPending: true });

        try {
            const { questions: pendingQuestions } = await apiClient.get<{questions:PendingQuestion[]}>("/v1/questions/pending?direction=partner");
            set({ pendingQuestions, isLoadingPending: false });
        } catch (err) {
            console.error("Error fetching pending questions:", err);
            set({ isLoadingPending: false });
        }
    },

    // Their Turn methods (user answered, partner hasn't yet)
    fetchTheirTurnQuestions: async () => {
        const userId = useAuthStore.getState().user?.id;
        const coupleId = useAuthStore.getState().user?.couple_id;

        if (!coupleId || !userId) {
            set({ theirTurnQuestions: [], isLoadingTheirTurn: false });
            return;
        }

        const state = get();
        if (state.isLoadingTheirTurn) return;

        set({ isLoadingTheirTurn: true });

        try {
            const { questions: theirTurnQuestions } = await apiClient.get<{questions:PendingQuestion[]}>("/v1/questions/pending?direction=mine");
            set({ theirTurnQuestions, isLoadingTheirTurn: false });
        } catch (err) {
            console.error("Error fetching their turn questions:", err);
            set({ isLoadingTheirTurn: false });
        }
    },

    setCurrentView: (view: MatchViewType) => {
        const state = get();

        // Update showArchived for backwards compatibility
        const showArchived = view === 'archived';
        set({ currentView: view, showArchived });

        // Fetch data for the selected view if not already loaded
        if (view === 'archived' && state.archivedMatches.length === 0) {
            get().fetchArchivedMatches();
        } else if (view === 'pending' && state.pendingQuestions.length === 0) {
            get().fetchPendingQuestions();
        } else if (view === 'their_turn' && state.theirTurnQuestions.length === 0) {
            get().fetchTheirTurnQuestions();
        }
    },

    // Nudge methods
    sendNudge: async () => {
        const state = get();
        if (state.isNudging) {
            return { success: false, notificationSent: false };
        }

        // Check if still in cooldown
        if (state.nudgeCooldownUntil && new Date() < state.nudgeCooldownUntil) {
            return { success: false, notificationSent: false };
        }

        set({ isNudging: true });

        try {
            const data = await appDataApi.sendNudge();

            // Success - update cooldown
            const cooldownUntil = data.next_nudge_available_at
                ? new Date(data.next_nudge_available_at)
                : new Date(Date.now() + NUDGE_COOLDOWN_MS);

            set({ nudgeCooldownUntil: cooldownUntil, isNudging: false });

            return {
                success: true,
                notificationSent: data.notification_sent ?? false,
            };
        } catch (err) {
            if (err instanceof ApiError && err.status === 429) {
                const details = err.details as NudgeResponse | undefined;
                const cooldownUntil = details?.next_nudge_available_at
                    ? new Date(details.next_nudge_available_at)
                    : new Date(Date.now() + (details?.cooldown_remaining_seconds || 0) * 1000);
                set({ nudgeCooldownUntil: cooldownUntil, isNudging: false });
                return { success: false, notificationSent: false };
            }
            console.error("Error sending nudge:", err);
            set({ isNudging: false });
            return { success: false, notificationSent: false };
        }
    },

    checkNudgeCooldown: async () => {
        const userId = useAuthStore.getState().user?.id;
        if (!userId) return;

        try {
            const profile = await appDataApi.nudgeStatus();

            if (!profile.last_nudge_sent_at) {
                set({ nudgeCooldownUntil: null });
                return;
            }

            const lastNudge = new Date(profile.last_nudge_sent_at);
            const cooldownUntil = new Date(lastNudge.getTime() + NUDGE_COOLDOWN_MS);

            // Only set cooldown if it's still in the future
            if (cooldownUntil > new Date()) {
                set({ nudgeCooldownUntil: cooldownUntil });
            } else {
                set({ nudgeCooldownUntil: null });
            }
        } catch (err) {
            console.error("Error checking nudge cooldown:", err);
        }
    },
}));
