import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { Database } from '../types/supabase';

type Message = Database['public']['Tables']['messages']['Row'];

export interface UseMessageSubscriptionConfig {
    /** Match ID to subscribe to */
    matchId: string | undefined;
    /** Current user's ID */
    userId: string | undefined;
    /** Callback when a new message is received (e.g., to clear typing indicator) */
    onNewMessage?: () => void;
}

export interface UseMessageSubscriptionReturn {
    /** Array of messages, sorted newest first (filtered by user's deletions) */
    messages: Message[];
    /** Set messages externally (e.g., for optimistic updates) */
    setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
    /** Whether the initial fetch is in progress */
    loading: boolean;
    /** Ref to track if screen is focused (for read receipts) */
    isFocusedRef: React.MutableRefObject<boolean>;
}

/**
 * Hook for managing message subscriptions and real-time updates.
 * Handles fetching messages, subscribing to new messages, and managing read receipts.
 *
 * @param config - Configuration including match ID and user ID
 * @returns Message state and subscription utilities
 */
export const useMessageSubscription = (
    config: UseMessageSubscriptionConfig
): UseMessageSubscriptionReturn => {
    const { matchId, userId, onNewMessage } = config;

    const [allMessages, setAllMessages] = useState<Message[]>([]);
    const [deletedMessageIds, setDeletedMessageIds] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(true);
    const isFocusedRef = useRef(false);

    // Filter out messages that the user has deleted for themselves
    const messages = useMemo(() => {
        return allMessages.filter(m => !deletedMessageIds.has(m.id));
    }, [allMessages, deletedMessageIds]);

    // Wrapper to update allMessages (for external use like optimistic updates)
    const setMessages: React.Dispatch<React.SetStateAction<Message[]>> = useCallback((updater) => {
        setAllMessages(updater);
    }, []);

    // Fetch user's deleted message IDs
    useEffect(() => {
        if (!userId) return;

        const fetchDeletions = async () => {
            const { data } = await supabase
                .from('message_deletions')
                .select('message_id')
                .eq('user_id', userId);

            if (data) {
                setDeletedMessageIds(new Set(data.map(d => d.message_id)));
            }
        };

        fetchDeletions();
    }, [userId]);

    // Subscribe to user's deletions for real-time sync across devices
    useEffect(() => {
        if (!userId) return;

        const channel = supabase
            .channel(`deletions:${userId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'message_deletions',
                    filter: `user_id=eq.${userId}`,
                },
                (payload) => {
                    const deletion = payload.new as { message_id: string };
                    setDeletedMessageIds(prev => new Set([...prev, deletion.message_id]));
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [userId]);

    // Fetch messages and mark as read
    useEffect(() => {
        if (!matchId || !userId) {
            setLoading(false);
            return;
        }

        const fetchMessagesAndMarkRead = async () => {
            setLoading(true);

            const { data } = await supabase
                .from('messages')
                .select('*')
                .eq('match_id', matchId)
                .order('created_at', { ascending: false });

            if (data) {
                setAllMessages(data);

                const now = new Date().toISOString();

                // Get partner messages that need to be marked as delivered or read
                const partnerMessages = data.filter(m => m.user_id !== userId);
                const undeliveredIds = partnerMessages.filter(m => !m.delivered_at).map(m => m.id);
                const unreadIds = partnerMessages.filter(m => !m.read_at).map(m => m.id);

                // Mark as both delivered and read (since user is viewing the chat)
                if (unreadIds.length > 0) {
                    await supabase
                        .from('messages')
                        .update({ delivered_at: now, read_at: now })
                        .in('id', unreadIds);

                    setAllMessages(prev => prev.map(m =>
                        unreadIds.includes(m.id) ? { ...m, delivered_at: now, read_at: now } : m
                    ));
                } else if (undeliveredIds.length > 0) {
                    // Only mark as delivered if already read but not delivered (edge case)
                    await supabase
                        .from('messages')
                        .update({ delivered_at: now })
                        .in('id', undeliveredIds);

                    setAllMessages(prev => prev.map(m =>
                        undeliveredIds.includes(m.id) ? { ...m, delivered_at: now } : m
                    ));
                }
            }

            setLoading(false);
        };

        fetchMessagesAndMarkRead();
    }, [matchId, userId]);

    // Subscribe to real-time message updates
    useEffect(() => {
        if (!matchId || !userId) return;

        const channel = supabase
            .channel(`messages:${matchId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'messages',
                    filter: `match_id=eq.${matchId}`,
                },
                async (payload) => {
                    const newMessage = payload.new as Message;
                    const now = new Date().toISOString();

                    if (newMessage.user_id !== userId && isFocusedRef.current) {
                        // Mark as both delivered and read (only if screen is focused)
                        await supabase
                            .from('messages')
                            .update({ delivered_at: now, read_at: now })
                            .eq('id', newMessage.id);
                        newMessage.delivered_at = now;
                        newMessage.read_at = now;
                    }

                    setAllMessages(prev => [newMessage, ...prev]);
                    onNewMessage?.();
                }
            )
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'messages',
                    filter: `match_id=eq.${matchId}`,
                },
                (payload) => {
                    const updatedMessage = payload.new as Message;
                    setAllMessages(prev =>
                        prev.map(m => m.id === updatedMessage.id ? updatedMessage : m)
                    );
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [matchId, userId, onNewMessage]);

    return {
        messages,
        setMessages,
        loading,
        isFocusedRef,
    };
};
