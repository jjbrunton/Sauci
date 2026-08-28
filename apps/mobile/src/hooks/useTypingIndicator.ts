import { useCallback, useEffect, useRef, useState } from 'react';
import { chatApi } from '../lib/chatApi';

export interface UseTypingIndicatorConfig {
    channelName: string;
    userId: string | undefined;
    matchId?: string;
    typingTimeout?: number;
    isFocused?: boolean;
    throttleInterval?: number;
    pollInterval?: number;
}

export interface UseTypingIndicatorReturn {
    partnerTyping: boolean;
    sendTypingEvent: () => void;
    clearTypingIndicator: () => void;
}

export const useTypingIndicator = ({ channelName, userId, matchId = channelName.replace(/^chat:/, ''), isFocused = true, throttleInterval = 2_000, pollInterval = 1_500 }: UseTypingIndicatorConfig): UseTypingIndicatorReturn => {
    const [partnerTyping, setPartnerTyping] = useState(false);
    const lastTypingEventRef = useRef(0);

    useEffect(() => {
        if (!matchId || !userId || !isFocused) {
            setPartnerTyping(false);
            return;
        }
        let active = true;
        const poll = async () => {
            try {
                const state = await chatApi.getTyping(matchId);
                if (active) setPartnerTyping(state.typing);
            } catch {
                if (active) setPartnerTyping(false);
            }
        };
        void poll();
        const timer = setInterval(() => void poll(), pollInterval);
        return () => {
            active = false;
            clearInterval(timer);
        };
    }, [matchId, userId, isFocused, pollInterval]);

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
