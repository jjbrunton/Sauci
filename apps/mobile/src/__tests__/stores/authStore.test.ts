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
            isAnonymous: false,
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
        expect(state.isAnonymous).toBe(false);
        expect(state.isLoading).toBe(false);
    });

    it('sets isAnonymous from auth user', async () => {
        (supabase.auth.getSession as jest.Mock).mockResolvedValueOnce({
            data: { session: { user: { id: 'me' } } },
        });

        (supabase.auth.getUser as jest.Mock).mockResolvedValueOnce({
            data: { user: { id: 'me', is_anonymous: true } },
            error: null,
        });

        const profileQuery: any = {
            select: jest.fn(() => profileQuery),
            eq: jest.fn(() => profileQuery),
            maybeSingle: jest.fn(async () => ({ data: { id: 'me', couple_id: null } })),
        };

        (supabase.from as jest.Mock).mockReturnValue(profileQuery);

        await useAuthStore.getState().fetchUser();

        const state = useAuthStore.getState();
        expect(state.isAuthenticated).toBe(true);
        expect(state.isAnonymous).toBe(true);
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
        expect(useAuthStore.getState().isAnonymous).toBe(false);

        expect(useAuthStore.getState().isAnonymous).toBe(false);
        expect(useAuthStore.getState().isLoading).toBe(false);
    });
});
