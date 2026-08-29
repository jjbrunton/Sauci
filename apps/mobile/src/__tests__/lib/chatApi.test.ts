import { apiClient } from '@/lib/apiClient';
import { chatApi } from '@/lib/chatApi';

jest.mock('@/lib/apiClient', () => ({ apiClient: { get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn() } }));

describe('chatApi', () => {
    beforeEach(() => jest.clearAllMocks());

    it('uses match-scoped message and typing routes', async () => {
        (apiClient.get as jest.Mock).mockResolvedValue({ messages: [] });
        (apiClient.post as jest.Mock).mockResolvedValue({ message: { id: 'message' } });
        (apiClient.put as jest.Mock).mockResolvedValue({ typing: true });

        await chatApi.listMessages('match/id');
        await chatApi.sendText('match/id', 'hello');
        await chatApi.markRead('match/id');
        await chatApi.setTyping('match/id');
        await chatApi.getTyping('match/id');

        expect(apiClient.get).toHaveBeenNthCalledWith(1, '/v1/matches/match%2Fid/messages');
        expect(apiClient.post).toHaveBeenNthCalledWith(1, '/v1/matches/match%2Fid/messages', { content: 'hello' });
        expect(apiClient.post).toHaveBeenNthCalledWith(2, '/v1/matches/match%2Fid/read');
        expect(apiClient.put).toHaveBeenCalledWith('/v1/matches/match%2Fid/typing');
        expect(apiClient.get).toHaveBeenNthCalledWith(2, '/v1/matches/match%2Fid/typing');
    });

    it('encodes the delta cursor and folded typing request into the message query', async () => {
        (apiClient.get as jest.Mock).mockResolvedValue({ messages: [], removed_ids: [], server_time: 'now', complete: false });

        await chatApi.listMessages('match1', { typing: true });
        await chatApi.listMessages('match1', { since: '2026-08-27T12:00:00.000+01:00' });
        await chatApi.listMessages('match1', { since: '2026-08-27T12:00:00.000Z', typing: true });

        expect(apiClient.get).toHaveBeenNthCalledWith(1, '/v1/matches/match1/messages?typing=true');
        expect(apiClient.get).toHaveBeenNthCalledWith(2, '/v1/matches/match1/messages?since=2026-08-27T12%3A00%3A00.000%2B01%3A00');
        expect(apiClient.get).toHaveBeenNthCalledWith(3, '/v1/matches/match1/messages?since=2026-08-27T12%3A00%3A00.000Z&typing=true');
    });

    it('uses authenticated unread, receipt, deletion and reporting routes', async () => {
        (apiClient.get as jest.Mock).mockResolvedValue({ total: 0, by_match: {} });
        (apiClient.post as jest.Mock).mockResolvedValue({});
        (apiClient.delete as jest.Mock).mockResolvedValue({ deleted: true });

        await chatApi.unread();
        await chatApi.markDelivered('message/id');
        await chatApi.deleteForSelf('message/id');
        await chatApi.deleteForEveryone('message/id');
        await chatApi.report('message/id', 'harassment');

        expect(apiClient.get).toHaveBeenCalledWith('/v1/chat/unread');
        expect(apiClient.post).toHaveBeenNthCalledWith(1, '/v1/messages/message%2Fid/delivered');
        expect(apiClient.delete).toHaveBeenNthCalledWith(1, '/v1/messages/message%2Fid?scope=self');
        expect(apiClient.delete).toHaveBeenNthCalledWith(2, '/v1/messages/message%2Fid?scope=everyone');
        expect(apiClient.post).toHaveBeenNthCalledWith(2, '/v1/messages/message%2Fid/reports', { reason: 'harassment' });
    });

    it('propagates API authorization and tenancy errors', async () => {
        const forbidden = new Error('match not found');
        (apiClient.get as jest.Mock).mockRejectedValue(forbidden);
        await expect(chatApi.listMessages('foreign-match')).rejects.toBe(forbidden);
    });
});
