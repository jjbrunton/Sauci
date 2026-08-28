import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useMessageSubscription } from '@/hooks/useMessageSubscription';
import { chatApi } from '@/lib/chatApi';

jest.mock('@/lib/chatApi', () => ({ chatApi: { listMessages: jest.fn(), markRead: jest.fn() } }));

const message = (id: string, user_id = 'partner') => ({ id, match_id: 'match1', user_id, content: id } as any);

describe('useMessageSubscription API polling', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers();
        (chatApi.listMessages as jest.Mock).mockResolvedValue({ messages: [] });
        (chatApi.markRead as jest.Mock).mockResolvedValue({ updated: 0, read_at: 'now' });
    });
    afterEach(() => jest.useRealTimers());

    it('fails closed without both a match and authenticated user', async () => {
        const { result, rerender } = renderHook<ReturnType<typeof useMessageSubscription>, { matchId: string | undefined; userId: string | undefined }>(
            ({ matchId, userId }) => useMessageSubscription({ matchId, userId }),
            { initialProps: { matchId: undefined as string | undefined, userId: 'me' as string | undefined } },
        );
        expect(result.current.loading).toBe(false);
        expect(chatApi.listMessages).not.toHaveBeenCalled();
        rerender({ matchId: 'match1', userId: undefined });
        expect(chatApi.listMessages).not.toHaveBeenCalled();
    });

    it('loads initial messages without treating them as newly arrived', async () => {
        const onNewMessage = jest.fn();
        (chatApi.listMessages as jest.Mock).mockResolvedValue({ messages: [message('m1')] });
        const { result } = renderHook(() => useMessageSubscription({ matchId: 'match1', userId: 'me', onNewMessage }));
        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(result.current.messages).toEqual([message('m1')]);
        expect(onNewMessage).not.toHaveBeenCalled();
        expect(chatApi.markRead).not.toHaveBeenCalled();
    });

    it('refreshes on the polling interval, marks focused messages read, and reports new partner messages', async () => {
        const onNewMessage = jest.fn();
        (chatApi.listMessages as jest.Mock)
            .mockResolvedValueOnce({ messages: [message('m1')] })
            .mockResolvedValueOnce({ messages: [message('m2'), message('m1')] });
        const { result } = renderHook(() => useMessageSubscription({ matchId: 'match1', userId: 'me', onNewMessage, pollInterval: 500 }));
        await waitFor(() => expect(result.current.loading).toBe(false));
        act(() => { result.current.isFocusedRef.current = true; });
        await act(async () => { jest.advanceTimersByTime(500); await Promise.resolve(); });
        await waitFor(() => expect(result.current.messages[0]?.id).toBe('m2'));
        expect(chatApi.markRead).toHaveBeenCalledWith('match1');
        expect(onNewMessage).toHaveBeenCalledTimes(1);
    });

    it('does not notify for the current user own newly polled message', async () => {
        const onNewMessage = jest.fn();
        (chatApi.listMessages as jest.Mock)
            .mockResolvedValueOnce({ messages: [] })
            .mockResolvedValueOnce({ messages: [message('mine', 'me')] });
        const { result } = renderHook(() => useMessageSubscription({ matchId: 'match1', userId: 'me', onNewMessage, pollInterval: 500 }));
        await waitFor(() => expect(result.current.loading).toBe(false));
        await act(async () => { jest.advanceTimersByTime(500); await Promise.resolve(); });
        expect(onNewMessage).not.toHaveBeenCalled();
    });

    it('surfaces loading completion and preserves a usable empty state after an API error', async () => {
        (chatApi.listMessages as jest.Mock).mockRejectedValueOnce(new Error('forbidden'));
        const { result } = renderHook(() => useMessageSubscription({ matchId: 'match1', userId: 'me' }));
        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(result.current.messages).toEqual([]);
    });

    it('prevents overlapping polls and clears the interval on unmount', async () => {
        let resolveFirst!: (value: { messages: any[] }) => void;
        (chatApi.listMessages as jest.Mock).mockImplementationOnce(() => new Promise(resolve => { resolveFirst = resolve; }));
        const { unmount } = renderHook(() => useMessageSubscription({ matchId: 'match1', userId: 'me', pollInterval: 500 }));
        expect(chatApi.listMessages).toHaveBeenCalledTimes(1);
        act(() => { jest.advanceTimersByTime(1_500); });
        expect(chatApi.listMessages).toHaveBeenCalledTimes(1);
        await act(async () => resolveFirst({ messages: [] }));
        unmount();
        act(() => { jest.advanceTimersByTime(2_000); });
        expect(chatApi.listMessages).toHaveBeenCalledTimes(1);
    });

    it('supports optimistic external updates', async () => {
        const { result } = renderHook(() => useMessageSubscription({ matchId: 'match1', userId: 'me' }));
        await waitFor(() => expect(result.current.loading).toBe(false));
        act(() => result.current.setMessages([message('optimistic', 'me')]));
        expect(result.current.messages[0]?.id).toBe('optimistic');
    });
});
