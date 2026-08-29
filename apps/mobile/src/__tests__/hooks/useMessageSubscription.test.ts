import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useMessageSubscription } from '@/hooks/useMessageSubscription';
import { chatApi } from '@/lib/chatApi';

jest.mock('@/lib/chatApi', () => ({ chatApi: { listMessages: jest.fn(), markRead: jest.fn() } }));

const message = (id: string, user_id = 'partner', overrides: Record<string, unknown> = {}) => ({
    id, match_id: 'match1', user_id, content: id,
    created_at: '2026-08-27T12:00:00Z', read_at: null, ...overrides,
} as any);

const snapshot = (messages: any[], server_time = 'cursor-1') => ({ messages, removed_ids: [], server_time, complete: true });
const delta = (messages: any[], options: { removed?: string[]; server_time?: string; typing?: boolean } = {}) => ({
    messages,
    removed_ids: options.removed ?? [],
    server_time: options.server_time ?? 'cursor-2',
    complete: false,
    ...(options.typing === undefined ? {} : { typing: { typing: options.typing, expires_at: null } }),
});

const listMessages = chatApi.listMessages as jest.Mock;
const markRead = chatApi.markRead as jest.Mock;

describe('useMessageSubscription incremental polling', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers();
        listMessages.mockResolvedValue(snapshot([]));
        markRead.mockResolvedValue({ updated: 0, read_at: 'now' });
    });
    afterEach(() => jest.useRealTimers());

    const mount = (config: Partial<Parameters<typeof useMessageSubscription>[0]> = {}) =>
        renderHook(() => useMessageSubscription({ matchId: 'match1', userId: 'me', pollInterval: 500, ...config }));

    it('fails closed without both match and authenticated user', () => {
        const { rerender } = renderHook<ReturnType<typeof useMessageSubscription>, { matchId: string | undefined; userId: string | undefined }>(
            ({ matchId, userId }) => useMessageSubscription({ matchId, userId }),
            { initialProps: { matchId: undefined as string | undefined, userId: 'me' as string | undefined } },
        );
        expect(listMessages).not.toHaveBeenCalled();
        rerender({ matchId: 'match1', userId: undefined });
        expect(listMessages).not.toHaveBeenCalled();
    });

    it('loads a snapshot first, then requests only changes since the server cursor', async () => {
        listMessages.mockResolvedValueOnce(snapshot([message('m1')], 'cursor-1'));
        const { result } = mount();
        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(listMessages).toHaveBeenNthCalledWith(1, 'match1', { typing: true });

        await act(async () => { jest.advanceTimersByTime(500); });
        await waitFor(() => expect(listMessages).toHaveBeenCalledTimes(2));
        expect(listMessages).toHaveBeenNthCalledWith(2, 'match1', { since: 'cursor-1', typing: true });
    });

    it('keeps cached messages, and their identity, when a delta carries nothing', async () => {
        listMessages.mockResolvedValueOnce(snapshot([message('m1', 'partner', { read_at: 'seen' })]));
        listMessages.mockResolvedValue(delta([]));
        const { result } = mount();
        await waitFor(() => expect(result.current.messages).toHaveLength(1));
        const cached = result.current.messages;

        await act(async () => { jest.advanceTimersByTime(500); });
        await waitFor(() => expect(listMessages).toHaveBeenCalledTimes(2));
        expect(result.current.messages).toBe(cached);
        expect(result.current.loading).toBe(false);
    });

    it('merges delta rows by id, applies self-deletions, and keeps newest first', async () => {
        listMessages.mockResolvedValueOnce(snapshot([
            message('m2', 'me', { created_at: '2026-08-27T12:00:02Z' }),
            message('m1', 'partner', { created_at: '2026-08-27T12:00:01Z', read_at: 'seen' }),
        ]));
        listMessages.mockResolvedValueOnce(delta([
            message('m3', 'partner', { created_at: '2026-08-27T12:00:03Z', read_at: 'seen' }),
            message('m1', 'partner', { created_at: '2026-08-27T12:00:01Z', read_at: 'seen', deleted_at: 'gone' }),
        ], { removed: ['m2'] }));
        const { result } = mount();
        await waitFor(() => expect(result.current.messages).toHaveLength(2));

        await act(async () => { jest.advanceTimersByTime(500); });
        await waitFor(() => expect(result.current.messages).toHaveLength(2));
        expect(result.current.messages.map(m => m.id)).toEqual(['m3', 'm1']);
        expect(result.current.messages[1]?.deleted_at).toBe('gone');
    });

    it('marks read only when the response holds an unread partner message', async () => {
        listMessages.mockResolvedValueOnce(snapshot([message('m1', 'partner')]));
        listMessages.mockResolvedValueOnce(delta([message('m2', 'me')]));
        listMessages.mockResolvedValueOnce(delta([message('m1', 'partner', { read_at: 'seen' })]));
        const { result } = mount();
        await waitFor(() => expect(markRead).toHaveBeenCalledTimes(1));

        await act(async () => { jest.advanceTimersByTime(500); });
        await waitFor(() => expect(listMessages).toHaveBeenCalledTimes(2));
        await act(async () => { jest.advanceTimersByTime(500); });
        await waitFor(() => expect(listMessages).toHaveBeenCalledTimes(3));
        expect(markRead).toHaveBeenCalledTimes(1);
        expect(result.current.messages).toHaveLength(2);
    });

    it('issues no request at all while the chat is not focused', async () => {
        const { rerender } = renderHook<ReturnType<typeof useMessageSubscription>, { focused: boolean }>(
            ({ focused }) => useMessageSubscription({ matchId: 'match1', userId: 'me', pollInterval: 500, isFocused: focused }),
            { initialProps: { focused: false } },
        );
        await act(async () => { jest.advanceTimersByTime(2_000); });
        expect(listMessages).not.toHaveBeenCalled();
        expect(markRead).not.toHaveBeenCalled();

        rerender({ focused: true });
        await waitFor(() => expect(listMessages).toHaveBeenCalledTimes(1));

        rerender({ focused: false });
        const callsAtBlur = listMessages.mock.calls.length;
        await act(async () => { jest.advanceTimersByTime(2_000); });
        expect(listMessages).toHaveBeenCalledTimes(callsAtBlur);
    });

    it('reports partner arrivals once, and never for the initial load or own messages', async () => {
        const onNewMessage = jest.fn();
        listMessages.mockResolvedValueOnce(snapshot([message('m1', 'partner', { read_at: 'seen' })]));
        listMessages.mockResolvedValueOnce(delta([message('mine', 'me')]));
        listMessages.mockResolvedValueOnce(delta([message('m2', 'partner')]));
        listMessages.mockResolvedValueOnce(delta([message('m2', 'partner', { read_at: 'seen' })]));
        const { result } = mount({ onNewMessage });
        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(onNewMessage).not.toHaveBeenCalled();

        for (const expected of [2, 3, 4]) {
            await act(async () => { jest.advanceTimersByTime(500); });
            await waitFor(() => expect(listMessages).toHaveBeenCalledTimes(expected));
        }
        expect(onNewMessage).toHaveBeenCalledTimes(1);
    });

    it('reads partner typing state out of the message response', async () => {
        listMessages.mockResolvedValueOnce({ ...snapshot([]), typing: { typing: true, expires_at: 'later' } });
        const { result } = mount();
        await waitFor(() => expect(result.current.partnerTyping).toBe(true));

        listMessages.mockResolvedValueOnce(delta([], { typing: false }));
        await act(async () => { jest.advanceTimersByTime(500); });
        await waitFor(() => expect(result.current.partnerTyping).toBe(false));
    });

    it('surfaces loading completion and preserves a usable empty state after an API error', async () => {
        listMessages.mockRejectedValueOnce(new Error('forbidden'));
        const { result } = mount();
        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(result.current.messages).toEqual([]);
    });

    it('prevents overlapping polls and stops on unmount', async () => {
        let resolveFirst!: (value: unknown) => void;
        listMessages.mockImplementationOnce(() => new Promise(resolve => { resolveFirst = resolve; }));
        const { unmount } = mount();
        expect(listMessages).toHaveBeenCalledTimes(1);
        await act(async () => { jest.advanceTimersByTime(1_500); });
        expect(listMessages).toHaveBeenCalledTimes(1);

        await act(async () => { resolveFirst(snapshot([])); });
        unmount();
        await act(async () => { jest.advanceTimersByTime(2_000); });
        expect(listMessages).toHaveBeenCalledTimes(1);
    });

    it('restarts immediately, and without a stale cursor, for a different match', async () => {
        listMessages.mockResolvedValue(snapshot([message('m1')], 'cursor-1'));
        const { result, rerender } = renderHook<ReturnType<typeof useMessageSubscription>, { matchId: string }>(
            ({ matchId }) => useMessageSubscription({ matchId, userId: 'me', pollInterval: 500 }),
            { initialProps: { matchId: 'match1' } },
        );
        await waitFor(() => expect(result.current.messages).toHaveLength(1));

        rerender({ matchId: 'match2' });
        await waitFor(() => expect(listMessages).toHaveBeenCalledTimes(2));
        expect(listMessages).toHaveBeenNthCalledWith(2, 'match2', { typing: true });
    });

    it('supports optimistic external updates', async () => {
        const { result } = mount();
        await waitFor(() => expect(result.current.loading).toBe(false));
        act(() => result.current.setMessages([message('optimistic', 'me')]));
        expect(result.current.messages[0]?.id).toBe('optimistic');
    });
});
