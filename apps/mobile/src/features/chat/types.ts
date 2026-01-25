import { Database } from '../../types/supabase';
import { ResponseData } from '@sauci/shared';

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
    match_type: 'yes_yes' | 'yes_maybe' | 'maybe_maybe' | 'both_answered';
    created_at: string;
    /** Summary of both partners' response data (keyed by user_id) for non-swipe questions */
    response_summary?: Record<string, ResponseData> | null;
    question?: {
        id: string;
        text: string;
        partner_text?: string;
    };
    responses?: Array<{
        user_id: string;
        answer: string;
        created_at: string;
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

/** Report reasons for message reporting */
export type ReportReason = 'harassment' | 'spam' | 'inappropriate_content' | 'other';

export const REPORT_REASONS: { value: ReportReason; label: string }[] = [
    { value: 'harassment', label: 'Harassment' },
    { value: 'spam', label: 'Spam' },
    { value: 'inappropriate_content', label: 'Inappropriate Content' },
    { value: 'other', label: 'Other' },
];
