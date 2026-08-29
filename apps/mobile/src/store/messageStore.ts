import { create } from "zustand";
import { chatApi } from "../lib/chatApi";
import type { Database } from "@/types/supabase";
import { useAuthStore } from "./authStore";
import { useMatchStore } from "./matchStore";

type Message = Database["public"]["Tables"]["messages"]["Row"];

interface MessageWithMatch extends Message {
    match?: {
        id: string;
        question: {
            text: string;
        };
    };
}

interface MessageState {
    unreadCount: number;
    lastMessage: MessageWithMatch | null;
    activeMatchId: string | null; // Track which chat is currently open
    /**
     * Bumped by `clearMessages` on sign-out or a couple change, so a reply that
     * outlives the account that asked for it cannot write into the next one's badge.
     */
    generation: number;
    fetchUnreadCount: () => Promise<void>;
    /** Applies a count the sync summary already reported, without a second request. */
    setUnreadCount: (total: number) => void;
    addMessage: (message: MessageWithMatch) => void;
    clearLastMessage: () => void;
    setActiveMatchId: (matchId: string | null) => void;
    markMatchMessagesAsRead: (matchId: string) => Promise<void>;
    clearMessages: () => void;
}

export const useMessageStore = create<MessageState>((set, get) => ({
    unreadCount: 0,
    lastMessage: null,
    activeMatchId: null,
    generation: 0,

    fetchUnreadCount: async () => {
        const userId = useAuthStore.getState().user?.id;
        if (!userId) {
            set({ unreadCount: 0 });
            return;
        }

        const myGeneration = get().generation;
        const { total } = await chatApi.unread();
        // This total counts one account's messages; after a clear it would show
        // up as the next account's badge.
        if (get().generation !== myGeneration) return;
        set({ unreadCount: total });
    },

    setUnreadCount: (total) => {
        set({ unreadCount: Math.max(0, total) });
    },

    addMessage: (message) => {
        const userId = useAuthStore.getState().user?.id;
        const activeMatchId = get().activeMatchId;

        // Only show notification if message is from partner and not in the active chat
        if (message.user_id !== userId && message.match_id !== activeMatchId) {
            set((state) => ({
                unreadCount: state.unreadCount + 1,
                lastMessage: message,
            }));
        }
    },

    clearLastMessage: () => {
        set({ lastMessage: null });
    },

    setActiveMatchId: (matchId) => {
        set({ activeMatchId: matchId });
    },

    markMatchMessagesAsRead: async (matchId) => {
        const userId = useAuthStore.getState().user?.id;
        if (!userId) return;

        const myGeneration = get().generation;
        const { updated: unreadInMatch } = await chatApi.markRead(matchId);
        if (unreadInMatch <= 0) return;

        // Those messages belonged to a couple that is no longer loaded, and the
        // match they were in is not in the current list, so subtracting them now
        // would take the old badge off the new account's.
        if (get().generation !== myGeneration) return;

        // The server just told us exactly how many it cleared, so subtract instead
        // of spending a request to re-read the total; the sync summary corrects
        // any drift on its next pass.
        set((state) => ({ unreadCount: Math.max(0, state.unreadCount - unreadInMatch) }));
        useMatchStore.getState().updateMatchUnreadCount(matchId, -unreadInMatch);
    },

    clearMessages: () => {
        set((state) => ({
            unreadCount: 0, lastMessage: null, activeMatchId: null,
            // Invalidates any request already in flight for the account being left.
            generation: state.generation + 1,
        }));
    },
}));
