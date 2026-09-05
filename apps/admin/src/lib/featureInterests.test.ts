import { describe, expect, it } from 'vitest';
import { formatFeatureName, toRecentFeatureInterest } from './featureInterests';

describe('toRecentFeatureInterest', () => {
    it('preserves the standalone API feature field for dashboard rendering', () => {
        const interest = toRecentFeatureInterest({
            id: 'interest-1',
            user_id: 'user-1',
            feature: 'better_chat',
            created_at: '2026-09-05T12:00:00.000Z',
        });

        expect(interest.feature).toBe('better_chat');
        expect(formatFeatureName(interest.feature)).toBe('Better Chat');
    });
});
