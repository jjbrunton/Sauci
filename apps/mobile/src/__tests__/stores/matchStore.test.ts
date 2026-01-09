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
        update: jest.fn(() => query),
        insert: jest.fn(() => query),
        delete: jest.fn(() => query),
        then: (resolve: any, reject: any) => Promise.resolve(result).then(resolve, reject),
    };
    return query;
}

describe('matchStore', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        useMatchStore.setState({
            matches: [],
            newMatchesCount: 0,
            totalCount: null,
            isLoading: false,
            isLoadingMore: false,
            page: 0,
            hasMore: true,
            error: null,
            archivedMatches: [],
            archivedMatchIds: new Set<string>(),
            showArchived: false,
            isLoadingArchived: false,
        });
        useAuthStore.setState({ user: { id: 'me', couple_id: 'couple1' } } as any);
    });

    describe('fetchMatches', () => {
        it('sorts matches with unread messages first', async () => {
            const matches = [
                { id: 'a', question_id: 'q1', created_at: '2024-01-02T00:00:00.000Z', is_new: true },
                { id: 'b', question_id: 'q2', created_at: '2024-01-03T00:00:00.000Z', is_new: false },
            ];

            const unreadMessages = [{ match_id: 'a' }, { match_id: 'a' }];

            const archivesQuery = createThenableQuery({ data: [] });
            const countQuery = createThenableQuery({ count: 2 });
            const matchesQuery = createThenableQuery({ data: matches });
            const responsesQuery = createThenableQuery({ data: [] });
            const unreadQuery = createThenableQuery({ data: unreadMessages, error: null });

            (supabase.from as jest.Mock)
                .mockReturnValueOnce(archivesQuery) // archived matches
                .mockReturnValueOnce(countQuery) // count
                .mockReturnValueOnce(matchesQuery) // matches
                .mockReturnValueOnce(responsesQuery) // responses
                .mockReturnValueOnce(unreadQuery); // messages

            await useMatchStore.getState().fetchMatches(true);

            const state = useMatchStore.getState();
            expect(state.matches[0].id).toBe('a');
            expect(state.newMatchesCount).toBe(1);
        });

        it('sets empty state when user has no couple', async () => {
            useAuthStore.setState({ user: { id: 'me', couple_id: null } } as any);

            await useMatchStore.getState().fetchMatches(true);

            const state = useMatchStore.getState();
            expect(state.matches).toEqual([]);
            expect(state.newMatchesCount).toBe(0);
            expect(state.totalCount).toBe(0);
            expect(supabase.from).not.toHaveBeenCalled();
        });

        it('prevents concurrent loading', async () => {
            useMatchStore.setState({ isLoading: true });

            await useMatchStore.getState().fetchMatches(true);

            expect(supabase.from).not.toHaveBeenCalled();
        });

        it('filters out archived matches', async () => {
            const matches = [
                { id: 'a', question_id: 'q1', created_at: '2024-01-02T00:00:00.000Z', is_new: false },
                { id: 'b', question_id: 'q2', created_at: '2024-01-03T00:00:00.000Z', is_new: false },
            ];

            const archivesQuery = createThenableQuery({ data: [{ match_id: 'a' }] });
            const countQuery = createThenableQuery({ count: 2 });
            const matchesQuery = createThenableQuery({ data: matches });
            const responsesQuery = createThenableQuery({ data: [] });
            const unreadQuery = createThenableQuery({ data: [], error: null });

            (supabase.from as jest.Mock)
                .mockReturnValueOnce(archivesQuery)
                .mockReturnValueOnce(countQuery)
                .mockReturnValueOnce(matchesQuery)
                .mockReturnValueOnce(responsesQuery)
                .mockReturnValueOnce(unreadQuery);

            await useMatchStore.getState().fetchMatches(true);

            const state = useMatchStore.getState();
            expect(state.matches).toHaveLength(1);
            expect(state.matches[0].id).toBe('b');
            // Total count should subtract archived
            expect(state.totalCount).toBe(1);
        });

        it('handles empty matches correctly', async () => {
            const archivesQuery = createThenableQuery({ data: [] });
            const countQuery = createThenableQuery({ count: 0 });
            const matchesQuery = createThenableQuery({ data: [] });

            (supabase.from as jest.Mock)
                .mockReturnValueOnce(archivesQuery)
                .mockReturnValueOnce(countQuery)
                .mockReturnValueOnce(matchesQuery);

            await useMatchStore.getState().fetchMatches(true);

            const state = useMatchStore.getState();
            expect(state.matches).toEqual([]);
            expect(state.hasMore).toBe(false);
            expect(state.isLoading).toBe(false);
        });

        it('handles fetch error gracefully', async () => {
            const archivesQuery = createThenableQuery({ data: [] });
            const countQuery = createThenableQuery({ count: 0 });
            // Use createThenableQuery with error data to simulate error response
            const matchesQuery = createThenableQuery({ data: null, error: { message: 'Network error' } });

            (supabase.from as jest.Mock)
                .mockReturnValueOnce(archivesQuery)
                .mockReturnValueOnce(countQuery)
                .mockReturnValueOnce(matchesQuery);

            await useMatchStore.getState().fetchMatches(true);

            const state = useMatchStore.getState();
            expect(state.error).toBe('Failed to load matches');
            expect(state.isLoading).toBe(false);
        });

        it('paginates matches correctly', async () => {
            useMatchStore.setState({
                matches: [{ id: 'existing' }] as any,
                page: 1,
                hasMore: true,
            });

            const newMatches = [
                { id: 'c', question_id: 'q3', created_at: '2024-01-01T00:00:00.000Z', is_new: false },
            ];

            const matchesQuery = createThenableQuery({ data: newMatches });
            const responsesQuery = createThenableQuery({ data: [] });
            const unreadQuery = createThenableQuery({ data: [] });

            (supabase.from as jest.Mock)
                .mockReturnValueOnce(matchesQuery)
                .mockReturnValueOnce(responsesQuery)
                .mockReturnValueOnce(unreadQuery);

            await useMatchStore.getState().fetchMatches(false);

            const state = useMatchStore.getState();
            expect(state.matches).toHaveLength(2);
            expect(state.page).toBe(2);
        });
    });

    describe('markAsSeen', () => {
        it('marks a match as seen and updates count', async () => {
            useMatchStore.setState({
                matches: [
                    { id: 'm1', is_new: true } as any,
                    { id: 'm2', is_new: true } as any,
                ],
                newMatchesCount: 2,
            });

            const updateQuery = createThenableQuery({});
            (supabase.from as jest.Mock).mockReturnValue(updateQuery);

            await useMatchStore.getState().markAsSeen('m1');

            const state = useMatchStore.getState();
            expect(state.matches[0].is_new).toBe(false);
            expect(state.matches[1].is_new).toBe(true);
            expect(state.newMatchesCount).toBe(1);
            expect(updateQuery.update).toHaveBeenCalledWith({ is_new: false });
        });
    });

    describe('markAllAsSeen', () => {
        it('marks all matches as seen', async () => {
            useMatchStore.setState({
                matches: [
                    { id: 'm1', is_new: true } as any,
                    { id: 'm2', is_new: true } as any,
                ],
                newMatchesCount: 2,
            });

            const updateQuery = createThenableQuery({});
            (supabase.from as jest.Mock).mockReturnValue(updateQuery);

            await useMatchStore.getState().markAllAsSeen();

            const state = useMatchStore.getState();
            expect(state.matches.every(m => !m.is_new)).toBe(true);
            expect(state.newMatchesCount).toBe(0);
        });

        it('does nothing when no new matches', async () => {
            useMatchStore.setState({
                matches: [{ id: 'm1', is_new: false } as any],
                newMatchesCount: 0,
            });

            await useMatchStore.getState().markAllAsSeen();

            expect(supabase.from).not.toHaveBeenCalled();
        });
    });

    describe('addMatch', () => {
        it('adds a new match to the beginning', () => {
            useMatchStore.setState({
                matches: [{ id: 'm1' } as any],
                newMatchesCount: 0,
                totalCount: 1,
            });

            useMatchStore.getState().addMatch({ id: 'm2', is_new: true } as any);

            const state = useMatchStore.getState();
            expect(state.matches[0].id).toBe('m2');
            expect(state.matches).toHaveLength(2);
            expect(state.newMatchesCount).toBe(1);
            expect(state.totalCount).toBe(2);
        });
    });

    describe('updateMatchUnreadCount', () => {
        it('increments unread count', () => {
            useMatchStore.setState({
                matches: [{ id: 'm1', unreadCount: 1 } as any],
            });

            useMatchStore.getState().updateMatchUnreadCount('m1', 2);

            expect(useMatchStore.getState().matches[0].unreadCount).toBe(3);
        });

        it('decrements unread count but not below zero', () => {
            useMatchStore.setState({
                matches: [{ id: 'm1', unreadCount: 1 } as any],
            });

            useMatchStore.getState().updateMatchUnreadCount('m1', -5);

            expect(useMatchStore.getState().matches[0].unreadCount).toBe(0);
        });

        it('handles missing unreadCount', () => {
            useMatchStore.setState({
                matches: [{ id: 'm1' } as any],
            });

            useMatchStore.getState().updateMatchUnreadCount('m1', 1);

            expect(useMatchStore.getState().matches[0].unreadCount).toBe(1);
        });
    });

    describe('clearMatches', () => {
        it('resets all state to initial values', () => {
            useMatchStore.setState({
                matches: [{ id: 'm1' }] as any,
                newMatchesCount: 5,
                totalCount: 10,
                isLoading: true,
                error: 'some error',
                page: 3,
                hasMore: false,
                isLoadingMore: true,
                archivedMatches: [{ id: 'a1' }] as any,
                archivedMatchIds: new Set(['a1']),
                showArchived: true,
                isLoadingArchived: true,
            });

            useMatchStore.getState().clearMatches();

            const state = useMatchStore.getState();
            expect(state.matches).toEqual([]);
            expect(state.newMatchesCount).toBe(0);
            expect(state.totalCount).toBeNull();
            expect(state.isLoading).toBe(false);
            expect(state.error).toBeNull();
            expect(state.page).toBe(0);
            expect(state.hasMore).toBe(true);
            expect(state.isLoadingMore).toBe(false);
            expect(state.archivedMatches).toEqual([]);
            expect(state.archivedMatchIds.size).toBe(0);
            expect(state.showArchived).toBe(false);
            expect(state.isLoadingArchived).toBe(false);
        });
    });

    describe('archiveMatch', () => {
        it('archives a match with optimistic update', async () => {
            useMatchStore.setState({
                matches: [
                    { id: 'm1' } as any,
                    { id: 'm2' } as any,
                ],
                archivedMatches: [],
                archivedMatchIds: new Set(),
                totalCount: 2,
            });

            const insertQuery = createThenableQuery({ error: null });
            (supabase.from as jest.Mock).mockReturnValue(insertQuery);

            await useMatchStore.getState().archiveMatch('m1');

            const state = useMatchStore.getState();
            expect(state.matches).toHaveLength(1);
            expect(state.matches[0].id).toBe('m2');
            expect(state.archivedMatches).toHaveLength(1);
            expect(state.archivedMatches[0].id).toBe('m1');
            expect(state.archivedMatchIds.has('m1')).toBe(true);
            expect(state.totalCount).toBe(1);
        });

        it('does nothing if user not authenticated', async () => {
            useAuthStore.setState({ user: null } as any);

            await useMatchStore.getState().archiveMatch('m1');

            expect(supabase.from).not.toHaveBeenCalled();
        });

        it('reverts on error', async () => {
            useMatchStore.setState({
                matches: [{ id: 'm1' } as any],
                archivedMatches: [],
                archivedMatchIds: new Set(),
                totalCount: 1,
            });

            const insertQuery = createThenableQuery({ error: new Error('DB error') });
            (supabase.from as jest.Mock).mockReturnValue(insertQuery);

            await useMatchStore.getState().archiveMatch('m1');

            const state = useMatchStore.getState();
            // Should revert
            expect(state.matches).toHaveLength(1);
            expect(state.archivedMatchIds.has('m1')).toBe(false);
        });
    });

    describe('unarchiveMatch', () => {
        it('unarchives a match with optimistic update', async () => {
            useMatchStore.setState({
                matches: [],
                archivedMatches: [{ id: 'm1' } as any],
                archivedMatchIds: new Set(['m1']),
                totalCount: 0,
            });

            const deleteQuery = createThenableQuery({ error: null });
            (supabase.from as jest.Mock).mockReturnValue(deleteQuery);

            await useMatchStore.getState().unarchiveMatch('m1');

            const state = useMatchStore.getState();
            expect(state.matches).toHaveLength(1);
            expect(state.matches[0].id).toBe('m1');
            expect(state.archivedMatches).toHaveLength(0);
            expect(state.archivedMatchIds.has('m1')).toBe(false);
            expect(state.totalCount).toBe(1);
        });

        it('does nothing if user not authenticated', async () => {
            useAuthStore.setState({ user: null } as any);

            await useMatchStore.getState().unarchiveMatch('m1');

            expect(supabase.from).not.toHaveBeenCalled();
        });
    });

    describe('fetchArchivedMatches', () => {
        it('fetches archived matches', async () => {
            const archivesQuery = createThenableQuery({ data: [{ match_id: 'm1' }] });
            const matchesQuery = createThenableQuery({
                data: [{ id: 'm1', question_id: 'q1', created_at: '2024-01-01' }],
            });
            const unreadQuery = createThenableQuery({ data: [] });

            (supabase.from as jest.Mock)
                .mockReturnValueOnce(archivesQuery)
                .mockReturnValueOnce(matchesQuery)
                .mockReturnValueOnce(unreadQuery);

            await useMatchStore.getState().fetchArchivedMatches();

            const state = useMatchStore.getState();
            expect(state.archivedMatches).toHaveLength(1);
            expect(state.archivedMatches[0].id).toBe('m1');
            expect(state.isLoadingArchived).toBe(false);
        });

        it('does nothing if no couple', async () => {
            useAuthStore.setState({ user: { id: 'me', couple_id: null } } as any);

            await useMatchStore.getState().fetchArchivedMatches();

            expect(supabase.from).not.toHaveBeenCalled();
        });

        it('handles empty archives', async () => {
            const archivesQuery = createThenableQuery({ data: [] });

            (supabase.from as jest.Mock).mockReturnValue(archivesQuery);

            await useMatchStore.getState().fetchArchivedMatches();

            const state = useMatchStore.getState();
            expect(state.archivedMatches).toEqual([]);
            expect(state.isLoadingArchived).toBe(false);
        });
    });

    describe('toggleShowArchived', () => {
        it('toggles showArchived state', () => {
            expect(useMatchStore.getState().showArchived).toBe(false);

            useMatchStore.getState().toggleShowArchived();

            expect(useMatchStore.getState().showArchived).toBe(true);

            useMatchStore.getState().toggleShowArchived();

            expect(useMatchStore.getState().showArchived).toBe(false);
        });

        it('fetches archived matches when toggling to show', async () => {
            const archivesQuery = createThenableQuery({ data: [] });
            (supabase.from as jest.Mock).mockReturnValue(archivesQuery);

            useMatchStore.getState().toggleShowArchived();

            // Should trigger fetch
            expect(supabase.from).toHaveBeenCalled();
        });
    });

    describe('isMatchArchived', () => {
        it('returns true for archived matches', () => {
            useMatchStore.setState({
                archivedMatchIds: new Set(['m1', 'm2']),
            });

            expect(useMatchStore.getState().isMatchArchived('m1')).toBe(true);
            expect(useMatchStore.getState().isMatchArchived('m2')).toBe(true);
            expect(useMatchStore.getState().isMatchArchived('m3')).toBe(false);
        });
    });
});
