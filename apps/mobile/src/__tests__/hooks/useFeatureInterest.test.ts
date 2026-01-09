import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useFeatureInterest } from '@/hooks/useFeatureInterest';
import { useAuthStore } from '@/store/authStore';
import { supabase } from '@/lib/supabase';

function createThenableQuery(result: any) {
    const query: any = {
        select: jest.fn(() => query),
        eq: jest.fn(() => query),
        insert: jest.fn(() => query),
        delete: jest.fn(() => query),
        maybeSingle: jest.fn(() => query),
        then: (resolve: any, reject: any) => Promise.resolve(result).then(resolve, reject),
    };
    return query;
}

describe('useFeatureInterest', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        useAuthStore.setState({ user: { id: 'user1' } } as any);
    });

    it('fetches initial interest status as true when interest exists', async () => {
        const query = createThenableQuery({ data: { id: 'interest1' } });
        (supabase.from as jest.Mock).mockReturnValue(query);

        const { result } = renderHook(() => useFeatureInterest('dares'));

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        expect(result.current.isInterested).toBe(true);
        expect(result.current.isAuthenticated).toBe(true);
        expect(query.eq).toHaveBeenCalledWith('user_id', 'user1');
        expect(query.eq).toHaveBeenCalledWith('feature_name', 'dares');
    });

    it('fetches initial interest status as false when no interest exists', async () => {
        const query = createThenableQuery({ data: null });
        (supabase.from as jest.Mock).mockReturnValue(query);

        const { result } = renderHook(() => useFeatureInterest('dares'));

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        expect(result.current.isInterested).toBe(false);
    });

    it('returns isAuthenticated false when user is null', async () => {
        useAuthStore.setState({ user: null } as any);

        const { result } = renderHook(() => useFeatureInterest('dares'));

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        expect(result.current.isAuthenticated).toBe(false);
        expect(result.current.isInterested).toBe(false);
        expect(supabase.from).not.toHaveBeenCalled();
    });

    it('adds interest when toggling from not interested', async () => {
        // Initial query returns no interest
        const initialQuery = createThenableQuery({ data: null });
        const insertQuery = createThenableQuery({ error: null });

        (supabase.from as jest.Mock)
            .mockReturnValueOnce(initialQuery) // Initial fetch
            .mockReturnValueOnce(insertQuery); // Insert on toggle

        const { result } = renderHook(() => useFeatureInterest('dares'));

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        expect(result.current.isInterested).toBe(false);

        await act(async () => {
            await result.current.toggleInterest();
        });

        expect(result.current.isInterested).toBe(true);
        expect(insertQuery.insert).toHaveBeenCalledWith({
            user_id: 'user1',
            feature_name: 'dares',
        });
    });

    it('removes interest when toggling from interested', async () => {
        // Initial query returns existing interest
        const initialQuery = createThenableQuery({ data: { id: 'interest1' } });
        const deleteQuery = createThenableQuery({ error: null });

        (supabase.from as jest.Mock)
            .mockReturnValueOnce(initialQuery) // Initial fetch
            .mockReturnValueOnce(deleteQuery); // Delete on toggle

        const { result } = renderHook(() => useFeatureInterest('dares'));

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        expect(result.current.isInterested).toBe(true);

        await act(async () => {
            await result.current.toggleInterest();
        });

        expect(result.current.isInterested).toBe(false);
        expect(deleteQuery.delete).toHaveBeenCalled();
        expect(deleteQuery.eq).toHaveBeenCalledWith('user_id', 'user1');
        expect(deleteQuery.eq).toHaveBeenCalledWith('feature_name', 'dares');
    });

    it('reverts optimistic update on error', async () => {
        const initialQuery = createThenableQuery({ data: null });
        const insertQuery = createThenableQuery({ error: new Error('Insert failed') });

        (supabase.from as jest.Mock)
            .mockReturnValueOnce(initialQuery)
            .mockReturnValueOnce(insertQuery);

        const { result } = renderHook(() => useFeatureInterest('dares'));

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        expect(result.current.isInterested).toBe(false);

        await act(async () => {
            await result.current.toggleInterest();
        });

        // Should revert to original state after error
        expect(result.current.isInterested).toBe(false);
    });

    it('does not toggle when user is not authenticated', async () => {
        useAuthStore.setState({ user: null } as any);

        const { result } = renderHook(() => useFeatureInterest('dares'));

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        await act(async () => {
            await result.current.toggleInterest();
        });

        // Should not make any API calls
        expect(supabase.from).not.toHaveBeenCalled();
    });

    it('isToggling is false when not toggling', async () => {
        const initialQuery = createThenableQuery({ data: null });

        (supabase.from as jest.Mock).mockReturnValueOnce(initialQuery);

        const { result } = renderHook(() => useFeatureInterest('dares'));

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        expect(result.current.isToggling).toBe(false);
    });

    it('isToggling is false after toggle completes', async () => {
        const initialQuery = createThenableQuery({ data: null });
        const insertQuery = createThenableQuery({ error: null });

        (supabase.from as jest.Mock)
            .mockReturnValueOnce(initialQuery)
            .mockReturnValueOnce(insertQuery);

        const { result } = renderHook(() => useFeatureInterest('dares'));

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        await act(async () => {
            await result.current.toggleInterest();
        });

        expect(result.current.isToggling).toBe(false);
    });
});
