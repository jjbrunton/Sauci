export const mediaKinds = ['avatar', 'response', 'chat', 'feedback', 'dare_proof'] as const;
export type MediaKind = typeof mediaKinds[number];

export interface MediaObject {
  id: string;
  owner_id: string;
  couple_id: string | null;
  kind: MediaKind;
  storage_key: string;
  mime_type: string;
  byte_size: number;
  question_id: string | null;
  match_id: string | null;
  expires_at: string | null;
}

export interface MediaUploadContext {
  questionId?: string;
  matchId?: string;
}

