import { Database } from '../../types/supabase';

/** Message type from database */
export type Message = Database['public']['Tables']['messages']['Row'];

/** Upload status for skeleton display */
export type UploadStatus = {
    mediaType: 'image' | 'video';
    status: 'compressing' | 'uploading';
    thumbnailUri?: string;
} | null;

/** Match type with question and responses */
export interface Match {
    id: string;
    question_id: string;
    couple_id: string;
    match_type: 'yes_yes' | 'yes_maybe' | 'maybe_maybe';
    created_at: string;
    question?: {
        id: string;
        text: string;
        partner_text?: string;
    };
    responses?: Array<{
        user_id: string;
        answer: string;
        profiles?: {
            name?: string;
        };
    }>;
}

/** Chat color palette constants */
export const CHAT_COLORS = {
    ACCENT: 'rgb(212, 175, 55)', // colors.premium.gold
    ACCENT_DARK: 'rgb(184, 134, 11)',
    ACCENT_RGBA: 'rgba(212, 175, 55, ',
    ROSE: 'rgb(232, 164, 174)',
    ROSE_RGBA: 'rgba(232, 164, 174, ',
} as const;
