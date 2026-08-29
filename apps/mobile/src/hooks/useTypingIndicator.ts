import { useCallback, useEffect, useRef, useState } from 'react';
import { chatApi } from '../lib/chatApi';
import { usePolling } from './usePolling';

export interface UseTypingIndicatorConfig {
    channelName: string;
    userId: string | undefined;
    matchId?: string;
    typingTimeout?: number;
    isFocused?: boolean;
    throttleInterval?: number;
    pollInterval?: number;
    /**
     * Typing state already known from another request. When supplied this hook
     * stops polling for it, which is how the chat screen gets typing state for
     * free out of the message poll instead of a second request every interval.
     */
    externalTyping?: boolean | undefined;
}

export interface UseTypingIndicatorReturn {
    partnerTyping: boolean;
    sendTypingEvent: () => void;
    clearTypingIndicator: () => void;
}

export const useTypingIndicator = ({
    channelName,
    userId,
    matchId = channelName.replace(/^chat:/, ''),
    isFocused = true,
    throttleInterval = 2_000,
    pollInterval = 1_500,
    externalTyping,
}: UseTypingIndicatorConfig): UseTypingIndicatorReturn => {
    const [partnerTyping, setPartnerTyping] = useState(false);
    const lastTypingEventRef = useRef(0);
    const external = externalTyping !== undefined;

    useEffect(() => {
        if (externalTyping !== undefined) setPartnerTyping(externalTyping);
    }, [externalTyping]);

    // Losing the subject stops both sources of truth, so drop the stale indicator
    // rather than leaving the partner typing forever in a chat nobody is watching.
    useEffect(() => {
        if (!matchId || !userId || !isFocused) setPartnerTyping(false);
    }, [matchId, userId, isFocused]);

    const poll = useCallback(async () => {
        try {
            const state = await chatApi.getTyping(matchId);
            setPartnerTyping(state.typing);
        } catch {
            setPartnerTyping(false);
        }
    }, [matchId]);

    usePolling(poll, {
        intervalMs: pollInterval,
        enabled: !external && Boolean(matchId) && Boolean(userId) && isFocused,
        resetKey: matchId,
    });

    const sendTypingEvent = useCallback(() => {
        if (!matchId || !userId) return;
        const now = Date.now();
        if (now - lastTypingEventRef.current < throttleInterval) return;
        lastTypingEventRef.current = now;
        void chatApi.setTyping(matchId);
    }, [matchId, userId, throttleInterval]);

    const clearTypingIndicator = useCallback(() => setPartnerTyping(false), []);
    return { partnerTyping, sendTypingEvent, clearTypingIndicator };
};
