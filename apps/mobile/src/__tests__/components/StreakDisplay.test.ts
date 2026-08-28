import { streakStatus } from '@/components/StreakDisplay';
import type { CoupleStreak } from '@/store/streakStore';

const streak = (overrides: Partial<CoupleStreak>): CoupleStreak => ({
    couple_id: 'couple-1',
    current_streak: 6,
    longest_streak: 9,
    last_active_date: '2026-08-28',
    last_completed_date: '2026-08-27',
    you_answered_today: false,
    partner_answered_today: false,
    partner_name: 'Alex',
    timezone: 'Europe/London',
    streak_celebrated_at: 0,
    created_at: '2026-08-01T00:00:00.000Z',
    updated_at: '2026-08-28T00:00:00.000Z',
    ...overrides,
});

describe('streakStatus', () => {
    it('frames the count as the couple rather than as a personal score', () => {
        expect(streakStatus(streak({})).headline).toBe('You and Alex — 6 days in a row');
        expect(streakStatus(streak({ current_streak: 1 })).headline).toBe('You and Alex — 1 day in a row');
    });

    it('names the partner who moved first so the day has somebody to answer to', () => {
        expect(streakStatus(streak({ partner_answered_today: true })).status)
            .toBe('Alex has answered today — your turn');
        expect(streakStatus(streak({ you_answered_today: true })).status)
            .toBe('Answered. Waiting on Alex');
    });

    it('settles once both partners have answered', () => {
        expect(streakStatus(streak({ you_answered_today: true, partner_answered_today: true })).status)
            .toBe("You've both answered today");
    });

    it('invites rather than warns when the day is still untouched', () => {
        expect(streakStatus(streak({})).status).toBe('One question each keeps it going');
        expect(streakStatus(streak({ current_streak: 0 })).status).toBe('Answer together to start a streak');
    });

    it('falls back to a neutral label when the partner has no name yet', () => {
        const anonymous = streak({ partner_name: null, partner_answered_today: true });
        expect(streakStatus(anonymous).headline).toBe('You and your partner — 6 days in a row');
        expect(streakStatus(anonymous).status).toBe('Your partner has answered today — your turn');
    });
});
