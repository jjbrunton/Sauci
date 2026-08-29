import { act, renderHook } from '@testing-library/react-native';
import { useCoupleSync, SYNC_INTERVAL_MS } from '@/hooks/useCoupleSync';
import { appDataApi, type SyncSummary } from '@/lib/appDataApi';
import { useAuthStore } from '@/store/authStore';
import { useMatchStore } from '@/store/matchStore';
import { useMessageStore } from '@/store/messageStore';
import { usePacksStore } from '@/store/packsStore';
import { useStreakStore } from '@/store/streakStore';

jest.mock('@/lib/appDataApi', () => ({ appDataApi: { syncSummary: jest.fn() } }));

const mockForeground = { value: true };
const mockListeners = new Set<(foreground: boolean) => void>();
jest.mock('@/lib/appForeground', () => ({
    isForeground: () => mockForeground.value,
    subscribeToForeground: (listener: (foreground: boolean) => void) => {
        mockListeners.add(listener);
        return () => { mockListeners.delete(listener); };
    },
}));

const baseline: SyncSummary = {
    server_time: '2026-08-27T12:00:00.000Z',
    couple_id: 'couple',
    profile_updated_at: '2026-08-01T00:00:00.000Z',
    partner_id: 'partner',
    partner_updated_at: '2026-08-01T00:00:00.000Z',
    match_count: 3,
    new_match_count: 0,
    latest_match_at: '2026-08-20T00:00:00.000Z',
    pending_yours: 1,
    pending_theirs: 2,
    unread_total: 0,
    enabled_packs_fingerprint: 'digest-a',
    match_state_fingerprint: 'state-a',
    match_unread_fingerprint: 'unread-a',
    streak_updated_at: '2026-08-01T00:00:00.000Z',
};

const flush = async () => { await act(async () => { await Promise.resolve(); await Promise.resolve(); }); };
const tick = async () => {
    await flush();
    await act(async () => { jest.advanceTimersByTime(SYNC_INTERVAL_MS); });
    await flush();
};

/** Replaces every domain refresh the sync can dispatch with a counter. */
function stubRefreshers() {
    const fetchUser = jest.fn(async () => undefined);
    const fetchCouple = jest.fn(async () => undefined);
    const fetchMatches = jest.fn(async () => undefined);
    const fetchPendingQuestions = jest.fn(async () => undefined);
    const fetchTheirTurnQuestions = jest.fn(async () => undefined);
    const fetchEnabledPacks = jest.fn(async () => undefined);
    const refreshStreak = jest.fn(async () => undefined);
    useAuthStore.setState({ fetchUser, fetchCouple } as never);
    useMatchStore.setState({ fetchMatches, fetchPendingQuestions, fetchTheirTurnQuestions } as never);
    usePacksStore.setState({ fetchEnabledPacks } as never);
    useStreakStore.setState({ refreshStreak } as never);
    return { fetchUser, fetchCouple, fetchMatches, fetchPendingQuestions, fetchTheirTurnQuestions, fetchEnabledPacks, refreshStreak };
}

describe('useCoupleSync', () => {
    let refreshers: ReturnType<typeof stubRefreshers>;
    const originals = {
        auth: { fetchUser: useAuthStore.getState().fetchUser, fetchCouple: useAuthStore.getState().fetchCouple },
        match: {
            fetchMatches: useMatchStore.getState().fetchMatches,
            fetchPendingQuestions: useMatchStore.getState().fetchPendingQuestions,
            fetchTheirTurnQuestions: useMatchStore.getState().fetchTheirTurnQuestions,
        },
        packs: { fetchEnabledPacks: usePacksStore.getState().fetchEnabledPacks },
        streak: { refreshStreak: useStreakStore.getState().refreshStreak },
    };

    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers();
        mockForeground.value = true;
        mockListeners.clear();
        useMessageStore.setState({ unreadCount: 0 });
        // Every view starts loaded: this hook must refresh only what is on screen,
        // and the "not loaded" case is asserted separately below.
        useMatchStore.setState({ loadedAt: { active: 1, pending: 1, their_turn: 1 } });
        usePacksStore.setState({ enabledPacksLoadedAt: Date.now() });
        refreshers = stubRefreshers();
    });
    afterEach(() => {
        jest.useRealTimers();
        useAuthStore.setState(originals.auth as never);
        useMatchStore.setState({ ...originals.match, loadedAt: {} } as never);
        usePacksStore.setState({ ...originals.packs, enabledPacksLoadedAt: null } as never);
        useStreakStore.setState(originals.streak as never);
    });

    const answer = (...summaries: SyncSummary[]) => {
        const mock = appDataApi.syncSummary as jest.Mock;
        mock.mockReset();
        for (const summary of summaries) mock.mockResolvedValueOnce(summary);
        mock.mockResolvedValue(summaries[summaries.length - 1]);
    };

    it('spends one request per interval and refreshes nothing while the markers hold still', async () => {
        answer(baseline);
        renderHook(() => useCoupleSync('me', 'couple'));
        await flush();
        expect(appDataApi.syncSummary).toHaveBeenCalledTimes(1);

        await tick();
        await tick();
        expect(appDataApi.syncSummary).toHaveBeenCalledTimes(3);
        // Three polls, three requests in total: the baseline poll must not trigger
        // the refresh of five domains that the old five-second sweep performed.
        for (const refresh of Object.values(refreshers)) expect(refresh).not.toHaveBeenCalled();
    });

    it('applies the unread total from the summary without a second request', async () => {
        answer(baseline, { ...baseline, unread_total: 4 });
        renderHook(() => useCoupleSync('me', 'couple'));
        await flush();
        await tick();
        expect(useMessageStore.getState().unreadCount).toBe(4);
    });

    it('refreshes only the domain whose marker moved', async () => {
        answer(baseline, { ...baseline, latest_match_at: '2026-08-28T00:00:00.000Z', match_count: 4 });
        renderHook(() => useCoupleSync('me', 'couple'));
        await flush();
        await tick();
        expect(refreshers.fetchMatches).toHaveBeenCalledWith(true, { silent: true });
        expect(refreshers.fetchPendingQuestions).not.toHaveBeenCalled();
        expect(refreshers.fetchTheirTurnQuestions).not.toHaveBeenCalled();
        expect(refreshers.fetchEnabledPacks).not.toHaveBeenCalled();
        expect(refreshers.fetchUser).not.toHaveBeenCalled();
        expect(refreshers.fetchCouple).not.toHaveBeenCalled();
    });

    it('routes each remaining marker to its own domain', async () => {
        answer(baseline, {
            ...baseline,
            pending_yours: 2,
            pending_theirs: 3,
            enabled_packs_fingerprint: 'digest-b',
            partner_updated_at: '2026-08-29T00:00:00.000Z',
            streak_updated_at: '2026-08-29T00:00:00.000Z',
        });
        renderHook(() => useCoupleSync('me', 'couple'));
        await flush();
        await tick();
        expect(refreshers.fetchPendingQuestions).toHaveBeenCalledWith({ silent: true });
        expect(refreshers.fetchTheirTurnQuestions).toHaveBeenCalledWith({ silent: true });
        expect(refreshers.fetchEnabledPacks).toHaveBeenCalledTimes(1);
        expect(refreshers.refreshStreak).toHaveBeenCalledTimes(1);
        // A partner profile change is a couple-level read; the whole user is only
        // re-read when the user's own profile or couple membership moved.
        expect(refreshers.fetchCouple).toHaveBeenCalledTimes(1);
        expect(refreshers.fetchUser).not.toHaveBeenCalled();
        expect(refreshers.fetchMatches).not.toHaveBeenCalled();
    });

    it('refreshes a loaded Matches view when the match-state fingerprint moves in place', async () => {
        // Counts and latest-created-at do not move for an in-place match_type/
        // response_summary edit; only the state fingerprint does.
        answer(baseline, { ...baseline, match_state_fingerprint: 'state-b' });
        renderHook(() => useCoupleSync('me', 'couple'));
        await flush();
        await tick();
        expect(refreshers.fetchMatches).toHaveBeenCalledWith(true, { silent: true });
    });

    it('refreshes a loaded Matches view when unread redistributes without changing the total', async () => {
        // One match is read while another receives a message: unread_total holds
        // steady but the per-match fingerprint (and unread-first ordering) moves.
        answer(baseline, { ...baseline, unread_total: baseline.unread_total, match_unread_fingerprint: 'unread-b' });
        renderHook(() => useCoupleSync('me', 'couple'));
        await flush();
        await tick();
        expect(refreshers.fetchMatches).toHaveBeenCalledWith(true, { silent: true });
    });

    it('does not refresh enabled packs when that domain has never been opened', async () => {
        usePacksStore.setState({ enabledPacksLoadedAt: null });
        answer(baseline, { ...baseline, enabled_packs_fingerprint: 'digest-b' });
        renderHook(() => useCoupleSync('me', 'couple'));
        await flush();
        await tick();
        expect(refreshers.fetchEnabledPacks).not.toHaveBeenCalled();
    });

    it('resets the baseline when the account identity changes, instead of diffing against the prior account', async () => {
        answer({ ...baseline, match_count: 3 });
        const { rerender } = renderHook(
            ({ userId, coupleId }: { userId: string; coupleId: string }) => useCoupleSync(userId, coupleId),
            { initialProps: { userId: 'alice', coupleId: 'couple-a' } },
        );
        await flush();
        await tick(); // establishes alice's baseline (match_count: 3)

        // Switch accounts: bob's couple has a completely different match_count.
        // Without a baseline reset this would look like a 12-count jump and
        // trigger a refresh purely from comparing across accounts.
        answer({ ...baseline, couple_id: 'couple-b', match_count: 15 });
        rerender({ userId: 'bob', coupleId: 'couple-b' });
        await flush();
        expect(refreshers.fetchMatches).not.toHaveBeenCalled();

        await tick();
        expect(refreshers.fetchMatches).not.toHaveBeenCalled();
    });

    it('re-reads the user once when the profile moves, instead of the couple as well', async () => {
        answer(baseline, {
            ...baseline,
            profile_updated_at: '2026-08-29T00:00:00.000Z',
            partner_updated_at: '2026-08-29T00:00:00.000Z',
        });
        renderHook(() => useCoupleSync('me', 'couple'));
        await flush();
        await tick();
        expect(refreshers.fetchUser).toHaveBeenCalledTimes(1);
        expect(refreshers.fetchCouple).not.toHaveBeenCalled();
    });

    it('leaves views the user has never opened unloaded', async () => {
        useMatchStore.setState({ loadedAt: {} });
        answer(baseline, {
            ...baseline,
            match_count: 9,
            latest_match_at: '2026-08-29T00:00:00.000Z',
            pending_yours: 7,
            pending_theirs: 8,
        });
        renderHook(() => useCoupleSync('me', 'couple'));
        await flush();
        await tick();
        expect(refreshers.fetchMatches).not.toHaveBeenCalled();
        expect(refreshers.fetchPendingQuestions).not.toHaveBeenCalled();
        expect(refreshers.fetchTheirTurnQuestions).not.toHaveBeenCalled();
    });

    it('stops entirely for a signed-out user and while the app is backgrounded', async () => {
        answer(baseline);
        const { unmount } = renderHook(() => useCoupleSync(undefined, null));
        await flush();
        await tick();
        expect(appDataApi.syncSummary).not.toHaveBeenCalled();
        unmount();

        renderHook(() => useCoupleSync('me', 'couple'));
        await flush();
        expect(appDataApi.syncSummary).toHaveBeenCalledTimes(1);

        await act(async () => {
            mockForeground.value = false;
            for (const listener of [...mockListeners]) listener(false);
        });
        await tick();
        await tick();
        expect(appDataApi.syncSummary).toHaveBeenCalledTimes(1);
    });

    it('discards a summary that lands after the account it belongs to was switched away', async () => {
        // Alice's poll is still open when Bob signs in. Its answer describes a
        // couple Bob is not in, so none of it may land: not his badge, not the
        // baseline his next poll is diffed against, not a refresh decision.
        let answerAlice: (summary: SyncSummary) => void = () => undefined;
        const mock = appDataApi.syncSummary as jest.Mock;
        mock.mockReset();
        mock.mockReturnValueOnce(new Promise<SyncSummary>(resolve => { answerAlice = resolve; }));

        const { rerender } = renderHook(
            ({ userId, coupleId }: { userId: string; coupleId: string }) => useCoupleSync(userId, coupleId),
            { initialProps: { userId: 'alice', coupleId: 'couple-a' } },
        );
        await flush();
        expect(mock).toHaveBeenCalledTimes(1);

        const bobBaseline: SyncSummary = { ...baseline, couple_id: 'couple-b', unread_total: 1, match_count: 2 };
        mock.mockResolvedValue(bobBaseline);
        rerender({ userId: 'bob', coupleId: 'couple-b' });
        await flush();
        expect(useMessageStore.getState().unreadCount).toBe(1);

        // Alice's request finally answers, long after she stopped being the user.
        await act(async () => {
            answerAlice({ ...baseline, couple_id: 'couple-a', unread_total: 9, match_count: 42 });
            await Promise.resolve();
        });
        await flush();
        expect(useMessageStore.getState().unreadCount).toBe(1);

        // Bob's baseline is still Bob's: a poll identical to his own first one has
        // nothing to refresh. Had Alice's answer been recorded as the baseline,
        // this would read as a 40-match jump and refresh the Matches view.
        await tick();
        expect(useMessageStore.getState().unreadCount).toBe(1);
        for (const refresh of Object.values(refreshers)) expect(refresh).not.toHaveBeenCalled();
    });

    it('never runs two summaries at once', async () => {
        let release: (summary: SyncSummary) => void = () => undefined;
        (appDataApi.syncSummary as jest.Mock).mockReset();
        (appDataApi.syncSummary as jest.Mock).mockReturnValueOnce(new Promise(resolve => { release = resolve; }));
        (appDataApi.syncSummary as jest.Mock).mockResolvedValue(baseline);
        renderHook(() => useCoupleSync('me', 'couple'));
        await flush();
        await act(async () => { jest.advanceTimersByTime(SYNC_INTERVAL_MS * 4); });
        expect(appDataApi.syncSummary).toHaveBeenCalledTimes(1);
        await act(async () => { release(baseline); await Promise.resolve(); });
        await tick();
        expect(appDataApi.syncSummary).toHaveBeenCalledTimes(2);
    });
});
