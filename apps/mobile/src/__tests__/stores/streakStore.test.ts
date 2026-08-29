import { apiClient } from '@/lib/apiClient';
import { useAuthStore } from '@/store/authStore';
import { type CoupleStreak, useStreakStore } from '@/store/streakStore';

jest.mock('@/lib/apiClient', () => ({ apiClient: { get: jest.fn() } }));

const apiGet = apiClient.get as jest.Mock;

function streak(overrides: Partial<CoupleStreak> = {}): CoupleStreak {
    return {
        couple_id: 'couple1', current_streak: 1, longest_streak: 1,
        last_active_date: '2026-08-27', last_completed_date: '2026-08-27',
        you_answered_today: true, partner_answered_today: false,
        partner_name: 'Partner', timezone: 'UTC', streak_celebrated_at: 0,
        created_at: '2026-08-01T00:00:00.000Z', updated_at: '2026-08-27T00:00:00.000Z',
        ...overrides,
    };
}

describe('streakStore account isolation (generation tokens)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        useStreakStore.setState({ streak: null, isLoading: false, error: null, loadedAt: null, generation: 0 });
        useAuthStore.setState({ user: { id: 'me', couple_id: 'couple1' } } as any);
    });

    it('does not let a stale fetchStreak response populate the store after clearStreak, and lets the next account start immediately', async () => {
        let resolve!: (value: unknown) => void;
        apiGet.mockReturnValueOnce(new Promise((done) => { resolve = done; }));
        const staleFetch = useStreakStore.getState().fetchStreak();

        // Simulates sign-out/account switch while the request is still in flight.
        useStreakStore.getState().clearStreak();
        resolve({ streak: streak({ couple_id: 'stale-couple' }) });
        await staleFetch;

        expect(useStreakStore.getState().streak).toBeNull();
        expect(useStreakStore.getState().loadedAt).toBeNull();

        apiGet.mockResolvedValueOnce({ streak: streak({ couple_id: 'fresh-couple' }) });
        await useStreakStore.getState().fetchStreak();
        expect(useStreakStore.getState().streak?.couple_id).toBe('fresh-couple');
        expect(useStreakStore.getState().loadedAt).not.toBeNull();
    });

    it('refreshStreak silently reloads only an already-loaded streak', async () => {
        await useStreakStore.getState().refreshStreak();
        expect(apiGet).not.toHaveBeenCalled();

        apiGet.mockResolvedValueOnce({ streak: streak() });
        await useStreakStore.getState().fetchStreak();
        expect(useStreakStore.getState().loadedAt).not.toBeNull();

        apiGet.mockResolvedValueOnce({ streak: streak({ current_streak: 2 }) });
        await useStreakStore.getState().refreshStreak();
        expect(useStreakStore.getState().streak?.current_streak).toBe(2);
    });
});
