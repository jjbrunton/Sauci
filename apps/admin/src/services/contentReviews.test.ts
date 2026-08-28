import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CONTENT_STATUS_LABELS } from '@/lib/contentReviewStatus';

const { update } = vi.hoisted(() => ({ update: vi.fn() }));

vi.mock('@/hooks/useAuditedAdminData', () => ({
    auditedAdminData: { update },
}));

import { updateContentReviewStatus } from './contentReviews';

describe('catalogue review labels', () => {
    it('uses archive language for reversible removals', () => {
        expect(CONTENT_STATUS_LABELS).toEqual({
            unreviewed: 'Needs review',
            allowed: 'Allowed',
            archived: 'Archived',
        });
    });

    beforeEach(() => {
        update.mockReset();
        update.mockResolvedValue({ data: null, error: null });
    });

    it('writes a trimmed, audited review decision', async () => {
        await updateContentReviewStatus(
            'question_packs',
            'pack-1',
            'archived',
            '  Store compliance review  ',
        );

        expect(update).toHaveBeenCalledWith('question_packs', 'pack-1', {
            content_status: 'archived',
            content_review_reason: 'Store compliance review',
        });
    });

    it('rejects an empty reason before writing', async () => {
        await expect(
            updateContentReviewStatus('questions', 'question-1', 'allowed', '   '),
        ).rejects.toThrow('A review reason is required');
        expect(update).not.toHaveBeenCalled();
    });
});
