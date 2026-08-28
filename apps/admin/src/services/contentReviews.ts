import type { ContentReviewStatus } from '@sauci/shared';
import { auditedAdminData } from '@/hooks/useAuditedAdminData';
export { CONTENT_STATUS_LABELS } from '@/lib/contentReviewStatus';

export type ReviewableContentTable =
    | 'categories'
    | 'question_packs'
    | 'questions'
    | 'dare_packs'
    | 'dares';

export async function updateContentReviewStatus(
    table: ReviewableContentTable,
    id: string,
    status: ContentReviewStatus,
    reason: string,
): Promise<void> {
    const normalizedReason = reason.trim();
    if (!normalizedReason) {
        throw new Error('A review reason is required');
    }

    const { error } = await auditedAdminData.update(table, id, {
        content_status: status,
        content_review_reason: normalizedReason,
    });

    if (error) throw error;
}
