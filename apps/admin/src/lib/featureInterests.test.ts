import { describe, expect, it } from 'vitest';
import { featureInterestKey, formatFeatureName, toRecentFeatureInterest } from './featureInterests';

describe('toRecentFeatureInterest', () => {
    it('preserves the standalone API feature field for dashboard rendering', () => {
        const interest = toRecentFeatureInterest({
            user_id: 'user-1',
            feature: 'better_chat',
            created_at: '2026-09-05T12:00:00.000Z',
        });

        expect(interest).toEqual({
            user_id: 'user-1',
            feature: 'better_chat',
            created_at: '2026-09-05T12:00:00.000Z',
        });
        expect(formatFeatureName(interest.feature)).toBe('Better Chat');
        expect(featureInterestKey(interest)).toBe('user-1:better_chat');
    });
});
