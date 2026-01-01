import { useState, useRef, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export interface UseTypingIndicatorConfig {
    /** Channel name for the chat/conversation */
    channelName: string;
    /** Current user's ID */
    userId: string | undefined;
    /** Timeout in ms before partner typing indicator disappears. Default: 3000 */
    typingTimeout?: number;
}

export interface UseTypingIndicatorReturn {
    /** Whether the partner is currently typing */
    partnerTyping: boolean;
    /** Call this when user types to broadcast typing event */
    sendTypingEvent: () => void;
    /** Clear the typing indicator (e.g., when message received) */
    clearTypingIndicator: () => void;
}

const DEFAULT_TYPING_TIMEOUT = 3000;

/**
 * Hook for managing typing indicator state and broadcast events.
 * Handles both sending typing events and listening for partner's typing.
 *
 * @param config - Configuration including channel name and user ID
 * @returns Typing state and event handlers
 */
export const useTypingIndicator = (
    config: UseTypingIndicatorConfig
): UseTypingIndicatorReturn => {
    const { channelName, userId, typingTimeout = DEFAULT_TYPING_TIMEOUT } = config;

    const [partnerTyping, setPartnerTyping] = useState(false);
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Clear timeout on cleanup
    useEffect(() => {
        return () => {
            if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current);
            }
        };
    }, []);

    // Subscribe to typing broadcast events
    useEffect(() => {
        if (!channelName || !userId) return;

        const channel = supabase.channel(channelName);

        channel.on('broadcast', { event: 'typing' }, (payload) => {
            if (payload.payload.userId !== userId) {
                setPartnerTyping(true);

                // Clear existing timeout
                if (typingTimeoutRef.current) {
                    clearTimeout(typingTimeoutRef.current);
                }

                // Auto-clear typing indicator after timeout
                typingTimeoutRef.current = setTimeout(() => {
                    setPartnerTyping(false);
                }, typingTimeout);
            }
        });

        channel.subscribe();

        return () => {
            supabase.removeChannel(channel);
            if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current);
            }
        };
    }, [channelName, userId, typingTimeout]);

    /**
     * Send a typing event to the partner
     */
    const sendTypingEvent = useCallback(() => {
        if (!channelName || !userId) return;

        supabase.channel(channelName).send({
            type: 'broadcast',
            event: 'typing',
            payload: { userId },
        });
    }, [channelName, userId]);

    /**
     * Manually clear the typing indicator (e.g., when a message is received)
     */
    const clearTypingIndicator = useCallback(() => {
        setPartnerTyping(false);
        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
            typingTimeoutRef.current = null;
        }
    }, []);

    return {
        partnerTyping,
        sendTypingEvent,
        clearTypingIndicator,
    };
};
