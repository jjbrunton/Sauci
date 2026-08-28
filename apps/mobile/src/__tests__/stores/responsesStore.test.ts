import { apiClient } from '@/lib/apiClient';
import { groupResponses, type ResponseWithQuestion, useResponsesStore } from '@/store/responsesStore';
import { useAuthStore } from '@/store/authStore';
import { useMatchStore } from '@/store/matchStore';

jest.mock('@/lib/apiClient', () => ({ apiClient: { get: jest.fn(), patch: jest.fn() } }));

const apiGet = apiClient.get as jest.Mock;
const apiPatch = apiClient.patch as jest.Mock;

function response(overrides: Partial<ResponseWithQuestion> = {}): ResponseWithQuestion {
    return {
        id: 'r1',
        question_id: 'q1',
        answer: 'yes',
        response_data: null,
        created_at: '2024-01-15T10:00:00.000Z',
        question: {
            id: 'q1', text: 'Question 1', partner_text: null, intensity: 2,
            pack_id: 'p1', created_at: '',
            pack: { id: 'p1', name: 'Pack A', icon: 'heart' },
        },
        has_match: true,
        match_id: 'm1',
        partner_answered: true,
        ...overrides,
    } as ResponseWithQuestion;
}

function resetStore(): void {
    useResponsesStore.setState({
        responses: [], isLoading: false, isLoadingMore: false, groupBy: 'date',
        dateSortOrder: 'newest', hasMore: true, page: 0, totalCount: null,
    });
}

describe('responsesStore', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        resetStore();
        useAuthStore.setState({ user: { id: 'me', couple_id: 'couple1' } } as any);
        useMatchStore.setState({ matches: [], fetchMatches: jest.fn() } as any);
    });

    describe('fetchResponses', () => {
        it('fetches server-composed response, question, match, and partner state on refresh', async () => {
            const row = response();
            apiGet.mockResolvedValue({ responses: [row], totalCount: 1 });

            await useResponsesStore.getState().fetchResponses(true);

            expect(apiGet).toHaveBeenCalledWith('/v1/me/responses?page=0&limit=20');
            expect(useResponsesStore.getState()).toMatchObject({
                responses: [row], totalCount: 1, page: 1, isLoading: false,
                isLoadingMore: false, hasMore: false,
            });
            expect(useResponsesStore.getState().responses[0]).toMatchObject({
                has_match: true, match_id: 'm1', partner_answered: true,
                question: { pack: { name: 'Pack A' } },
            });
        });

        it.each([
            ['no authenticated user', null],
            ['no couple', { id: 'me', couple_id: null }],
        ])('does not call the API with %s', async (_label, user) => {
            useAuthStore.setState({ user } as any);
            await useResponsesStore.getState().fetchResponses(true);
            expect(apiGet).not.toHaveBeenCalled();
        });

        it('prevents a second request while refresh loading is active', async () => {
            let resolve!: (value: unknown) => void;
            apiGet.mockReturnValue(new Promise((done) => { resolve = done; }));
            const first = useResponsesStore.getState().fetchResponses(true);
            await useResponsesStore.getState().fetchResponses(true);
            expect(apiGet).toHaveBeenCalledTimes(1);
            resolve({ responses: [], totalCount: 0 });
            await first;
        });

        it('prevents load-more overlap but permits an explicit refresh', async () => {
            useResponsesStore.setState({ isLoadingMore: true });
            await useResponsesStore.getState().fetchResponses(false);
            expect(apiGet).not.toHaveBeenCalled();

            apiGet.mockResolvedValue({ responses: [], totalCount: 0 });
            await useResponsesStore.getState().fetchResponses(true);
            expect(apiGet).toHaveBeenCalledTimes(1);
        });

        it('does not request another page after exhaustion', async () => {
            useResponsesStore.setState({ hasMore: false });
            await useResponsesStore.getState().fetchResponses(false);
            expect(apiGet).not.toHaveBeenCalled();
        });

        it('clears stale rows and captures total count for an empty refresh', async () => {
            useResponsesStore.setState({ responses: [response()], totalCount: 4 });
            apiGet.mockResolvedValue({ responses: [], totalCount: 0 });
            await useResponsesStore.getState().fetchResponses(true);
            expect(useResponsesStore.getState()).toMatchObject({
                responses: [], totalCount: 0, hasMore: false, isLoading: false,
            });
        });

        it('marks load-more exhausted without clearing existing responses', async () => {
            const existing = response();
            useResponsesStore.setState({ responses: [existing], page: 1, totalCount: 1 });
            apiGet.mockResolvedValue({ responses: [], totalCount: 1 });
            await useResponsesStore.getState().fetchResponses(false);
            expect(useResponsesStore.getState()).toMatchObject({
                responses: [existing], page: 1, totalCount: 1,
                hasMore: false, isLoadingMore: false,
            });
        });

        it('appends the requested page and preserves refresh total count', async () => {
            const existing = response();
            const next = response({ id: 'r2', question_id: 'q2' });
            useResponsesStore.setState({ responses: [existing], page: 1, totalCount: 21 });
            apiGet.mockResolvedValue({ responses: [next], totalCount: 21 });
            await useResponsesStore.getState().fetchResponses(false);
            expect(apiGet).toHaveBeenCalledWith('/v1/me/responses?page=1&limit=20');
            expect(useResponsesStore.getState()).toMatchObject({
                responses: [existing, next], page: 2, totalCount: 21,
                hasMore: false, isLoadingMore: false,
            });
        });

        it('keeps hasMore true for a full page', async () => {
            apiGet.mockResolvedValue({
                responses: Array.from({ length: 20 }, (_, index) => response({ id: `r${index}` })),
                totalCount: 40,
            });
            await useResponsesStore.getState().fetchResponses(true);
            expect(useResponsesStore.getState().hasMore).toBe(true);
        });

        it('releases refresh loading after an API failure without destroying existing data', async () => {
            const existing = response();
            useResponsesStore.setState({ responses: [existing], totalCount: 1 });
            apiGet.mockRejectedValue(new Error('Network error'));
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
            await useResponsesStore.getState().fetchResponses(true);
            expect(useResponsesStore.getState()).toMatchObject({
                responses: [existing], isLoading: false, isLoadingMore: false, totalCount: 1,
            });
            expect(consoleSpy).toHaveBeenCalledWith('Error in fetchResponses:', expect.any(Error));
            consoleSpy.mockRestore();
        });

        it('releases load-more loading after an API failure', async () => {
            useResponsesStore.setState({ page: 1 });
            apiGet.mockRejectedValue(new Error('Network error'));
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
            await useResponsesStore.getState().fetchResponses(false);
            expect(useResponsesStore.getState()).toMatchObject({ isLoading: false, isLoadingMore: false, page: 1 });
            consoleSpy.mockRestore();
        });
    });

    describe('updateResponse', () => {
        it('creates a local match and refreshes the match store', async () => {
            const fetchMatches = jest.fn();
            useMatchStore.setState({ fetchMatches } as any);
            useResponsesStore.setState({ responses: [response({ answer: 'maybe', has_match: false, match_id: undefined })] });
            apiPatch.mockResolvedValue({ success: true, new_match: { id: 'm2' } });

            const result = await useResponsesStore.getState().updateResponse('q1', 'yes');

            expect(apiPatch).toHaveBeenCalledWith('/v1/responses/q1', {
                new_answer: 'yes', confirm_delete_match: false, response_data: undefined,
            });
            expect(result).toMatchObject({ success: true, new_match: { id: 'm2' } });
            expect(useResponsesStore.getState().responses[0]).toMatchObject({
                answer: 'yes', has_match: true, match_id: 'm2',
            });
            expect(fetchMatches).toHaveBeenCalledTimes(1);
        });

        it('deletes a confirmed match and clears response data for a no answer', async () => {
            const fetchMatches = jest.fn();
            useMatchStore.setState({ fetchMatches } as any);
            useResponsesStore.setState({ responses: [response({ response_data: { type: 'text_answer', text: 'old' } })] });
            apiPatch.mockResolvedValue({ success: true, match_deleted: true });

            await useResponsesStore.getState().updateResponse('q1', 'no', true);

            expect(useResponsesStore.getState().responses[0]).toMatchObject({
                answer: 'no', response_data: null, has_match: false,
            });
            expect(useResponsesStore.getState().responses[0].match_id).toBeUndefined();
            expect(fetchMatches).toHaveBeenCalled();
        });

        it('returns confirmation details without mutating local state', async () => {
            const original = response();
            useResponsesStore.setState({ responses: [original] });
            apiPatch.mockResolvedValue({ success: false, requires_confirmation: true, match_id: 'm1', message_count: 5 });
            const result = await useResponsesStore.getState().updateResponse('q1', 'no');
            expect(result).toMatchObject({ requires_confirmation: true, message_count: 5 });
            expect(useResponsesStore.getState().responses[0]).toEqual(original);
        });

        it('preserves existing response data when omitted', async () => {
            const data = { type: 'text_answer', text: 'existing' } as const;
            useResponsesStore.setState({ responses: [response({ response_data: data })] });
            apiPatch.mockResolvedValue({ success: true });
            await useResponsesStore.getState().updateResponse('q1', 'yes');
            expect(useResponsesStore.getState().responses[0].response_data).toEqual(data);
        });

        it('sets replacement response data when supplied', async () => {
            const replacement = { type: 'text_answer', text: 'new' } as const;
            useResponsesStore.setState({ responses: [response()] });
            apiPatch.mockResolvedValue({ success: true });
            await useResponsesStore.getState().updateResponse('q1', 'yes', false, replacement);
            expect(apiPatch).toHaveBeenCalledWith('/v1/responses/q1', expect.objectContaining({ response_data: replacement }));
            expect(useResponsesStore.getState().responses[0].response_data).toEqual(replacement);
        });

        it('accepts an explicit null response-data update', async () => {
            useResponsesStore.setState({ responses: [response({ response_data: { type: 'text_answer', text: 'old' } })] });
            apiPatch.mockResolvedValue({ success: true });
            await useResponsesStore.getState().updateResponse('q1', 'yes', false, null);
            expect(useResponsesStore.getState().responses[0].response_data).toBeNull();
        });

        it('refreshes matches when only the match type changed', async () => {
            const fetchMatches = jest.fn();
            useMatchStore.setState({ fetchMatches } as any);
            useResponsesStore.setState({ responses: [response({ answer: 'maybe' })] });
            apiPatch.mockResolvedValue({ success: true, match_type_updated: true });
            await useResponsesStore.getState().updateResponse('q1', 'yes');
            expect(fetchMatches).toHaveBeenCalledTimes(1);
        });

        it('does not refresh matches for a plain successful response edit', async () => {
            const fetchMatches = jest.fn();
            useMatchStore.setState({ fetchMatches } as any);
            useResponsesStore.setState({ responses: [response()] });
            apiPatch.mockResolvedValue({ success: true });
            await useResponsesStore.getState().updateResponse('q1', 'maybe');
            expect(fetchMatches).not.toHaveBeenCalled();
        });

        it('returns an Error message and leaves state unchanged on API rejection', async () => {
            const original = response();
            useResponsesStore.setState({ responses: [original] });
            apiPatch.mockRejectedValue(new Error('Server error'));
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
            const result = await useResponsesStore.getState().updateResponse('q1', 'no');
            expect(result).toEqual({ success: false, error: 'Server error' });
            expect(useResponsesStore.getState().responses[0]).toEqual(original);
            consoleSpy.mockRestore();
        });

        it('normalizes non-Error rejection values', async () => {
            apiPatch.mockRejectedValue('failed');
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
            await expect(useResponsesStore.getState().updateResponse('q1', 'yes'))
                .resolves.toEqual({ success: false, error: 'Failed to update response' });
            consoleSpy.mockRestore();
        });
    });

    describe('state controls', () => {
        it('sets and toggles grouping options', () => {
            useResponsesStore.getState().setGroupBy('pack');
            expect(useResponsesStore.getState().groupBy).toBe('pack');
            useResponsesStore.getState().setDateSortOrder('oldest');
            expect(useResponsesStore.getState().dateSortOrder).toBe('oldest');
            useResponsesStore.getState().toggleDateSortOrder();
            expect(useResponsesStore.getState().dateSortOrder).toBe('newest');
        });

        it('clears all response-scoped state', () => {
            useResponsesStore.setState({
                responses: [response()], isLoading: true, isLoadingMore: true,
                groupBy: 'pack', dateSortOrder: 'oldest', page: 5,
                hasMore: false, totalCount: 10,
            });
            useResponsesStore.getState().clearResponses();
            expect(useResponsesStore.getState()).toMatchObject({
                responses: [], isLoading: false, isLoadingMore: false,
                groupBy: 'date', dateSortOrder: 'newest', page: 0,
                hasMore: true, totalCount: null,
            });
        });
    });
});

describe('groupResponses', () => {
    const rows: ResponseWithQuestion[] = [
        response(),
        response({ id: 'r2', question_id: 'q2', answer: 'maybe', created_at: '2024-01-15T14:00:00.000Z', question: { ...response().question, id: 'q2', pack_id: 'p2', pack: { id: 'p2', name: 'Pack B', icon: 'moon' } } }),
        response({ id: 'r3', question_id: 'q3', answer: 'no', created_at: '2024-01-14T10:00:00.000Z' }),
        response({ id: 'r4', question_id: 'q4', answer: 'yes', created_at: '2024-01-14T14:00:00.000Z', question: { ...response().question, id: 'q4', pack_id: 'p2', pack: { id: 'p2', name: 'Pack B', icon: 'moon' } } }),
    ];

    it('groups by pack while preserving rows', () => {
        const grouped = groupResponses(rows, 'pack');
        expect(grouped.map((group) => [group.title, group.data.length])).toEqual([['Pack A', 2], ['Pack B', 2]]);
    });

    it('orders non-empty answer groups yes, maybe, no', () => {
        expect(groupResponses(rows, 'answer').map((group) => [group.title, group.data.length]))
            .toEqual([['Yes', 2], ['Maybe', 1], ['No', 1]]);
        expect(groupResponses(rows.filter((row) => row.answer === 'yes'), 'answer').map((group) => group.title))
            .toEqual(['Yes']);
    });

    it('groups dates newest-first and sorts within each day', () => {
        const grouped = groupResponses(rows, 'date', 'newest');
        expect(grouped[0].title).toContain('January 15');
        expect(grouped[1].title).toContain('January 14');
        expect(grouped[0].data.map((row) => row.id)).toEqual(['r2', 'r1']);
    });

    it('groups dates oldest-first and sorts within each day', () => {
        const grouped = groupResponses(rows, 'date', 'oldest');
        expect(grouped[0].title).toContain('January 14');
        expect(grouped[1].title).toContain('January 15');
        expect(grouped[0].data.map((row) => row.id)).toEqual(['r3', 'r4']);
    });

    it('falls back to one section for an unknown grouping option', () => {
        // @ts-expect-error deliberately verifies defensive fallback behavior
        expect(groupResponses(rows, 'unknown')).toEqual([{ title: 'All Responses', data: rows }]);
    });
});
