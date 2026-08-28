import { chatApi } from '@/lib/chatApi';
import { useAuthStore } from '@/store/authStore';
import { useMatchStore } from '@/store/matchStore';
import { useMessageStore } from '@/store/messageStore';

jest.mock('@/lib/chatApi', () => ({ chatApi: { unread: jest.fn(), markRead: jest.fn() } }));

describe('messageStore API state', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        useMessageStore.getState().clearMessages();
        useMatchStore.setState({ matches: [{ id: 'm1', unreadCount: 3 } as any] });
        useAuthStore.setState({ user: { id: 'me' } } as any);
    });

    it('fails closed and clears unread state without an authenticated user', async () => {
        useMessageStore.setState({ unreadCount: 7 });
        useAuthStore.setState({ user: null } as any);
        await useMessageStore.getState().fetchUnreadCount();
        expect(useMessageStore.getState().unreadCount).toBe(0);
        expect(chatApi.unread).not.toHaveBeenCalled();
    });

    it('fetches the authenticated API unread aggregate', async () => {
        (chatApi.unread as jest.Mock).mockResolvedValue({ total: 5, by_match: { m1: 5 } });
        await useMessageStore.getState().fetchUnreadCount();
        expect(chatApi.unread).toHaveBeenCalledTimes(1);
        expect(useMessageStore.getState().unreadCount).toBe(5);
    });

    it('propagates unread errors without replacing the last confirmed count', async () => {
        useMessageStore.setState({ unreadCount: 4 });
        const error = new Error('unauthorized');
        (chatApi.unread as jest.Mock).mockRejectedValue(error);
        await expect(useMessageStore.getState().fetchUnreadCount()).rejects.toBe(error);
        expect(useMessageStore.getState().unreadCount).toBe(4);
    });

    it('notifies only for a partner message outside the active match', () => {
        useMessageStore.getState().addMessage({ id: 'mine', user_id: 'me', match_id: 'm1' } as any);
        expect(useMessageStore.getState().unreadCount).toBe(0);
        useMessageStore.getState().setActiveMatchId('m1');
        useMessageStore.getState().addMessage({ id: 'active', user_id: 'partner', match_id: 'm1' } as any);
        expect(useMessageStore.getState().unreadCount).toBe(0);
        useMessageStore.getState().setActiveMatchId('m2');
        useMessageStore.getState().addMessage({ id: 'new', user_id: 'partner', match_id: 'm1' } as any);
        expect(useMessageStore.getState()).toMatchObject({ unreadCount: 1, lastMessage: { id: 'new' } });
    });

    it('marks partner messages read then reconciles global and per-match counts', async () => {
        (chatApi.markRead as jest.Mock).mockResolvedValue({ updated: 2, read_at: '2026-08-27T00:00:00.000Z' });
        (chatApi.unread as jest.Mock).mockResolvedValue({ total: 1, by_match: { m2: 1 } });
        await useMessageStore.getState().markMatchMessagesAsRead('m1');
        expect(chatApi.markRead).toHaveBeenCalledWith('m1');
        expect(useMessageStore.getState().unreadCount).toBe(1);
        expect(useMatchStore.getState().matches[0]?.unreadCount).toBe(1);
    });

    it('does not mark read without an authenticated user', async () => {
        useAuthStore.setState({ user: null } as any);
        await useMessageStore.getState().markMatchMessagesAsRead('m1');
        expect(chatApi.markRead).not.toHaveBeenCalled();
    });

    it('does not decrement local counts when the read API fails', async () => {
        const error = new Error('foreign match');
        (chatApi.markRead as jest.Mock).mockRejectedValue(error);
        await expect(useMessageStore.getState().markMatchMessagesAsRead('m1')).rejects.toBe(error);
        expect(useMatchStore.getState().matches[0]?.unreadCount).toBe(3);
    });

    it('clears transient message state', () => {
        useMessageStore.setState({ unreadCount: 3, lastMessage: { id: 'last' } as any, activeMatchId: 'm1' });
        useMessageStore.getState().clearLastMessage();
        expect(useMessageStore.getState().lastMessage).toBeNull();
        useMessageStore.getState().clearMessages();
        expect(useMessageStore.getState()).toMatchObject({ unreadCount: 0, lastMessage: null, activeMatchId: null });
    });
});
