import { useAuthStore } from '@/store/authStore';
import { useMatchStore } from '@/store/matchStore';
import { usePacksStore } from '@/store/packsStore';
import { useMessageStore } from '@/store/messageStore';
import { useSubscriptionStore } from '@/store/subscriptionStore';
import { supabase } from '@/lib/supabase';

describe('authStore', () => {
    beforeEach(() => {
        jest.clearAllMocks();

        useAuthStore.setState({
            user: null,
            couple: null,
            partner: null,
            isLoading: true,
            isAuthenticated: false,
        } as any);

        useMatchStore.setState({ matches: [{ id: 'm1' }], newMatchesCount: 1 } as any);
        usePacksStore.setState({ enabledPackIds: ['p1'] } as any);
        useMessageStore.setState({ unreadCount: 3, lastMessage: { id: 'msg1' }, activeMatchId: 'match1' } as any);
        useSubscriptionStore.setState({ subscription: { isProUser: true } } as any);
    });

    it('sets unauthenticated when no session exists', async () => {
        (supabase.auth.getSession as jest.Mock).mockResolvedValueOnce({ data: { session: null } });

        await useAuthStore.getState().fetchUser();

        const state = useAuthStore.getState();
        expect(state.user).toBeNull();
        expect(state.isAuthenticated).toBe(false);
        expect(state.isLoading).toBe(false);
    });

    it('clears stores and signs out when session invalid', async () => {
        (supabase.auth.getSession as jest.Mock).mockResolvedValueOnce({
            data: { session: { user: { id: 'me' } } },
        });

        (supabase.auth.getUser as jest.Mock).mockResolvedValueOnce({
            data: { user: null },
            error: new Error('invalid'),
        });

        (supabase.auth.signOut as jest.Mock).mockResolvedValueOnce({ error: null });

        await useAuthStore.getState().fetchUser();

        expect(useAuthStore.getState().user).toBeNull();
        expect(useAuthStore.getState().isAuthenticated).toBe(false);

        expect(useMatchStore.getState().matches).toEqual([]);
        expect(usePacksStore.getState().enabledPackIds).toEqual([]);
        expect(useMessageStore.getState().unreadCount).toBe(0);
        expect(useMessageStore.getState().activeMatchId).toBeNull();
        expect(useSubscriptionStore.getState().subscription.isProUser).toBe(false);

        expect(supabase.auth.signOut).toHaveBeenCalled();
    });

    it('fetches couple and partner when couple_id exists', async () => {
        useAuthStore.setState({ user: { id: 'me', couple_id: 'c1' } } as any);

        const couplesQuery: any = {
            select: jest.fn(() => couplesQuery),
            eq: jest.fn(() => couplesQuery),
            maybeSingle: jest.fn(async () => ({ data: { id: 'c1' } })),
        };

        const partnerQuery: any = {
            select: jest.fn(() => partnerQuery),
            eq: jest.fn(() => partnerQuery),
            neq: jest.fn(() => partnerQuery),
            maybeSingle: jest.fn(async () => ({ data: { id: 'partner' } })),
        };

        (supabase.from as jest.Mock).mockImplementation((table: string) => {
            if (table === 'couples') return couplesQuery;
            if (table === 'profiles') return partnerQuery;
            return couplesQuery;
        });

        await useAuthStore.getState().fetchCouple();

        expect(useAuthStore.getState().couple).toEqual({ id: 'c1' });
        expect(useAuthStore.getState().partner).toEqual({ id: 'partner' });
    });

    it('signOut clears local state even if Supabase fails', async () => {
        (supabase.auth.signOut as jest.Mock).mockRejectedValueOnce(new Error('network'));

        await useAuthStore.getState().signOut();

        expect(useAuthStore.getState().user).toBeNull();
        expect(useAuthStore.getState().isAuthenticated).toBe(false);
        expect(useAuthStore.getState().isLoading).toBe(false);
    });
});
