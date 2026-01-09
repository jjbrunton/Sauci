import { useResponsesStore, groupResponses, ResponseWithQuestion } from '@/store/responsesStore';
import { useAuthStore } from '@/store/authStore';
import { useMatchStore } from '@/store/matchStore';
import { supabase } from '@/lib/supabase';

// Mock authErrorHandler
jest.mock('@/lib/authErrorHandler', () => ({
    invokeWithAuthRetry: jest.fn(),
}));

import { invokeWithAuthRetry } from '@/lib/authErrorHandler';

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

describe('responsesStore', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        useResponsesStore.setState({
            responses: [],
            isLoading: false,
            isLoadingMore: false,
            groupBy: 'date',
            dateSortOrder: 'newest',
            hasMore: true,
            page: 0,
            totalCount: null,
        });
        useAuthStore.setState({ user: { id: 'me', couple_id: 'couple1' } } as any);
        useMatchStore.setState({ matches: [], fetchMatches: jest.fn() } as any);
    });

    describe('fetchResponses', () => {
        it('fetches responses with questions and packs on refresh', async () => {
            const responses = [
                {
                    id: 'r1',
                    question_id: 'q1',
                    answer: 'yes',
                    created_at: '2024-01-01T00:00:00.000Z',
                    question: {
                        id: 'q1',
                        text: 'Question 1',
                        partner_text: null,
                        intensity: 2,
                        pack_id: 'p1',
                        pack: { id: 'p1', name: 'Pack 1', icon: '❤️' },
                    },
                },
            ];

            const countQuery = createThenableQuery({ count: 1 });
            const responsesQuery = createThenableQuery({ data: responses });
            const matchesQuery = createThenableQuery({ data: [{ id: 'm1', question_id: 'q1' }] });
            const partnerQuery = createThenableQuery({ data: [{ question_id: 'q1' }] });

            (supabase.from as jest.Mock)
                .mockReturnValueOnce(countQuery)
                .mockReturnValueOnce(responsesQuery)
                .mockReturnValueOnce(matchesQuery)
                .mockReturnValueOnce(partnerQuery);

            await useResponsesStore.getState().fetchResponses(true);

            const state = useResponsesStore.getState();
            expect(state.responses).toHaveLength(1);
            expect(state.responses[0].has_match).toBe(true);
            expect(state.responses[0].match_id).toBe('m1');
            expect(state.responses[0].partner_answered).toBe(true);
            expect(state.totalCount).toBe(1);
            expect(state.isLoading).toBe(false);
        });

        it('does nothing if user is not authenticated', async () => {
            useAuthStore.setState({ user: null } as any);

            await useResponsesStore.getState().fetchResponses(true);

            expect(supabase.from).not.toHaveBeenCalled();
        });

        it('does nothing if couple_id is missing', async () => {
            useAuthStore.setState({ user: { id: 'me', couple_id: null } } as any);

            await useResponsesStore.getState().fetchResponses(true);

            expect(supabase.from).not.toHaveBeenCalled();
        });

        it('prevents concurrent loading', async () => {
            useResponsesStore.setState({ isLoading: true });

            await useResponsesStore.getState().fetchResponses(true);

            expect(supabase.from).not.toHaveBeenCalled();
        });

        it('handles empty responses correctly', async () => {
            const countQuery = createThenableQuery({ count: 0 });
            const responsesQuery = createThenableQuery({ data: [] });

            (supabase.from as jest.Mock)
                .mockReturnValueOnce(countQuery)
                .mockReturnValueOnce(responsesQuery);

            await useResponsesStore.getState().fetchResponses(true);

            const state = useResponsesStore.getState();
            expect(state.responses).toEqual([]);
            expect(state.hasMore).toBe(false);
            expect(state.totalCount).toBe(0);
        });

        it('paginates responses correctly', async () => {
            // Set up initial state with some responses
            useResponsesStore.setState({
                page: 1,
                hasMore: true,
                responses: [{ id: 'r0' }] as any,
            });

            const responses = [
                {
                    id: 'r1',
                    question_id: 'q1',
                    answer: 'yes',
                    created_at: '2024-01-01T00:00:00.000Z',
                    question: {
                        id: 'q1',
                        text: 'Question 1',
                        pack: { id: 'p1', name: 'Pack 1', icon: '❤️' },
                    },
                },
            ];

            const responsesQuery = createThenableQuery({ data: responses });
            const matchesQuery = createThenableQuery({ data: [] });
            const partnerQuery = createThenableQuery({ data: [] });

            (supabase.from as jest.Mock)
                .mockReturnValueOnce(responsesQuery)
                .mockReturnValueOnce(matchesQuery)
                .mockReturnValueOnce(partnerQuery);

            await useResponsesStore.getState().fetchResponses(false);

            const state = useResponsesStore.getState();
            // Should append to existing responses
            expect(state.responses).toHaveLength(2);
            expect(state.page).toBe(2);
        });

        it('handles fetch errors gracefully', async () => {
            const countQuery = createThenableQuery({ count: 1 });
            const responsesQuery = createThenableQuery({ data: null, error: new Error('Network error') });

            (supabase.from as jest.Mock)
                .mockReturnValueOnce(countQuery)
                .mockReturnValueOnce(responsesQuery);

            await useResponsesStore.getState().fetchResponses(true);

            const state = useResponsesStore.getState();
            expect(state.isLoading).toBe(false);
            expect(state.isLoadingMore).toBe(false);
        });
    });

    describe('updateResponse', () => {
        it('updates response and refreshes matches on success', async () => {
            const fetchMatchesMock = jest.fn();
            useMatchStore.setState({ fetchMatches: fetchMatchesMock } as any);
            useResponsesStore.setState({
                responses: [
                    { question_id: 'q1', answer: 'maybe', has_match: false } as any,
                ],
            });

            (invokeWithAuthRetry as jest.Mock).mockResolvedValueOnce({
                data: { success: true, new_match: { id: 'm1' } },
                error: null,
            });

            const result = await useResponsesStore.getState().updateResponse('q1', 'yes');

            expect(result.success).toBe(true);
            expect(result.new_match).toEqual({ id: 'm1' });

            const state = useResponsesStore.getState();
            expect(state.responses[0].answer).toBe('yes');
            expect(state.responses[0].has_match).toBe(true);
            expect(state.responses[0].match_id).toBe('m1');
            expect(fetchMatchesMock).toHaveBeenCalled();
        });

        it('handles match deletion correctly', async () => {
            const fetchMatchesMock = jest.fn();
            useMatchStore.setState({ fetchMatches: fetchMatchesMock } as any);
            useResponsesStore.setState({
                responses: [
                    { question_id: 'q1', answer: 'yes', has_match: true, match_id: 'm1' } as any,
                ],
            });

            (invokeWithAuthRetry as jest.Mock).mockResolvedValueOnce({
                data: { success: true, match_deleted: true },
                error: null,
            });

            const result = await useResponsesStore.getState().updateResponse('q1', 'no', true);

            expect(result.success).toBe(true);
            expect(result.match_deleted).toBe(true);

            const state = useResponsesStore.getState();
            expect(state.responses[0].answer).toBe('no');
            expect(state.responses[0].has_match).toBe(false);
            expect(state.responses[0].match_id).toBeUndefined();
            expect(fetchMatchesMock).toHaveBeenCalled();
        });

        it('returns requires_confirmation without updating local state', async () => {
            useResponsesStore.setState({
                responses: [
                    { question_id: 'q1', answer: 'yes', has_match: true } as any,
                ],
            });

            (invokeWithAuthRetry as jest.Mock).mockResolvedValueOnce({
                data: { success: false, requires_confirmation: true, message_count: 5 },
                error: null,
            });

            const result = await useResponsesStore.getState().updateResponse('q1', 'no');

            expect(result.requires_confirmation).toBe(true);
            expect(result.message_count).toBe(5);

            const state = useResponsesStore.getState();
            // Should not update local state
            expect(state.responses[0].answer).toBe('yes');
        });

        it('handles errors from edge function', async () => {
            (invokeWithAuthRetry as jest.Mock).mockResolvedValueOnce({
                data: null,
                error: { message: 'Server error' },
            });

            const result = await useResponsesStore.getState().updateResponse('q1', 'yes');

            expect(result.success).toBe(false);
            expect(result.error).toBe('Server error');
        });

        it('refreshes matches when match_type_updated', async () => {
            const fetchMatchesMock = jest.fn();
            useMatchStore.setState({ fetchMatches: fetchMatchesMock } as any);
            useResponsesStore.setState({
                responses: [
                    { question_id: 'q1', answer: 'maybe', has_match: true, match_id: 'm1' } as any,
                ],
            });

            (invokeWithAuthRetry as jest.Mock).mockResolvedValueOnce({
                data: { success: true, match_type_updated: true },
                error: null,
            });

            await useResponsesStore.getState().updateResponse('q1', 'yes');

            expect(fetchMatchesMock).toHaveBeenCalled();
        });
    });

    describe('setGroupBy', () => {
        it('updates groupBy option', () => {
            useResponsesStore.getState().setGroupBy('pack');
            expect(useResponsesStore.getState().groupBy).toBe('pack');

            useResponsesStore.getState().setGroupBy('answer');
            expect(useResponsesStore.getState().groupBy).toBe('answer');

            useResponsesStore.getState().setGroupBy('date');
            expect(useResponsesStore.getState().groupBy).toBe('date');
        });
    });

    describe('setDateSortOrder', () => {
        it('updates date sort order', () => {
            useResponsesStore.getState().setDateSortOrder('oldest');
            expect(useResponsesStore.getState().dateSortOrder).toBe('oldest');

            useResponsesStore.getState().setDateSortOrder('newest');
            expect(useResponsesStore.getState().dateSortOrder).toBe('newest');
        });
    });

    describe('toggleDateSortOrder', () => {
        it('toggles between newest and oldest', () => {
            expect(useResponsesStore.getState().dateSortOrder).toBe('newest');

            useResponsesStore.getState().toggleDateSortOrder();
            expect(useResponsesStore.getState().dateSortOrder).toBe('oldest');

            useResponsesStore.getState().toggleDateSortOrder();
            expect(useResponsesStore.getState().dateSortOrder).toBe('newest');
        });
    });

    describe('clearResponses', () => {
        it('resets store to initial state', () => {
            useResponsesStore.setState({
                responses: [{ id: 'r1' } as any],
                isLoading: true,
                groupBy: 'pack',
                dateSortOrder: 'oldest',
                page: 5,
                hasMore: false,
                isLoadingMore: true,
                totalCount: 10,
            });

            useResponsesStore.getState().clearResponses();

            const state = useResponsesStore.getState();
            expect(state.responses).toEqual([]);
            expect(state.isLoading).toBe(false);
            expect(state.groupBy).toBe('date');
            expect(state.dateSortOrder).toBe('newest');
            expect(state.page).toBe(0);
            expect(state.hasMore).toBe(true);
            expect(state.isLoadingMore).toBe(false);
            expect(state.totalCount).toBeNull();
        });
    });
});

describe('groupResponses', () => {
    const mockResponses: ResponseWithQuestion[] = [
        {
            id: 'r1',
            question_id: 'q1',
            answer: 'yes',
            created_at: '2024-01-15T10:00:00.000Z',
            question: {
                id: 'q1',
                text: 'Question 1',
                partner_text: null,
                intensity: 2,
                pack_id: 'p1',
                created_at: '',
                pack: { id: 'p1', name: 'Pack A', icon: '❤️' },
            },
            has_match: true,
            partner_answered: true,
        },
        {
            id: 'r2',
            question_id: 'q2',
            answer: 'maybe',
            created_at: '2024-01-15T14:00:00.000Z',
            question: {
                id: 'q2',
                text: 'Question 2',
                partner_text: null,
                intensity: 3,
                pack_id: 'p2',
                created_at: '',
                pack: { id: 'p2', name: 'Pack B', icon: '💜' },
            },
            has_match: false,
            partner_answered: false,
        },
        {
            id: 'r3',
            question_id: 'q3',
            answer: 'no',
            created_at: '2024-01-14T10:00:00.000Z',
            question: {
                id: 'q3',
                text: 'Question 3',
                partner_text: null,
                intensity: 1,
                pack_id: 'p1',
                created_at: '',
                pack: { id: 'p1', name: 'Pack A', icon: '❤️' },
            },
            has_match: false,
            partner_answered: true,
        },
        {
            id: 'r4',
            question_id: 'q4',
            answer: 'yes',
            created_at: '2024-01-14T14:00:00.000Z',
            question: {
                id: 'q4',
                text: 'Question 4',
                partner_text: null,
                intensity: 2,
                pack_id: 'p2',
                created_at: '',
                pack: { id: 'p2', name: 'Pack B', icon: '💜' },
            },
            has_match: true,
            partner_answered: true,
        },
    ];

    describe('groupBy pack', () => {
        it('groups responses by pack name', () => {
            const grouped = groupResponses(mockResponses, 'pack');

            expect(grouped).toHaveLength(2);

            const packA = grouped.find(g => g.title === 'Pack A');
            const packB = grouped.find(g => g.title === 'Pack B');

            expect(packA?.data).toHaveLength(2);
            expect(packB?.data).toHaveLength(2);
        });
    });

    describe('groupBy answer', () => {
        it('groups responses by answer type in order: yes, maybe, no', () => {
            const grouped = groupResponses(mockResponses, 'answer');

            expect(grouped).toHaveLength(3);
            expect(grouped[0].title).toBe('Yes');
            expect(grouped[0].data).toHaveLength(2);
            expect(grouped[1].title).toBe('Maybe');
            expect(grouped[1].data).toHaveLength(1);
            expect(grouped[2].title).toBe('No');
            expect(grouped[2].data).toHaveLength(1);
        });

        it('excludes empty answer groups', () => {
            const yesOnlyResponses = mockResponses.filter(r => r.answer === 'yes');
            const grouped = groupResponses(yesOnlyResponses, 'answer');

            expect(grouped).toHaveLength(1);
            expect(grouped[0].title).toBe('Yes');
        });
    });

    describe('groupBy date', () => {
        it('groups responses by date with newest first', () => {
            const grouped = groupResponses(mockResponses, 'date', 'newest');

            expect(grouped).toHaveLength(2);
            // January 15 should be first (newer)
            expect(grouped[0].title).toContain('January 15');
            expect(grouped[0].data).toHaveLength(2);
            expect(grouped[1].title).toContain('January 14');
            expect(grouped[1].data).toHaveLength(2);
        });

        it('groups responses by date with oldest first', () => {
            const grouped = groupResponses(mockResponses, 'date', 'oldest');

            expect(grouped).toHaveLength(2);
            // January 14 should be first (older)
            expect(grouped[0].title).toContain('January 14');
            expect(grouped[1].title).toContain('January 15');
        });

        it('sorts responses within each date group', () => {
            const grouped = groupResponses(mockResponses, 'date', 'newest');

            // Within January 15, the response at 14:00 should come first (newest)
            const jan15Group = grouped[0];
            expect(new Date(jan15Group.data[0].created_at).getTime())
                .toBeGreaterThan(new Date(jan15Group.data[1].created_at).getTime());
        });
    });

    describe('default grouping', () => {
        it('returns all responses in a single group for unknown groupBy', () => {
            // @ts-expect-error Testing unknown groupBy value
            const grouped = groupResponses(mockResponses, 'unknown');

            expect(grouped).toHaveLength(1);
            expect(grouped[0].title).toBe('All Responses');
            expect(grouped[0].data).toHaveLength(4);
        });
    });
});
