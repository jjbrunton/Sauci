import { apiClient } from './apiClient';
import type { Message, ReportReason } from '../features/chat/types';

export interface PartnerTyping {
    typing: boolean;
    expires_at: string | null;
}

/**
 * A snapshot when `complete`, otherwise only what changed since the cursor the
 * previous page handed back. Delta rows are whole messages, not patches, so a
 * caller merges them by id without a second shape to understand.
 */
export interface MessagesPage {
    messages: Message[];
    /** Messages the caller deleted for themselves since the cursor. */
    removed_ids?: string[];
    /** Cursor to send as `since` on the next poll. */
    server_time?: string;
    complete?: boolean;
    /** Present when requested, saving a separate typing request. */
    typing?: PartnerTyping;
}

export interface ListMessagesOptions {
    since?: string;
    typing?: boolean;
}

export const chatApi = {
    listMessages: (matchId: string, options: ListMessagesOptions = {}) => {
        const query: string[] = [];
        if (options.since) query.push(`since=${encodeURIComponent(options.since)}`);
        if (options.typing) query.push('typing=true');
        const suffix = query.length > 0 ? `?${query.join('&')}` : '';
        return apiClient.get<MessagesPage>(`/v1/matches/${encodeURIComponent(matchId)}/messages${suffix}`);
    },
    sendText: (matchId: string, content: string) => apiClient.post<{ message: Message }>(`/v1/matches/${encodeURIComponent(matchId)}/messages`, { content }),
    unread: () => apiClient.get<{ total: number; by_match: Record<string, number> }>('/v1/chat/unread'),
    markRead: (matchId: string) => apiClient.post<{ updated: number; read_at: string }>(`/v1/matches/${encodeURIComponent(matchId)}/read`),
    markDelivered: (messageId: string) => apiClient.post<{ message: Message }>(`/v1/messages/${encodeURIComponent(messageId)}/delivered`),
    deleteForSelf: (messageId: string) => apiClient.delete<{ deleted: true }>(`/v1/messages/${encodeURIComponent(messageId)}?scope=self`),
    deleteForEveryone: (messageId: string) => apiClient.delete<{ deleted: true; message: Message }>(`/v1/messages/${encodeURIComponent(messageId)}?scope=everyone`),
    report: (messageId: string, reason: ReportReason) => apiClient.post<{ reported: true }>(`/v1/messages/${encodeURIComponent(messageId)}/reports`, { reason }),
    setTyping: (matchId: string) => apiClient.put<{ typing: true }>(`/v1/matches/${encodeURIComponent(matchId)}/typing`),
    getTyping: (matchId: string) => apiClient.get<PartnerTyping>(`/v1/matches/${encodeURIComponent(matchId)}/typing`),
};
