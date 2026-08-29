import { create } from "zustand";
import { apiClient } from "../lib/apiClient";
import type { Question, QuestionPack, AnswerType, ResponseData } from "@/types";
import { useAuthStore } from "./authStore";
import { useMatchStore } from "./matchStore";

// Response with joined question and pack data
export interface ResponseWithQuestion {
    id: string;
    question_id: string;
    answer: AnswerType;
    response_data?: ResponseData | null;
    created_at: string;
    question: Question & {
        pack: Pick<QuestionPack, "id" | "name" | "icon">;
    };
    has_match: boolean;
    match_id?: string;
    partner_answered: boolean;
}

// Result from update-response edge function
export interface UpdateResponseResult {
    success: boolean;
    requires_confirmation?: boolean;
    match_id?: string;
    message_count?: number;
    new_match?: Record<string, unknown> | null;
    match_deleted?: boolean;
    match_type_updated?: boolean;
    error?: string;
}

export type GroupByOption = "pack" | "date" | "answer";
export type DateSortOrder = "newest" | "oldest";

const BATCH_SIZE = 20;

// Overlap protection independent of the presentational flags: a refresh over cached
// rows raises `isRefreshing`, not `isLoading`, and still must not run twice. Keyed to
// the generation that started the request: a stale generation's entry must not block
// the next account's request, and its `finally` must not clear a newer generation's guard.
const inFlight = new Map<string, number>();

interface ResponsesState {
    responses: ResponseWithQuestion[];
    /** First load only. A refresh over rows already on screen must not blank the list. */
    isLoading: boolean;
    /** Refresh over cached rows; drives pull-to-refresh only. */
    isRefreshing: boolean;
    isLoadingMore: boolean;
    groupBy: GroupByOption;
    dateSortOrder: DateSortOrder;
    hasMore: boolean;
    page: number;
    totalCount: number | null;
    /** Null until the first successful read; an empty history is a loaded answer. */
    loadedAt: number | null;
    /** Bumped on clear/sign-out so a response that outlives it cannot write into the next account's store. */
    generation: number;
    fetchResponses: (refresh?: boolean) => Promise<void>;
    /** Loads the first page once; revisiting the screen reuses what is cached. */
    ensureResponsesLoaded: () => Promise<void>;
    /** Marks the cache stale without spending a request; the next ensure reloads it. */
    invalidateResponses: () => void;
    updateResponse: (
        questionId: string,
        newAnswer: AnswerType,
        confirmDelete?: boolean,
        responseData?: ResponseData | null
    ) => Promise<UpdateResponseResult>;
    setGroupBy: (groupBy: GroupByOption) => void;
    setDateSortOrder: (order: DateSortOrder) => void;
    toggleDateSortOrder: () => void;
    clearResponses: () => void;
}

export const useResponsesStore = create<ResponsesState>((set, get) => ({
    responses: [],
    isLoading: false,
    isRefreshing: false,
    isLoadingMore: false,
    groupBy: "date",
    dateSortOrder: "newest",
    hasMore: true,
    page: 0,
    totalCount: null,
    loadedAt: null,
    generation: 0,

    fetchResponses: async (refresh = false) => {
        const userId = useAuthStore.getState().user?.id;
        const coupleId = useAuthStore.getState().user?.couple_id;

        if (!userId || !coupleId) return;

        const myGeneration = get().generation;
        const state = get();
        if (inFlight.get('responses') === myGeneration || (state.isLoadingMore && !refresh)) return;

        // Nothing on screen yet is the only case that warrants a full-screen spinner;
        // every other refresh leaves the cached rows in place until replacements land.
        const initial = state.loadedAt === null;
        if (refresh) {
            set({ isLoading: initial, isRefreshing: !initial, page: 0, hasMore: true });
        } else {
            if (!state.hasMore) return;
            set({ isLoadingMore: true });
        }

        inFlight.set('responses', myGeneration);
        try {
            const currentPage = refresh ? 0 : state.page;
            const result = await apiClient.get<{responses: ResponseWithQuestion[];totalCount:number}>(`/v1/me/responses?page=${currentPage}&limit=${BATCH_SIZE}`);
            if (get().generation !== myGeneration) return;
            const responses = result.responses;
            const totalCount = result.totalCount;

            if (!responses || responses.length === 0) {
                if (refresh) {
                    set({ responses: [], totalCount: totalCount ?? 0, isLoading: false, isRefreshing: false, hasMore: false, loadedAt: Date.now() });
                } else {
                    set({ isLoadingMore: false, hasMore: false });
                }
                return;
            }

            const transformedResponses = responses;

            set((state) => ({
                responses: refresh
                    ? transformedResponses
                    : [...state.responses, ...transformedResponses],
                totalCount: refresh ? totalCount : state.totalCount,
                isLoading: false,
                isRefreshing: false,
                isLoadingMore: false,
                page: currentPage + 1,
                hasMore: responses.length === BATCH_SIZE,
                loadedAt: Date.now(),
            }));
        } catch (error) {
            if (get().generation !== myGeneration) return;
            console.error("Error in fetchResponses:", error);
            set({ isLoading: false, isRefreshing: false, isLoadingMore: false });
        } finally {
            if (inFlight.get('responses') === myGeneration) inFlight.delete('responses');
        }
    },

    ensureResponsesLoaded: async () => {
        if (get().loadedAt !== null) return;
        await get().fetchResponses(true);
    },

    invalidateResponses: () => {
        set({ loadedAt: null });
    },

    updateResponse: async (
        questionId: string,
        newAnswer: AnswerType,
        confirmDelete = false,
        responseData?: ResponseData | null
    ): Promise<UpdateResponseResult> => {
        const myGeneration = get().generation;
        try {
            const result = await apiClient.patch<UpdateResponseResult>(`/v1/responses/${questionId}`, {
                new_answer: newAnswer,
                confirm_delete_match: confirmDelete,
                response_data: responseData,
            });

            // Rows are keyed by a question id from the shared catalogue, so once the
            // store has been cleared that same id can name a different account's
            // answer. Hand the caller the server's result — it is true of whoever
            // asked — but write nothing, and refresh no matches, for the account
            // that is loaded now.
            if (get().generation !== myGeneration) return result;

        // If update was successful (not just requiring confirmation), update local state
        if (result.success && !result.requires_confirmation) {
            // Update local response state
            set((state) => ({
                responses: state.responses.map((r) => {
                    if (r.question_id === questionId) {
                        const nextResponseData =
                            newAnswer === "no"
                                ? null
                                : typeof responseData !== "undefined"
                                  ? responseData
                                  : r.response_data;
                        return {
                            ...r,
                            answer: newAnswer,
                            response_data: nextResponseData,
                            // Update match status based on result
                            has_match: result.match_deleted
                                ? false
                                : result.new_match
                                  ? true
                                  : r.has_match,
                            match_id: result.match_deleted
                                ? undefined
                                : result.new_match
                                  ? (result.new_match.id as string)
                                  : r.match_id,
                        };
                    }
                    return r;
                }),
            }));

            // Refresh matches store if match was created, deleted, or type updated
            if (result.match_deleted || result.new_match || result.match_type_updated) {
                useMatchStore.getState().fetchMatches();
            }
        }

            return result;
        } catch (error) {
            console.error("Error updating response:", error);
            return { success: false, error: error instanceof Error ? error.message : "Failed to update response" };
        }
    },

    setGroupBy: (groupBy: GroupByOption) => {
        set({ groupBy });
    },

    setDateSortOrder: (order: DateSortOrder) => {
        set({ dateSortOrder: order });
    },

    toggleDateSortOrder: () => {
        set((state) => ({
            dateSortOrder: state.dateSortOrder === "newest" ? "oldest" : "newest",
        }));
    },

    clearResponses: () => {
        set((state) => ({
            responses: [], isLoading: false, isRefreshing: false, groupBy: "date", dateSortOrder: "newest",
            page: 0, hasMore: true, isLoadingMore: false, totalCount: null, loadedAt: null,
            // Invalidates any request already in flight for the signed-out user.
            generation: state.generation + 1,
        }));
        // See matchStore.clearMatches: the previous user's in-flight page must not
        // block the next user's.
        inFlight.clear();
    },
}));

// Helper function to group responses
export function groupResponses(
    responses: ResponseWithQuestion[],
    groupBy: GroupByOption,
    dateSortOrder: DateSortOrder = "newest"
): { title: string; data: ResponseWithQuestion[] }[] {
    if (groupBy === "pack") {
        // Group by pack name
        const groups = new Map<string, ResponseWithQuestion[]>();
        responses.forEach((r) => {
            const packName = r.question.pack.name;
            if (!groups.has(packName)) {
                groups.set(packName, []);
            }
            groups.get(packName)!.push(r);
        });
        return Array.from(groups.entries()).map(([title, data]) => ({ title, data }));
    }

    if (groupBy === "answer") {
        // Group by answer type
        const yesResponses = responses.filter((r) => r.answer === "yes");
        const maybeResponses = responses.filter((r) => r.answer === "maybe");
        const noResponses = responses.filter((r) => r.answer === "no");

        const sections = [];
        if (yesResponses.length > 0) sections.push({ title: "Yes", data: yesResponses });
        if (maybeResponses.length > 0) sections.push({ title: "Maybe", data: maybeResponses });
        if (noResponses.length > 0) sections.push({ title: "No", data: noResponses });
        return sections;
    }

    if (groupBy === "date") {
        // Sort responses by date based on sort order
        const sortedResponses = [...responses].sort((a, b) => {
            const dateA = new Date(a.created_at).getTime();
            const dateB = new Date(b.created_at).getTime();
            return dateSortOrder === "newest" ? dateB - dateA : dateA - dateB;
        });

        // Group by date (day)
        const groups = new Map<string, ResponseWithQuestion[]>();
        sortedResponses.forEach((r) => {
            const date = new Date(r.created_at).toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
            });
            if (!groups.has(date)) {
                groups.set(date, []);
            }
            groups.get(date)!.push(r);
        });
        return Array.from(groups.entries()).map(([title, data]) => ({ title, data }));
    }

    return [{ title: "All Responses", data: responses }];
}
