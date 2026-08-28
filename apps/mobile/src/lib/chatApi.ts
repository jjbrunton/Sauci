import { apiClient } from './apiClient';
import type { Message, ReportReason } from '../features/chat/types';

export const chatApi = {
    listMessages: (matchId: string) => apiClient.get<{ messages: Message[] }>(`/v1/matches/${encodeURIComponent(matchId)}/messages`),
    sendText: (matchId: string, content: string) => apiClient.post<{ message: Message }>(`/v1/matches/${encodeURIComponent(matchId)}/messages`, { content }),
    unread: () => apiClient.get<{ total: number; by_match: Record<string, number> }>('/v1/chat/unread'),
    markRead: (matchId: string) => apiClient.post<{ updated: number; read_at: string }>(`/v1/matches/${encodeURIComponent(matchId)}/read`),
    markDelivered: (messageId: string) => apiClient.post<{ message: Message }>(`/v1/messages/${encodeURIComponent(messageId)}/delivered`),
    deleteForSelf: (messageId: string) => apiClient.delete<{ deleted: true }>(`/v1/messages/${encodeURIComponent(messageId)}?scope=self`),
    deleteForEveryone: (messageId: string) => apiClient.delete<{ deleted: true; message: Message }>(`/v1/messages/${encodeURIComponent(messageId)}?scope=everyone`),
    report: (messageId: string, reason: ReportReason) => apiClient.post<{ reported: true }>(`/v1/messages/${encodeURIComponent(messageId)}/reports`, { reason }),
    setTyping: (matchId: string) => apiClient.put<{ typing: true }>(`/v1/matches/${encodeURIComponent(matchId)}/typing`),
    getTyping: (matchId: string) => apiClient.get<{ typing: boolean; expires_at: string | null }>(`/v1/matches/${encodeURIComponent(matchId)}/typing`),
};
