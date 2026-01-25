import { create } from "zustand";
import { supabase } from "../lib/supabase";
import { invokeWithAuthRetry } from "../lib/authErrorHandler";
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

interface ResponsesState {
    responses: ResponseWithQuestion[];
    isLoading: boolean;
    isLoadingMore: boolean;
    groupBy: GroupByOption;
    dateSortOrder: DateSortOrder;
    hasMore: boolean;
    page: number;
    totalCount: number | null;
    fetchResponses: (refresh?: boolean) => Promise<void>;
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
    isLoadingMore: false,
    groupBy: "date",
    dateSortOrder: "newest",
    hasMore: true,
    page: 0,
    totalCount: null,

    fetchResponses: async (refresh = false) => {
        const userId = useAuthStore.getState().user?.id;
        const coupleId = useAuthStore.getState().user?.couple_id;

        if (!userId || !coupleId) return;

        const state = get();
        if (state.isLoading || (state.isLoadingMore && !refresh)) return;

        if (refresh) {
            set({ isLoading: true, page: 0, hasMore: true });
        } else {
            if (!state.hasMore) return;
            set({ isLoadingMore: true });
        }

        try {
            const currentPage = refresh ? 0 : state.page;
            const from = currentPage * BATCH_SIZE;
            const to = from + BATCH_SIZE - 1;

            // Fetch total count on refresh
            let totalCount = state.totalCount;
            if (refresh) {
                const { count, error: countError } = await supabase
                    .from("responses")
                    .select("*, question:questions!inner(pack:question_packs!inner(id))", { count: "exact", head: true })
                    .eq("user_id", userId);

                if (!countError) {
                    totalCount = count ?? 0;
                }
            }

            // Fetch all user's responses with questions and packs
            const { data: responses, error: responsesError } = await supabase
                .from("responses")
                .select(`
                    id,
                    question_id,
                    answer,
                    response_data,
                    created_at,
                    question:questions!inner(
                        id,
                        text,
                        partner_text,
                        intensity,
                        pack_id,
                        question_type,
                        config,
                        pack:question_packs!inner(id, name, icon)
                    )
                `)
                .eq("user_id", userId)
                .order("created_at", { ascending: false })
                .range(from, to);

            if (responsesError) {
                console.error("Error fetching responses:", responsesError);
                set({ isLoading: false, isLoadingMore: false });
                return;
            }

            if (!responses || responses.length === 0) {
                if (refresh) {
                    set({ responses: [], totalCount: totalCount ?? 0, isLoading: false, hasMore: false });
                } else {
                    set({ isLoadingMore: false, hasMore: false });
                }
                return;
            }

            // Get question IDs for match lookup
            const questionIds = responses.map((r) => r.question_id);

            // Fetch matches for these questions
            const { data: matches } = await supabase
                .from("matches")
                .select("id, question_id")
                .eq("couple_id", coupleId)
                .in("question_id", questionIds);

            // Create a map of question_id -> match_id
            const matchMap = new Map<string, string>();
            matches?.forEach((m) => matchMap.set(m.question_id, m.id));

            // Fetch partner's responses to check if they've answered
            const { data: partnerResponses } = await supabase
                .from("responses")
                .select("question_id")
                .eq("couple_id", coupleId)
                .neq("user_id", userId)
                .in("question_id", questionIds);

            // Create a set of question IDs that partner has answered
            const partnerAnsweredSet = new Set<string>(
                partnerResponses?.map((r) => r.question_id) || []
            );

            // Transform responses with match and partner info
            const transformedResponses: ResponseWithQuestion[] = responses
                .filter((r) => {
                    // Supabase returns single relations as objects, but TypeScript may infer arrays
                    const question = r.question as any;
                    return question && question.pack;
                })
                .map((r) => {
                    // Cast to any to handle Supabase's nested select typing
                    const question = r.question as any;
                    const pack = question.pack as any;

                    return {
                        id: r.id,
                        question_id: r.question_id,
                        answer: r.answer as AnswerType,
                        response_data: (r as any).response_data as ResponseData | null,
                        created_at: r.created_at,
                        question: {
                            id: question.id,
                            text: question.text,
                            partner_text: question.partner_text,
                            intensity: question.intensity,
                            pack_id: question.pack_id,
                            question_type: question.question_type,
                            config: question.config ?? null,
                            created_at: question.created_at || "",
                            pack: {
                                id: pack.id,
                                name: pack.name,
                                icon: pack.icon,
                            },
                        },
                        has_match: matchMap.has(r.question_id),
                        match_id: matchMap.get(r.question_id),
                        partner_answered: partnerAnsweredSet.has(r.question_id),
                    };
                });
            
            set((state) => ({
                responses: refresh
                    ? transformedResponses
                    : [...state.responses, ...transformedResponses],
                totalCount: refresh ? totalCount : state.totalCount,
                isLoading: false,
                isLoadingMore: false,
                page: currentPage + 1,
                hasMore: responses.length === BATCH_SIZE
            }));
        } catch (error) {
            console.error("Error in fetchResponses:", error);
            set({ isLoading: false, isLoadingMore: false });
        }
    },

    updateResponse: async (
        questionId: string,
        newAnswer: AnswerType,
        confirmDelete = false,
        responseData?: ResponseData | null
    ): Promise<UpdateResponseResult> => {
        const { data, error } = await invokeWithAuthRetry("update-response", {
            body: {
                question_id: questionId,
                new_answer: newAnswer,
                confirm_delete_match: confirmDelete,
                response_data: responseData,
            },
        });

        if (error) {
            console.error("Error updating response:", error);
            return { success: false, error: error.message || "Failed to update response" };
        }

        const result = data as UpdateResponseResult;

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
        set({ responses: [], isLoading: false, groupBy: "date", dateSortOrder: "newest", page: 0, hasMore: true, isLoadingMore: false, totalCount: null });
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
