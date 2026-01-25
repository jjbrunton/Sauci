import { create } from "zustand";
import { supabase } from "../lib/supabase";
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
            // Get partner's user_id
            const { data: coupleProfiles } = await supabase
                .from("profiles")
                .select("id")
                .eq("couple_id", coupleId)
                .neq("id", userId);

            const partnerId = coupleProfiles?.[0]?.id;
            if (!partnerId) {
                set({ pendingQuestions: [], isLoadingPending: false });
                return;
            }

            // Get questions the current user has already answered
            const { data: userResponses } = await supabase
                .from("responses")
                .select("question_id")
                .eq("user_id", userId)
                .eq("couple_id", coupleId);

            const answeredQuestionIds = new Set(userResponses?.map(r => r.question_id) ?? []);

            // Get partner's responses (questions they answered that user hasn't)
            const { data: partnerResponses, error } = await supabase
                .from("responses")
                .select(`
                    id,
                    question_id,
                    created_at,
                    question:questions(
                        *,
                        pack:question_packs(id, name, icon)
                    )
                `)
                .eq("user_id", partnerId)
                .eq("couple_id", coupleId)
                .order("created_at", { ascending: false });

            if (error) throw error;

            // Filter to only questions user hasn't answered, excluding deleted questions
            // Note: Supabase returns single-object relations as arrays in type inference, but they're actually objects at runtime
            const pendingQuestions: PendingQuestion[] = (partnerResponses ?? [])
                .filter(r => {
                    const question = r.question as unknown as PendingQuestion['question'] | null;
                    return !answeredQuestionIds.has(r.question_id) && question && !(question as any).deleted_at;
                })
                .map(r => ({
                    id: r.id,
                    question: r.question as unknown as PendingQuestion['question'],
                    partnerAnsweredAt: r.created_at,
                }));

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
            // Get partner's user_id
            const { data: coupleProfiles } = await supabase
                .from("profiles")
                .select("id")
                .eq("couple_id", coupleId)
                .neq("id", userId);

            const partnerId = coupleProfiles?.[0]?.id;
            if (!partnerId) {
                set({ theirTurnQuestions: [], isLoadingTheirTurn: false });
                return;
            }

            // Get questions the partner has already answered
            const { data: partnerResponses } = await supabase
                .from("responses")
                .select("question_id")
                .eq("user_id", partnerId)
                .eq("couple_id", coupleId);

            const partnerAnsweredQuestionIds = new Set(partnerResponses?.map(r => r.question_id) ?? []);

            // Get user's responses (questions they answered that partner hasn't)
            const { data: userResponses, error } = await supabase
                .from("responses")
                .select(`
                    id,
                    question_id,
                    created_at,
                    question:questions(
                        *,
                        pack:question_packs(id, name, icon)
                    )
                `)
                .eq("user_id", userId)
                .eq("couple_id", coupleId)
                .order("created_at", { ascending: false });

            if (error) throw error;

            // Filter to only questions partner hasn't answered, excluding deleted questions
            const theirTurnQuestions: PendingQuestion[] = (userResponses ?? [])
                .filter(r => {
                    const question = r.question as unknown as PendingQuestion['question'] | null;
                    return !partnerAnsweredQuestionIds.has(r.question_id) && question && !(question as any).deleted_at;
                })
                .map(r => ({
                    id: r.id,
                    question: r.question as unknown as PendingQuestion['question'],
                    partnerAnsweredAt: r.created_at, // Using user's answer time here
                }));

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
            const { data: sessionData } = await supabase.auth.getSession();
            const token = sessionData?.session?.access_token;

            if (!token) {
                set({ isNudging: false });
                return { success: false, notificationSent: false };
            }

            const response = await fetch(
                `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/send-nudge-notification`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                    },
                }
            );

            const data: NudgeResponse = await response.json();

            if (response.status === 429) {
                // Rate limited - update cooldown
                const cooldownUntil = data.next_nudge_available_at
                    ? new Date(data.next_nudge_available_at)
                    : new Date(Date.now() + (data.cooldown_remaining_seconds || 0) * 1000);
                set({ nudgeCooldownUntil: cooldownUntil, isNudging: false });
                return { success: false, notificationSent: false };
            }

            if (!response.ok) {
                console.error("Nudge error:", data.error);
                set({ isNudging: false });
                return { success: false, notificationSent: false };
            }

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
            console.error("Error sending nudge:", err);
            set({ isNudging: false });
            return { success: false, notificationSent: false };
        }
    },

    checkNudgeCooldown: async () => {
        const userId = useAuthStore.getState().user?.id;
        if (!userId) return;

        try {
            const { data: profile, error } = await supabase
                .from("profiles")
                .select("last_nudge_sent_at")
                .eq("id", userId)
                .maybeSingle();

            if (error || !profile?.last_nudge_sent_at) {
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
