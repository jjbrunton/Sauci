import { useMessageStore } from '@/store/messageStore';
import { useAuthStore } from '@/store/authStore';
import { supabase } from '@/lib/supabase';

function createThenableQuery(result: any) {
    const query: any = {
        select: jest.fn(() => query),
        neq: jest.fn(() => query),
        is: jest.fn(() => query),
        eq: jest.fn(() => query),
        update: jest.fn(() => query),
        then: (resolve: any, reject: any) => Promise.resolve(result).then(resolve, reject),
    };
    return query;
}

describe('messageStore', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        useMessageStore.setState({ unreadCount: 0, lastMessage: null, activeMatchId: null } as any);
        useAuthStore.setState({ user: { id: 'me' } } as any);
    });

    it('fetchUnreadCount sets unreadCount from Supabase count', async () => {
        const countQuery = createThenableQuery({ count: 5 });
        (supabase.from as jest.Mock).mockReturnValueOnce(countQuery);

        await useMessageStore.getState().fetchUnreadCount();

        expect(useMessageStore.getState().unreadCount).toBe(5);
    });

    it('addMessage increments unreadCount when not in active chat', () => {
        useMessageStore.getState().addMessage({ id: 'x', user_id: 'partner', match_id: 'm1' } as any);
        expect(useMessageStore.getState().unreadCount).toBe(1);
    });

    it('addMessage does not increment when in active chat', () => {
        useMessageStore.getState().setActiveMatchId('m1');
        useMessageStore.getState().addMessage({ id: 'x', user_id: 'partner', match_id: 'm1' } as any);
        expect(useMessageStore.getState().unreadCount).toBe(0);
    });

    it('markMatchMessagesAsRead updates Supabase and refetches unread count', async () => {
        const updateQuery = createThenableQuery({});
        const countQuery = createThenableQuery({ count: 0 });

        (supabase.from as jest.Mock)
            .mockReturnValueOnce(updateQuery)
            .mockReturnValueOnce(countQuery);

        await useMessageStore.getState().markMatchMessagesAsRead('m1');

        expect(updateQuery.update).toHaveBeenCalled();
        expect(useMessageStore.getState().unreadCount).toBe(0);
    });
});
