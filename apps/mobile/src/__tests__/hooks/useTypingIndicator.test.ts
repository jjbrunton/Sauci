import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useTypingIndicator } from '@/hooks/useTypingIndicator';
import { chatApi } from '@/lib/chatApi';

jest.mock('@/lib/chatApi', () => ({ chatApi: { getTyping: jest.fn(), setTyping: jest.fn() } }));

describe('useTypingIndicator API polling', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2026-08-27T12:00:00Z'));
        (chatApi.getTyping as jest.Mock).mockResolvedValue({ typing: false, expires_at: null });
        (chatApi.setTyping as jest.Mock).mockResolvedValue({ typing: true });
    });
    afterEach(() => jest.useRealTimers());

    it('derives the match id and polls partner typing state', async () => {
        (chatApi.getTyping as jest.Mock).mockResolvedValueOnce({ typing: true, expires_at: '2026-08-27T12:00:04Z' });
        const { result } = renderHook(() => useTypingIndicator({ channelName: 'chat:match1', userId: 'me' }));
        await waitFor(() => expect(result.current.partnerTyping).toBe(true));
        expect(chatApi.getTyping).toHaveBeenCalledWith('match1');
    });

    it('clears typing when the server state expires on a later poll', async () => {
        (chatApi.getTyping as jest.Mock)
            .mockResolvedValueOnce({ typing: true, expires_at: 'soon' })
            .mockResolvedValueOnce({ typing: false, expires_at: null });
        const { result } = renderHook(() => useTypingIndicator({ channelName: 'unused', matchId: 'match1', userId: 'me', pollInterval: 500 }));
        await waitFor(() => expect(result.current.partnerTyping).toBe(true));
        await act(async () => { jest.advanceTimersByTime(500); await Promise.resolve(); });
        await waitFor(() => expect(result.current.partnerTyping).toBe(false));
    });

    it('fails closed on polling errors', async () => {
        (chatApi.getTyping as jest.Mock).mockRejectedValueOnce(new Error('network'));
        const { result } = renderHook(() => useTypingIndicator({ channelName: 'chat:match1', userId: 'me' }));
        await act(async () => { await Promise.resolve(); });
        expect(result.current.partnerTyping).toBe(false);
    });

    it('does not poll without a user or while unfocused and clears existing state on blur', async () => {
        const { result, rerender } = renderHook<ReturnType<typeof useTypingIndicator>, { focused: boolean; userId: string | undefined }>(
            ({ focused, userId }) => useTypingIndicator({ channelName: 'chat:match1', userId, isFocused: focused }),
            { initialProps: { focused: true, userId: 'me' as string | undefined } },
        );
        await act(async () => { await Promise.resolve(); });
        act(() => result.current.clearTypingIndicator());
        rerender({ focused: false, userId: 'me' });
        expect(result.current.partnerTyping).toBe(false);
        const callsAtBlur = (chatApi.getTyping as jest.Mock).mock.calls.length;
        act(() => { jest.advanceTimersByTime(3_000); });
        expect(chatApi.getTyping).toHaveBeenCalledTimes(callsAtBlur);
        rerender({ focused: true, userId: undefined });
        expect(chatApi.getTyping).toHaveBeenCalledTimes(callsAtBlur);
    });

    it('throttles writes and allows another event after the interval', () => {
        const { result } = renderHook(() => useTypingIndicator({ channelName: 'chat:match1', userId: 'me', throttleInterval: 2_000 }));
        act(() => { result.current.sendTypingEvent(); result.current.sendTypingEvent(); });
        expect(chatApi.setTyping).toHaveBeenCalledTimes(1);
        act(() => { jest.advanceTimersByTime(2_000); result.current.sendTypingEvent(); });
        expect(chatApi.setTyping).toHaveBeenCalledTimes(2);
    });

    it('does not write typing state without an authenticated user', () => {
        const { result } = renderHook(() => useTypingIndicator({ channelName: 'chat:match1', userId: undefined }));
        act(() => result.current.sendTypingEvent());
        expect(chatApi.setTyping).not.toHaveBeenCalled();
    });

    it('clears polling on unmount', async () => {
        const { unmount } = renderHook(() => useTypingIndicator({ channelName: 'chat:match1', userId: 'me', pollInterval: 500 }));
        await act(async () => { await Promise.resolve(); });
        unmount();
        const calls = (chatApi.getTyping as jest.Mock).mock.calls.length;
        act(() => { jest.advanceTimersByTime(2_000); });
        expect(chatApi.getTyping).toHaveBeenCalledTimes(calls);
    });
});
