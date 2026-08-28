import { apiClient } from './apiClient';
import type { Question } from '../types';
import type { Match } from '../features/chat/types';
import type { StrokeSegment } from '../features/live-draw/types';

export interface LiveDrawState {
  strokes: StrokeSegment[];
  revision: number;
  updated_at: string | null;
  updated_by: string | null;
}

export const appDataApi = {
  packContext: (packId: string) => apiClient.get<{ pack: { id: string; name: string; icon: string | null } }>(`/v1/packs/${encodeURIComponent(packId)}/context`),
  packQuestions: (packId: string) => apiClient.get<{ questions: Question[] }>(`/v1/packs/${encodeURIComponent(packId)}/questions`),
  packTeaser: (packId: string) => apiClient.get<{ questions: Array<{ id: string; text: string; intensity: number }> }>(`/v1/packs/${encodeURIComponent(packId)}/teaser`),
  matchContext: (matchId: string) => apiClient.get<{ match: Match }>(`/v1/matches/${encodeURIComponent(matchId)}/context`),
  markMediaViewed: (messageId: string, expiresAt: string | null) => apiClient.patch<{ media_viewed_at: string; media_expires_at: string | null }>(`/v1/messages/${encodeURIComponent(messageId)}/media-viewed`, { expires_at: expiresAt }),
  nudgeStatus: () => apiClient.get<{ last_nudge_sent_at: string | null }>('/v1/me/nudge-status'),
  sendNudge: () => apiClient.post<{ success: true; notification_sent: boolean; reason?: string; next_nudge_available_at: string }>('/v1/me/nudge'),
  getLiveDraw: () => apiClient.get<LiveDrawState>('/v1/live-draw'),
  putLiveDraw: (strokes: StrokeSegment[], baseRevision: number) => apiClient.put<LiveDrawState>('/v1/live-draw', { strokes, base_revision: baseRevision }),
};
