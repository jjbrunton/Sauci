import { create } from "zustand";
import { supabase } from "../lib/supabase";
import type { Database } from "@/types/supabase";
import { useAuthStore } from "./authStore";

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
    fetchUnreadCount: () => Promise<void>;
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

    fetchUnreadCount: async () => {
        const userId = useAuthStore.getState().user?.id;
        if (!userId) {
            set({ unreadCount: 0 });
            return;
        }

        const { count } = await supabase
            .from("messages")
            .select("*", { count: "exact", head: true })
            .neq("user_id", userId)
            .is("read_at", null);

        set({ unreadCount: count || 0 });
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

        await supabase
            .from("messages")
            .update({ read_at: new Date().toISOString() })
            .eq("match_id", matchId)
            .neq("user_id", userId)
            .is("read_at", null);

        // Refetch unread count
        await get().fetchUnreadCount();
    },

    clearMessages: () => {
        set({ unreadCount: 0, lastMessage: null, activeMatchId: null });
    },
}));
