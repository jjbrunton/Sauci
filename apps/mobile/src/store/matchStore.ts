import { create } from "zustand";
import { supabase } from "../lib/supabase";
import type { Match } from "@/types";
import { useAuthStore } from "./authStore";

const BATCH_SIZE = 20;

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
            const from = currentPage * BATCH_SIZE;
            const to = from + BATCH_SIZE - 1;

            // Fetch archived match IDs for this user on refresh
            let archivedMatchIds = state.archivedMatchIds;
            if (refresh && userId) {
                const { data: archives } = await supabase
                    .from("match_archives")
                    .select("match_id")
                    .eq("user_id", userId);

                archivedMatchIds = new Set(archives?.map(a => a.match_id) ?? []);
            }

            // Fetch total count on refresh (excluding archived)
            let totalCount = state.totalCount;
            if (refresh) {
                const { count, error: countError } = await supabase
                    .from("matches")
                    .select("*", { count: "exact", head: true })
                    .eq("couple_id", coupleId);

                if (!countError) {
                    // Subtract archived count from total
                    totalCount = (count ?? 0) - archivedMatchIds.size;
                }
            }

            const { data: matches, error: matchError } = await supabase
                .from("matches")
                .select(`
            *,
            question:questions(*)
          `)
                .eq("couple_id", coupleId)
                .order("created_at", { ascending: false })
                .range(from, to);

            if (matchError) throw matchError;

            // Filter out archived matches
            const nonArchivedMatches = matches?.filter(m => !archivedMatchIds.has(m.id)) ?? [];

            if (nonArchivedMatches.length === 0) {
                 if (refresh) {
                    set({ matches: [], newMatchesCount: 0, totalCount: totalCount ?? 0, isLoading: false, hasMore: false, archivedMatchIds });
                } else {
                    set({ isLoadingMore: false, hasMore: false });
                }
                return;
            }

            // Fetch all responses for these questions to determine who answered first
            const questionIds = nonArchivedMatches.map(m => m.question_id);
            let responses: any[] = [];
            if (questionIds.length > 0) {
                const { data } = await supabase
                    .from("responses")
                    .select("*")
                    .in("question_id", questionIds);
                responses = data ?? [];
            }

            // Fetch unread message counts per match
            const matchIds = nonArchivedMatches.map(m => m.id);
            let unreadCounts: Record<string, number> = {};

            if (userId && matchIds.length > 0) {
                const { data: unreadMessages, error } = await supabase
                    .from("messages")
                    .select("match_id")
                    .in("match_id", matchIds)
                    .neq("user_id", userId)
                    .is("read_at", null);

                if (error) {
                    console.error("Error fetching unread messages:", error);
                }

                // Count unread messages per match
                unreadMessages?.forEach(msg => {
                    unreadCounts[msg.match_id] = (unreadCounts[msg.match_id] || 0) + 1;
                });
            }

            const data = nonArchivedMatches.map(match => ({
                ...match,
                responses: responses.filter(r => r.question_id === match.question_id),
                unreadCount: unreadCounts[match.id] || 0
            }));

            // Sort: unread messages first, then by most recent
            // Note: Since we fetch by created_at desc, and then sort by unread in memory,
            // pagination might be slightly inconsistent if unread messages are scattered.
            // However, implementing complex sort in Supabase with computed columns is harder.
            // For now, we accept that the sort is applied within the fetched batch.
            const sortedData = data.sort((a, b) => {
                // First priority: matches with unread messages
                if (a.unreadCount > 0 && b.unreadCount === 0) return -1;
                if (a.unreadCount === 0 && b.unreadCount > 0) return 1;

                // Second priority: most recent first
                return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
            });

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
        await supabase
            .from("matches")
            .update({ is_new: false })
            .eq("id", matchId);

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
        await supabase
            .from("matches")
            .update({ is_new: false })
            .in("id", newMatchIds);

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

        // Insert archive record
        const { error } = await supabase
            .from("match_archives")
            .insert({ match_id: matchId, user_id: userId });

        if (error) {
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

        // Delete archive record
        const { error } = await supabase
            .from("match_archives")
            .delete()
            .eq("match_id", matchId)
            .eq("user_id", userId);

        if (error) {
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
            // Get archived match IDs for this user
            const { data: archives, error: archiveError } = await supabase
                .from("match_archives")
                .select("match_id")
                .eq("user_id", userId);

            if (archiveError) throw archiveError;

            const archivedIds = archives?.map(a => a.match_id) ?? [];

            if (archivedIds.length === 0) {
                set({ archivedMatches: [], isLoadingArchived: false });
                return;
            }

            // Fetch the actual match data
            const { data: matches, error: matchError } = await supabase
                .from("matches")
                .select(`
                    *,
                    question:questions(*)
                `)
                .in("id", archivedIds)
                .eq("couple_id", coupleId)
                .order("created_at", { ascending: false });

            if (matchError) throw matchError;

            // Fetch unread counts for archived matches
            const matchIds = matches?.map(m => m.id) ?? [];
            let unreadCounts: Record<string, number> = {};

            if (matchIds.length > 0) {
                const { data: unreadMessages } = await supabase
                    .from("messages")
                    .select("match_id")
                    .in("match_id", matchIds)
                    .neq("user_id", userId)
                    .is("read_at", null);

                unreadMessages?.forEach(msg => {
                    unreadCounts[msg.match_id] = (unreadCounts[msg.match_id] || 0) + 1;
                });
            }

            const archivedMatches = (matches ?? []).map(match => ({
                ...match,
                unreadCount: unreadCounts[match.id] || 0
            }));

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
}));
