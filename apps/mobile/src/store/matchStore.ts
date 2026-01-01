import { create } from "zustand";
import { supabase } from "../lib/supabase";
import type { Match } from "@/types";
import { useAuthStore } from "./authStore";

interface MatchState {
    matches: Match[];
    newMatchesCount: number;
    fetchMatches: () => Promise<void>;
    markAsSeen: (matchId: string) => Promise<void>;
    markAllAsSeen: () => Promise<void>;
    addMatch: (match: Match) => void;
    clearMatches: () => void;
}

export const useMatchStore = create<MatchState>((set, get) => ({
    matches: [],
    newMatchesCount: 0,

    fetchMatches: async () => {
        const userId = useAuthStore.getState().user?.id;

        const { data: matches } = await supabase
            .from("matches")
            .select(`
        *,
        question:questions(*)
      `)
            .order("created_at", { ascending: false });

        if (!matches) return;

        // Fetch all responses for these questions to determine who answered first
        const questionIds = matches.map(m => m.question_id);
        const { data: responses } = await supabase
            .from("responses")
            .select("*")
            .in("question_id", questionIds);

        // Fetch unread message counts per match
        const matchIds = matches.map(m => m.id);
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

        const data = matches.map(match => ({
            ...match,
            responses: responses?.filter(r => r.question_id === match.question_id) || [],
            unreadCount: unreadCounts[match.id] || 0
        }));

        // Sort: unread messages first, then by most recent
        const sortedData = data.sort((a, b) => {
            // First priority: matches with unread messages
            if (a.unreadCount > 0 && b.unreadCount === 0) return -1;
            if (a.unreadCount === 0 && b.unreadCount > 0) return 1;

            // Second priority: most recent first
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });

        const newCount = sortedData.filter((m) => m.is_new).length;
        set({ matches: sortedData, newMatchesCount: newCount });
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
        }));
    },

    clearMatches: () => {
        set({ matches: [], newMatchesCount: 0 });
    },
}));
