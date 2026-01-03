import { useMatchStore } from '@/store/matchStore';
import { useAuthStore } from '@/store/authStore';
import { supabase } from '@/lib/supabase';

function createThenableQuery(result: any) {
    const query: any = {
        select: jest.fn(() => query),
        eq: jest.fn(() => query),
        neq: jest.fn(() => query),
        is: jest.fn(() => query),
        in: jest.fn(() => query),
        order: jest.fn(() => query),
        range: jest.fn(() => query),
        then: (resolve: any, reject: any) => Promise.resolve(result).then(resolve, reject),
    };
    return query;
}

describe('matchStore', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        useMatchStore.setState({ matches: [], newMatchesCount: 0, isLoading: false, error: null } as any);
        useAuthStore.setState({ user: { id: 'me', couple_id: 'couple1' } } as any);
    });

    it('sorts matches with unread messages first', async () => {
        const matches = [
            { id: 'a', question_id: 'q1', created_at: '2024-01-02T00:00:00.000Z', is_new: true },
            { id: 'b', question_id: 'q2', created_at: '2024-01-03T00:00:00.000Z', is_new: false },
        ];

        const unreadMessages = [{ match_id: 'a' }, { match_id: 'a' }];

        const matchesQuery = createThenableQuery({ data: matches });
        const responsesQuery = createThenableQuery({ data: [] });
        const unreadQuery = createThenableQuery({ data: unreadMessages, error: null });

        (supabase.from as jest.Mock)
            .mockReturnValueOnce(matchesQuery) // matches
            .mockReturnValueOnce(responsesQuery) // responses
            .mockReturnValueOnce(unreadQuery); // messages

        await useMatchStore.getState().fetchMatches();

        const state = useMatchStore.getState();
        expect(state.matches[0].id).toBe('a');
        expect(state.newMatchesCount).toBe(1);
    });
});
