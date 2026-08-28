import type { ContentReviewStatus } from '@sauci/shared';

export const CONTENT_STATUS_LABELS: Record<ContentReviewStatus, string> = {
    unreviewed: 'Needs review',
    allowed: 'Allowed',
    archived: 'Archived',
};
