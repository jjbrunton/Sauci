import { describe, expect, it } from 'vitest';
import { isSentDareOverdue, SENT_DARE_STATUS_LABELS } from './sentDares';

describe('SENT_DARE_STATUS_LABELS', () => {
    it('has a label for every documented status', () => {
        for (const status of ['pending', 'active', 'submitted', 'completed', 'expired', 'declined', 'cancelled'] as const) {
            expect(SENT_DARE_STATUS_LABELS[status].label).toBeTruthy();
        }
    });
});

describe('isSentDareOverdue', () => {
    const now = new Date('2026-08-30T12:00:00Z');

    it('is false when there is no expiry', () => {
        expect(isSentDareOverdue('pending', null, now)).toBe(false);
    });

    it('is false for a terminal status even if expiry has passed', () => {
        expect(isSentDareOverdue('completed', '2026-08-01T00:00:00Z', now)).toBe(false);
        expect(isSentDareOverdue('expired', '2026-08-01T00:00:00Z', now)).toBe(false);
    });

    it('is false for an open status whose expiry has not passed', () => {
        expect(isSentDareOverdue('active', '2026-09-01T00:00:00Z', now)).toBe(false);
    });

    it('is true for an open status whose expiry has already passed', () => {
        expect(isSentDareOverdue('pending', '2026-08-01T00:00:00Z', now)).toBe(true);
        expect(isSentDareOverdue('active', '2026-08-01T00:00:00Z', now)).toBe(true);
        expect(isSentDareOverdue('submitted', '2026-08-01T00:00:00Z', now)).toBe(true);
    });
});
