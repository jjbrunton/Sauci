import { useCallback, useEffect, useRef, useState } from 'react';
import { chatApi } from '../lib/chatApi';
import type { Message } from '../features/chat/types';

export interface UseMessageSubscriptionConfig {
    matchId: string | undefined;
    userId: string | undefined;
    onNewMessage?: () => void;
    pollInterval?: number;
}

export interface UseMessageSubscriptionReturn {
    messages: Message[];
    setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
    loading: boolean;
    isFocusedRef: React.MutableRefObject<boolean>;
}

/** Authenticated API polling replaces Supabase Realtime for self-hosted chat. */
export const useMessageSubscription = ({ matchId, userId, onNewMessage, pollInterval = 1_500 }: UseMessageSubscriptionConfig): UseMessageSubscriptionReturn => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [loading, setLoading] = useState(true);
    const isFocusedRef = useRef(false);
    const knownIdsRef = useRef<Set<string>>(new Set());
    const fetchingRef = useRef(false);

    const refresh = useCallback(async (initial = false) => {
        if (!matchId || !userId || fetchingRef.current) return;
        fetchingRef.current = true;
        try {
            const response = await chatApi.listMessages(matchId);
            const partnerArrived = !initial && response.messages.some(message => message.user_id !== userId && !knownIdsRef.current.has(message.id));
            knownIdsRef.current = new Set(response.messages.map(message => message.id));
            setMessages(response.messages);
            if (isFocusedRef.current) await chatApi.markRead(matchId);
            if (partnerArrived) onNewMessage?.();
        } finally {
            fetchingRef.current = false;
            if (initial) setLoading(false);
        }
    }, [matchId, userId, onNewMessage]);

    useEffect(() => {
        if (!matchId || !userId) {
            setMessages([]);
            setLoading(false);
            return;
        }
        setLoading(true);
        knownIdsRef.current = new Set();
        void refresh(true).catch(() => undefined);
        const timer = setInterval(() => void refresh(false).catch(() => undefined), pollInterval);
        return () => clearInterval(timer);
    }, [matchId, userId, pollInterval, refresh]);

    return { messages, setMessages, loading, isFocusedRef };
};
