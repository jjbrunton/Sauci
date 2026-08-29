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

/**
 * A change summary, not a payload: markers the client compares against the ones
 * it saw last time to decide which domain, if any, is worth refetching. It
 * replaces a periodic full refresh of profile, couple, matches, pending
 * questions, packs and unread counts with one small request.
 */
export interface SyncSummary {
  server_time: string;
  couple_id: string | null;
  profile_updated_at: string | null;
  partner_id: string | null;
  partner_updated_at: string | null;
  match_count: number;
  new_match_count: number;
  latest_match_at: string | null;
  pending_yours: number;
  pending_theirs: number;
  unread_total: number;
  /** couple_packs carries no timestamp, so equal-and-opposite toggles are caught by a digest. */
  enabled_packs_fingerprint: string | null;
  /** Digest of each visible match's type and response summary; moves on an in-place response edit that the count/latest-at markers miss. */
  match_state_fingerprint: string;
  /** Digest of each visible match's unread count; moves when unread redistributes between matches without changing the total. */
  match_unread_fingerprint: string;
  /** couple_streaks.updated_at, so a partner's answer can silently refresh an already-loaded streak. */
  streak_updated_at: string | null;
}

export const appDataApi = {
  syncSummary: () => apiClient.get<SyncSummary>('/v1/me/sync'),
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
