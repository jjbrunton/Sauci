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

/**
 * A refresh that must not disturb what the user is looking at: no spinner, and
 * the cached rows stay on screen until the replacement arrives.
 */
export interface FetchOptions { silent?: boolean }

// Overlap protection lives outside the store because the loading flags are now
// presentational — a silent refresh sets none of them and still must not run twice.
// Keyed to the generation that started the request (see `generation` below) rather
// than a bare presence check: a stale generation's entry must not block the next
// account's request for the same key, and a stale generation's `finally` must not
// clear an entry a newer generation just claimed.
const inFlight = new Map<string, number>();

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
    /** A user-initiated refresh over data already on screen; drives pull-to-refresh only. */
    isRefreshing: boolean;
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
    /**
     * When each view last loaded successfully. Tracked separately from the row
     * arrays because an empty view is still a loaded view, and revisiting one
     * must not refetch.
     */
    loadedAt: Partial<Record<MatchViewType, number>>;
    // Nudge state
    nudgeCooldownUntil: Date | null;
    isNudging: boolean;
    /**
     * Bumped on every clear (sign-out/account switch). A fetch captures this before
     * it starts and checks it again before writing its result, so a response that
     * outlives the clear cannot land in the next account's store.
     */
    generation: number;
    // Methods
    fetchMatches: (refresh?: boolean, options?: FetchOptions) => Promise<void>;
    markAsSeen: (matchId: string) => Promise<void>;
    markAllAsSeen: () => Promise<void>;
    addMatch: (match: Match) => void;
    updateMatchUnreadCount: (matchId: string, delta: number) => void;
    clearMatches: () => void;
    // Archive methods
    archiveMatch: (matchId: string) => Promise<void>;
    unarchiveMatch: (matchId: string) => Promise<void>;
    fetchArchivedMatches: (options?: FetchOptions) => Promise<void>;
    toggleShowArchived: () => void;
    isMatchArchived: (matchId: string) => boolean;
    // Pending methods
    fetchPendingQuestions: (options?: FetchOptions) => Promise<void>;
    fetchTheirTurnQuestions: (options?: FetchOptions) => Promise<void>;
    setCurrentView: (view: MatchViewType) => void;
    ensureViewLoaded: (view?: MatchViewType) => void;
    // Nudge methods
    sendNudge: () => Promise<{ success: boolean; notificationSent: boolean }>;
    checkNudgeCooldown: () => Promise<void>;
}

export const useMatchStore = create<MatchState>((set, get) => ({
    matches: [],
    newMatchesCount: 0,
    totalCount: null,
    isLoading: false,
    isRefreshing: false,
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
    loadedAt: {},
    // Nudge state
    nudgeCooldownUntil: null,
    isNudging: false,
    generation: 0,

    fetchMatches: async (refresh = false, options = {}) => {
        const coupleId = useAuthStore.getState().user?.couple_id;
        const myGeneration = get().generation;

        // Early return if no couple - user isn't paired yet
        if (!coupleId) {
            set({ matches: [], newMatchesCount: 0, totalCount: 0, isLoading: false, isRefreshing: false });
            return;
        }

        const state = get();
        if (inFlight.get('active') === myGeneration || (state.isLoadingMore && !refresh)) return;

        // Nothing on screen yet is the only case that warrants blanking the list
        // for a spinner; every other refresh leaves the cached rows in place.
        const initial = state.loadedAt.active === undefined;
        if (refresh) {
            set({ isLoading: initial, isRefreshing: !initial && !options.silent, error: null, page: 0, hasMore: true });
        } else {
            if (!state.hasMore) return;
            set({ isLoadingMore: true });
        }

        inFlight.set('active', myGeneration);
        try {
            const currentPage = refresh ? 0 : state.page;
            const result = await apiClient.get<{ matches: Match[]; totalCount: number | null; hasMore?: boolean }>(`/v1/matches?page=${currentPage}&limit=${BATCH_SIZE}`);
            // A sign-out/account switch that happened while this request was in
            // flight must not let its response populate the next account's store.
            if (get().generation !== myGeneration) return;
            const nonArchivedMatches = result.matches;
            const totalCount = result.totalCount;
            const archivedMatchIds = state.archivedMatchIds;
            // The API reports this by reading one row past the page; the length
            // comparison is only a fallback for an older server.
            const hasMore = result.hasMore ?? nonArchivedMatches.length === BATCH_SIZE;
            const loadedAt = { ...state.loadedAt, active: Date.now() };

            if (nonArchivedMatches.length === 0) {
                 if (refresh) {
                    set({ matches: [], newMatchesCount: 0, totalCount: totalCount ?? 0, isLoading: false, isRefreshing: false, hasMore: false, archivedMatchIds, loadedAt });
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
                // Later pages no longer carry a total, so keep the one the refresh recorded.
                totalCount: refresh ? totalCount ?? state.totalCount : state.totalCount,
                isLoading: false,
                isRefreshing: false,
                isLoadingMore: false,
                page: currentPage + 1,
                hasMore,
                archivedMatchIds: refresh ? archivedMatchIds : state.archivedMatchIds,
                loadedAt,
                };
            });
        } catch (err) {
            if (get().generation !== myGeneration) return;
            console.error("Error fetching matches:", err);
            set({ error: "Failed to load matches", isLoading: false, isRefreshing: false, isLoadingMore: false });
        } finally {
            // An old generation's cleanup must not delete a newer generation's guard.
            if (inFlight.get('active') === myGeneration) inFlight.delete('active');
        }
    },

    markAsSeen: async (matchId) => {
        const myGeneration = get().generation;
        await apiClient.patch("/v1/matches/seen", { ids: [matchId] });
        // A clear while this was in flight leaves an empty list behind, and the
        // recount below would write that emptiness — and a zero badge — over
        // whatever the next account has already loaded.
        if (get().generation !== myGeneration) return;

        const matches = get().matches.map((m) =>
            m.id === matchId ? { ...m, is_new: false } : m
        );
        const newCount = matches.filter((m) => m.is_new).length;
        set({ matches, newMatchesCount: newCount });
    },

    markAllAsSeen: async () => {
        const myGeneration = get().generation;
        const newMatches = get().matches.filter((m) => m.is_new);
        if (newMatches.length === 0) return;

        const newMatchIds = newMatches.map((m) => m.id);
        await apiClient.patch("/v1/matches/seen", { ids: newMatchIds });
        if (get().generation !== myGeneration) return;

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
        set((state) => ({
            matches: [],
            newMatchesCount: 0,
            totalCount: null,
            isLoading: false,
            isRefreshing: false,
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
            loadedAt: {},
            nudgeCooldownUntil: null,
            isNudging: false,
            // Invalidates any request already in flight: its generation check will
            // fail and it will not be able to write into the next account's store.
            generation: state.generation + 1,
        }));
        // A request belonging to the signed-out user must not suppress the next
        // one: the guard is a duplicate-request check, not a lock on the data.
        inFlight.clear();
    },

    // Archive methods
    archiveMatch: async (matchId: string) => {
        const userId = useAuthStore.getState().user?.id;
        if (!userId) return;

        // Optimistically update UI
        const state = get();
        const myGeneration = state.generation;
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
            // Revert on error — but only into the store the optimistic update was
            // applied to. After an account switch the row it would restore belongs
            // to the previous couple, and putting it back would show one couple's
            // match inside another's list.
            if (get().generation !== myGeneration) return;
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
        const myGeneration = state.generation;
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
            // Revert on error, and only for the account that started it.
            if (get().generation !== myGeneration) return;
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

    fetchArchivedMatches: async (options = {}) => {
        const userId = useAuthStore.getState().user?.id;
        const coupleId = useAuthStore.getState().user?.couple_id;

        if (!coupleId || !userId) return;

        const myGeneration = get().generation;
        const state = get();
        if (inFlight.get('archived') === myGeneration) return;
        if (!options.silent || state.loadedAt.archived === undefined) set({ isLoadingArchived: true });

        inFlight.set('archived', myGeneration);
        try {
            const result = await apiClient.get<{matches:Match[];totalCount:number | null}>(`/v1/matches?archived=true&limit=100`);
            if (get().generation !== myGeneration) return;
            const archivedMatches = result.matches;
            const archivedIds = archivedMatches.map(match => match.id);
            set((current) => ({
                archivedMatches,
                isLoadingArchived: false,
                archivedMatchIds: new Set(archivedIds),
                loadedAt: { ...current.loadedAt, archived: Date.now() },
            }));
        } catch (err) {
            if (get().generation !== myGeneration) return;
            console.error("Error fetching archived matches:", err);
            set({ isLoadingArchived: false });
        } finally {
            if (inFlight.get('archived') === myGeneration) inFlight.delete('archived');
        }
    },

    toggleShowArchived: () => {
        const state = get();
        const newShowArchived = !state.showArchived;

        set({ showArchived: newShowArchived });

        // Fetch archived matches if switching to archived view and not yet loaded
        if (newShowArchived && state.loadedAt.archived === undefined) {
            void get().fetchArchivedMatches();
        }
    },

    isMatchArchived: (matchId: string) => {
        return get().archivedMatchIds.has(matchId);
    },

    // Pending (Your Turn) methods
    fetchPendingQuestions: async (options = {}) => {
        const userId = useAuthStore.getState().user?.id;
        const coupleId = useAuthStore.getState().user?.couple_id;

        if (!coupleId || !userId) {
            set({ pendingQuestions: [], isLoadingPending: false });
            return;
        }

        const myGeneration = get().generation;
        const state = get();
        if (inFlight.get('pending') === myGeneration) return;
        if (!options.silent || state.loadedAt.pending === undefined) set({ isLoadingPending: true });

        inFlight.set('pending', myGeneration);
        try {
            const { questions: pendingQuestions } = await apiClient.get<{questions:PendingQuestion[]}>("/v1/questions/pending?direction=partner");
            if (get().generation !== myGeneration) return;
            set((current) => ({ pendingQuestions, isLoadingPending: false, loadedAt: { ...current.loadedAt, pending: Date.now() } }));
        } catch (err) {
            if (get().generation !== myGeneration) return;
            console.error("Error fetching pending questions:", err);
            set({ isLoadingPending: false });
        } finally {
            if (inFlight.get('pending') === myGeneration) inFlight.delete('pending');
        }
    },

    // Their Turn methods (user answered, partner hasn't yet)
    fetchTheirTurnQuestions: async (options = {}) => {
        const userId = useAuthStore.getState().user?.id;
        const coupleId = useAuthStore.getState().user?.couple_id;

        if (!coupleId || !userId) {
            set({ theirTurnQuestions: [], isLoadingTheirTurn: false });
            return;
        }

        const myGeneration = get().generation;
        const state = get();
        if (inFlight.get('their_turn') === myGeneration) return;
        if (!options.silent || state.loadedAt.their_turn === undefined) set({ isLoadingTheirTurn: true });

        inFlight.set('their_turn', myGeneration);
        try {
            const { questions: theirTurnQuestions } = await apiClient.get<{questions:PendingQuestion[]}>("/v1/questions/pending?direction=mine");
            if (get().generation !== myGeneration) return;
            set((current) => ({ theirTurnQuestions, isLoadingTheirTurn: false, loadedAt: { ...current.loadedAt, their_turn: Date.now() } }));
        } catch (err) {
            if (get().generation !== myGeneration) return;
            console.error("Error fetching their turn questions:", err);
            set({ isLoadingTheirTurn: false });
        } finally {
            if (inFlight.get('their_turn') === myGeneration) inFlight.delete('their_turn');
        }
    },

    setCurrentView: (view: MatchViewType) => {
        // Update showArchived for backwards compatibility
        const showArchived = view === 'archived';
        set({ currentView: view, showArchived });

        get().ensureViewLoaded(view);
    },

    /**
     * Loads a view once. Emptiness is not evidence of never having loaded, so
     * returning to a legitimately empty view costs no request at all.
     */
    ensureViewLoaded: (view = get().currentView) => {
        if (get().loadedAt[view] !== undefined) return;
        if (view === 'archived') void get().fetchArchivedMatches();
        else if (view === 'pending') void get().fetchPendingQuestions();
        else if (view === 'their_turn') void get().fetchTheirTurnQuestions();
        else void get().fetchMatches(true);
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

        const myGeneration = state.generation;
        set({ isNudging: true });

        try {
            const data = await appDataApi.sendNudge();
            // The cooldown is per-account. Recording the previous account's window
            // would either silence the new account's nudge or clear a real cooldown.
            if (get().generation !== myGeneration) return { success: false, notificationSent: false };

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
            if (get().generation !== myGeneration) return { success: false, notificationSent: false };
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

        const myGeneration = get().generation;
        try {
            const profile = await appDataApi.nudgeStatus();
            // Read for the previous account: neither its cooldown nor its absence
            // says anything about whether this one may nudge.
            if (get().generation !== myGeneration) return;

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
