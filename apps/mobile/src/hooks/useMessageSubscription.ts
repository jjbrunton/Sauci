import { useCallback, useEffect, useRef, useState } from 'react';
import { chatApi, type MessagesPage } from '../lib/chatApi';
import { usePolling } from './usePolling';
import type { Message } from '../features/chat/types';

export interface UseMessageSubscriptionConfig {
    matchId: string | undefined;
    userId: string | undefined;
    onNewMessage?: () => void;
    pollInterval?: number;
    /** Whether the chat is on screen. Polling and read receipts stop when it is not. */
    isFocused?: boolean;
}

export interface UseMessageSubscriptionReturn {
    messages: Message[];
    setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
    loading: boolean;
    /** Partner typing state folded into the message poll; undefined until the server reports it. */
    partnerTyping: boolean | undefined;
    /** Fetches the next delta now, e.g. straight after sending. */
    refresh: () => Promise<void>;
}

const timeOf = (message: Message): number => {
    const parsed = message.created_at ? Date.parse(message.created_at) : Number.NaN;
    return Number.isNaN(parsed) ? 0 : parsed;
};

/** Newest first, matching the order the API returns a snapshot in. */
const byNewest = (a: Message, b: Message): number => {
    const delta = timeOf(b) - timeOf(a);
    if (delta !== 0) return delta;
    return a.id < b.id ? 1 : a.id > b.id ? -1 : 0;
};

/**
 * Returns the previous array unchanged when a delta carries nothing, so an idle
 * poll re-renders neither this hook's consumers nor the message list.
 */
export const mergeMessagePage = (previous: Message[], page: MessagesPage): Message[] => {
    if (page.complete !== false) return page.messages;
    const removed = page.removed_ids ?? [];
    if (page.messages.length === 0 && removed.length === 0) return previous;

    const byId = new Map(previous.map(message => [message.id, message]));
    for (const message of page.messages) byId.set(message.id, message);
    for (const id of removed) byId.delete(id);
    return [...byId.values()].sort(byNewest);
};

/**
 * Authenticated API polling replaces Supabase Realtime for self-hosted chat.
 *
 * Each poll asks only for what changed since the cursor the server issued last
 * time, so an idle conversation costs an all-but-empty response instead of the
 * five hundred messages the screen already has. Read receipts are written only
 * when the response actually contains an unread message from the partner, which
 * on an idle chat is never.
 */
export const useMessageSubscription = ({
    matchId,
    userId,
    onNewMessage,
    pollInterval = 2_000,
    isFocused = true,
}: UseMessageSubscriptionConfig): UseMessageSubscriptionReturn => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [loading, setLoading] = useState(Boolean(matchId && userId));
    const [partnerTyping, setPartnerTyping] = useState<boolean | undefined>(undefined);
    const sinceRef = useRef<string | null>(null);
    const knownIdsRef = useRef<Set<string>>(new Set());
    const loadingRef = useRef(true);
    const notifyRef = useRef(onNewMessage);
    notifyRef.current = onNewMessage;

    // A different conversation shares none of this one's state, and the poll below
    // restarts on the same key so the new one loads immediately.
    useEffect(() => {
        sinceRef.current = null;
        knownIdsRef.current = new Set();
        loadingRef.current = Boolean(matchId && userId);
        setMessages([]);
        setPartnerTyping(undefined);
        setLoading(loadingRef.current);
    }, [matchId, userId]);

    const refresh = useCallback(async () => {
        if (!matchId || !userId) return;
        const since = sinceRef.current;
        try {
            const page = await chatApi.listMessages(matchId, { ...(since ? { since } : {}), typing: true });
            // Without a cursor the server cannot answer with deltas, so keep asking
            // for snapshots rather than silently freezing on a stale page.
            sinceRef.current = page.server_time ?? null;
            if (page.typing) setPartnerTyping(page.typing.typing);

            const arrivals = page.messages.filter(message => message.user_id !== userId && !knownIdsRef.current.has(message.id));
            for (const message of page.messages) knownIdsRef.current.add(message.id);
            for (const id of page.removed_ids ?? []) knownIdsRef.current.delete(id);
            setMessages(previous => mergeMessagePage(previous, page));

            if (isFocused && page.messages.some(message => message.user_id !== userId && !message.read_at)) {
                await chatApi.markRead(matchId);
            }
            if (!loadingRef.current && arrivals.length > 0) notifyRef.current?.();
        } finally {
            if (loadingRef.current) {
                loadingRef.current = false;
                setLoading(false);
            }
        }
    }, [matchId, userId, isFocused]);

    usePolling(refresh, {
        intervalMs: pollInterval,
        enabled: Boolean(matchId && userId && isFocused),
        resetKey: `${matchId ?? ''}:${userId ?? ''}`,
    });

    return { messages, setMessages, loading, partnerTyping, refresh };
};
