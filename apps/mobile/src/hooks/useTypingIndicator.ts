import { useState, useRef, useEffect, useCallback } from 'react';
import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

export interface UseTypingIndicatorConfig {
    /** Channel name for the chat/conversation */
    channelName: string;
    /** Current user's ID */
    userId: string | undefined;
    /** Timeout in ms before partner typing indicator disappears. Default: 3000 */
    typingTimeout?: number;
    /** Whether the screen is currently focused */
    isFocused?: boolean;
    /** Throttle interval in ms for sending typing events. Default: 2000 */
    throttleInterval?: number;
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
const DEFAULT_THROTTLE_INTERVAL = 2000;

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
    const {
        channelName,
        userId,
        typingTimeout = DEFAULT_TYPING_TIMEOUT,
        isFocused = true,
        throttleInterval = DEFAULT_THROTTLE_INTERVAL,
    } = config;

    const [partnerTyping, setPartnerTyping] = useState(false);
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const isFocusedRef = useRef(isFocused);
    const lastTypingEventRef = useRef<number>(0);
    const channelRef = useRef<RealtimeChannel | null>(null);

    // Update ref when focus changes and clear state if blurred
    useEffect(() => {
        isFocusedRef.current = isFocused;
        if (!isFocused) {
            setPartnerTyping(false);
            if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current);
                typingTimeoutRef.current = null;
            }
        }
    }, [isFocused]);

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
        channelRef.current = channel;

        channel.on('broadcast', { event: 'typing' }, (payload) => {
            // Only process events if the screen is focused
            if (!isFocusedRef.current) return;

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
            channelRef.current = null;
            supabase.removeChannel(channel);
            if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current);
            }
        };
    }, [channelName, userId, typingTimeout]);

    /**
     * Send a typing event to the partner (throttled to reduce network traffic)
     */
    const sendTypingEvent = useCallback(() => {
        if (!channelRef.current || !userId) return;

        // Throttle typing events to reduce network traffic
        const now = Date.now();
        if (now - lastTypingEventRef.current < throttleInterval) return;
        lastTypingEventRef.current = now;

        channelRef.current.send({
            type: 'broadcast',
            event: 'typing',
            payload: { userId },
        });
    }, [userId, throttleInterval]);

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
