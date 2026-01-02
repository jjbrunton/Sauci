import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useMessageSubscription } from '@/hooks/useMessageSubscription';
import { supabase } from '@/lib/supabase';

type ThenableResult = { data?: any; error?: any; count?: any };

function createThenableQuery(result: ThenableResult) {
    const query: any = {
        select: jest.fn(() => query),
        eq: jest.fn(() => query),
        neq: jest.fn(() => query),
        is: jest.fn(() => query),
        in: jest.fn(() => query),
        order: jest.fn(() => query),
        update: jest.fn(() => query),
        then: (resolve: any, reject: any) => Promise.resolve(result).then(resolve, reject),
    };

    return query;
}

describe('useMessageSubscription', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2024-01-01T00:00:00.000Z'));
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('fetches initial messages and marks partner messages read', async () => {
        const partnerMessage = {
            id: 'm1',
            match_id: 'match1',
            user_id: 'partner',
            created_at: '2024-01-01T00:00:00.000Z',
            delivered_at: null,
            read_at: null,
        };

        const fetchQuery = createThenableQuery({ data: [partnerMessage] });
        const updateQuery = createThenableQuery({ data: null });
        const deletionsQuery = createThenableQuery({ data: [] });

        const fromMock = jest.fn((table: string) => {
            if (table === 'message_deletions') return deletionsQuery;
            if (table === 'messages') {
                // If it's the first call to messages, it's fetch, otherwise update.
                // But simplified for the test logic:
                return fetchQuery;
            }
            return createThenableQuery({ data: null });
        });

        // Use mockReturnValueOnce to handle the sequence:
        // 1. message_deletions (select)
        // 2. messages (select)
        // 3. messages (update)
        const fromMockSequence = jest.fn()
            .mockReturnValueOnce(deletionsQuery) // message_deletions select
            .mockReturnValueOnce(fetchQuery)     // messages select
            .mockReturnValueOnce(updateQuery);   // messages update

        (supabase as any).from = fromMockSequence;

        const channelMock: any = {
            on: jest.fn(() => channelMock),
            subscribe: jest.fn(() => channelMock),
        };
        (supabase as any).channel = jest.fn(() => channelMock);
        (supabase as any).removeChannel = jest.fn();

        const { result } = renderHook(() =>
            useMessageSubscription({ matchId: 'match1', userId: 'me' })
        );

        await waitFor(() => expect(result.current.loading).toBe(false));

        expect(fromMockSequence).toHaveBeenCalledWith('messages');
        expect(updateQuery.update).toHaveBeenCalledWith(
            expect.objectContaining({
                delivered_at: expect.stringMatching(/^2024-01-01T00:00:00\./),
                read_at: expect.stringMatching(/^2024-01-01T00:00:00\./),
            })
        );
        expect(updateQuery.in).toHaveBeenCalledWith('id', ['m1']);

        expect(result.current.messages[0].read_at).toMatch(/^2024-01-01T00:00:00\./);
        expect(result.current.messages[0].delivered_at).toMatch(/^2024-01-01T00:00:00\./);
    });

    it('prepends inserted message and marks it read when focused', async () => {
        const fetchQuery = createThenableQuery({ data: [] });
        const updateQuery = createThenableQuery({ data: null });

        const fromMock = jest.fn((table: string) => {
            if (table === 'messages') return updateQuery;
            return createThenableQuery({ data: null });
        });

        // First call should be fetch.
        (supabase as any).from = jest
            .fn()
            .mockReturnValueOnce(fetchQuery)
            .mockImplementation(fromMock);

        let insertHandler: ((payload: any) => Promise<void> | void) | null = null;

        const channelMock: any = {
            on: jest.fn((_type: string, filter: any, cb: any) => {
                if (filter?.event === 'INSERT') {
                    insertHandler = cb;
                }
                return channelMock;
            }),
            subscribe: jest.fn(() => channelMock),
        };

        (supabase as any).channel = jest.fn(() => channelMock);
        (supabase as any).removeChannel = jest.fn();

        const { result } = renderHook(() =>
            useMessageSubscription({ matchId: 'match1', userId: 'me' })
        );

        await waitFor(() => expect(result.current.loading).toBe(false));

        act(() => {
            result.current.isFocusedRef.current = true;
        });

        const newMessage = {
            id: 'm2',
            match_id: 'match1',
            user_id: 'partner',
            created_at: '2024-01-01T00:00:01.000Z',
            delivered_at: null,
            read_at: null,
        };

        expect(insertHandler).toBeTruthy();

        await act(async () => {
            await insertHandler?.({ new: newMessage });
        });

        expect(updateQuery.update).toHaveBeenCalledWith(
            expect.objectContaining({
                delivered_at: expect.stringMatching(/^2024-01-01T00:00:00\./),
                read_at: expect.stringMatching(/^2024-01-01T00:00:00\./),
            })
        );

        expect(result.current.messages[0].id).toBe('m2');
        expect(result.current.messages[0].read_at).toMatch(/^2024-01-01T00:00:00\./);
        expect(result.current.messages[0].delivered_at).toMatch(/^2024-01-01T00:00:00\./);
    });
});
