import { renderHook, act } from '@testing-library/react-native';
import { useTypingIndicator } from '@/hooks/useTypingIndicator';
import { supabase } from '@/lib/supabase';

describe('useTypingIndicator', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        jest.clearAllMocks();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('toggles partnerTyping on broadcast and auto-clears', async () => {
        let broadcastHandler: ((payload: any) => void) | null = null;

        const channelMock: any = {
            on: jest.fn((_type: string, _filter: any, cb: any) => {
                broadcastHandler = cb;
                return channelMock;
            }),
            subscribe: jest.fn(() => channelMock),
        };

        (supabase as any).channel = jest.fn(() => channelMock);
        (supabase as any).removeChannel = jest.fn();

        const { result } = renderHook(() =>
            useTypingIndicator({
                channelName: 'typing:test',
                userId: 'me',
                typingTimeout: 3000,
            })
        );

        expect(result.current.partnerTyping).toBe(false);
        expect(broadcastHandler).toBeTruthy();

        act(() => {
            broadcastHandler?.({ payload: { userId: 'partner' } });
        });

        expect(result.current.partnerTyping).toBe(true);

        act(() => {
            jest.advanceTimersByTime(3000);
        });

        expect(result.current.partnerTyping).toBe(false);
    });

    it('sends typing broadcast for current user', () => {
        const send = jest.fn();
        const channelMock: any = {
            on: jest.fn(() => channelMock),
            subscribe: jest.fn(() => channelMock),
            send,
        };

        (supabase as any).channel = jest.fn(() => channelMock);
        (supabase as any).removeChannel = jest.fn();

        const { result } = renderHook(() =>
            useTypingIndicator({ channelName: 'typing:test', userId: 'me' })
        );

        act(() => {
            result.current.sendTypingEvent();
        });

        expect(send).toHaveBeenCalledWith({
            type: 'broadcast',
            event: 'typing',
            payload: { userId: 'me' },
        });
    });
});
