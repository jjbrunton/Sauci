import { appDataApi } from '@/lib/appDataApi';
import { ApiError, apiClient } from '@/lib/apiClient';
import { useAuthStore } from '@/store/authStore';
import { useMatchStore } from '@/store/matchStore';

jest.mock('@/lib/apiClient', () => {
    const actual = jest.requireActual('@/lib/apiClient');
    return { ...actual, apiClient: { get: jest.fn(), patch: jest.fn(), put: jest.fn() } };
});
jest.mock('@/lib/appDataApi', () => ({ appDataApi: { sendNudge: jest.fn(), nudgeStatus: jest.fn() } }));

const match = (id: string, is_new = true, unreadCount = 0) => ({
    id, couple_id: 'couple', question_id: `q-${id}`, match_type: 'yes_yes', is_new,
    created_at: '2026-01-01T00:00:00.000Z', unreadCount,
} as any);
const pending = (id: string) => ({ id, question: { id: `q-${id}` }, partnerAnsweredAt: 'now' } as any);

describe('matchStore API behavior', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2026-08-27T12:00:00Z'));
        useAuthStore.setState({ user: { id: 'me', couple_id: 'couple' } } as any);
        useMatchStore.getState().clearMatches();
        (apiClient.patch as jest.Mock).mockResolvedValue({ success: true });
        (apiClient.put as jest.Mock).mockResolvedValue({ success: true });
    });
    afterEach(() => jest.useRealTimers());

    describe('fetchMatches', () => {
        it('loads the first API page and retains server ordering and counts', async () => {
            (apiClient.get as jest.Mock).mockResolvedValue({ matches: [match('unread', false, 2), match('new')], totalCount: 2 });
            await useMatchStore.getState().fetchMatches(true);
            expect(apiClient.get).toHaveBeenCalledWith('/v1/matches?page=0&limit=20');
            expect(useMatchStore.getState()).toMatchObject({ totalCount: 2, newMatchesCount: 1, page: 1, hasMore: false, isLoading: false });
            expect(useMatchStore.getState().matches.map(item => item.id)).toEqual(['unread', 'new']);
        });

        it('fails closed for an unpaired user', async () => {
            useMatchStore.setState({ matches: [match('old')], newMatchesCount: 1 });
            useAuthStore.setState({ user: { id: 'me', couple_id: null } } as any);
            await useMatchStore.getState().fetchMatches(true);
            expect(apiClient.get).not.toHaveBeenCalled();
            expect(useMatchStore.getState()).toMatchObject({ matches: [], newMatchesCount: 0, totalCount: 0, isLoading: false });
        });

        it('guards concurrent loads and exhausted pagination', async () => {
            // Overlap protection cannot key off the loading flags any more: a silent
            // refresh raises none of them and still must not issue a second request.
            let release: (page: { matches: unknown[]; totalCount: number }) => void = () => undefined;
            (apiClient.get as jest.Mock).mockReturnValueOnce(new Promise(resolve => { release = resolve; }));
            const inFlight = useMatchStore.getState().fetchMatches(true);
            await useMatchStore.getState().fetchMatches(true, { silent: true });
            expect(apiClient.get).toHaveBeenCalledTimes(1);
            release({ matches: [], totalCount: 0 });
            await inFlight;

            (apiClient.get as jest.Mock).mockClear();
            useMatchStore.setState({ hasMore: false });
            await useMatchStore.getState().fetchMatches(false);
            expect(apiClient.get).not.toHaveBeenCalled();
        });

        it('appends and deduplicates later pages', async () => {
            useMatchStore.setState({ matches: [match('existing')], page: 1, hasMore: true, newMatchesCount: 1, totalCount: 25 });
            const page = [match('existing'), ...Array.from({ length: 19 }, (_, index) => match(`m${index}`, false))];
            (apiClient.get as jest.Mock).mockResolvedValue({ matches: page, totalCount: 25 });
            await useMatchStore.getState().fetchMatches(false);
            expect(apiClient.get).toHaveBeenCalledWith('/v1/matches?page=1&limit=20');
            expect(useMatchStore.getState()).toMatchObject({ page: 2, hasMore: true, isLoadingMore: false, totalCount: 25 });
            expect(new Set(useMatchStore.getState().matches.map(item => item.id)).size).toBe(20);
        });

        it('sets an empty terminal state on an empty refresh', async () => {
            (apiClient.get as jest.Mock).mockResolvedValue({ matches: [], totalCount: 0 });
            await useMatchStore.getState().fetchMatches(true);
            expect(useMatchStore.getState()).toMatchObject({ matches: [], totalCount: 0, hasMore: false, isLoading: false });
        });

        it('records API errors and releases loading guards', async () => {
            jest.spyOn(console, 'error').mockImplementation(() => undefined);
            (apiClient.get as jest.Mock).mockRejectedValue(new Error('network'));
            await useMatchStore.getState().fetchMatches(true);
            expect(useMatchStore.getState()).toMatchObject({ error: 'Failed to load matches', isLoading: false, isLoadingMore: false });
        });
    });

    it('marks one or all new matches seen and skips an empty batch', async () => {
        useMatchStore.setState({ matches: [match('m1'), match('m2'), match('old', false)], newMatchesCount: 2 });
        await useMatchStore.getState().markAsSeen('m1');
        expect(apiClient.patch).toHaveBeenLastCalledWith('/v1/matches/seen', { ids: ['m1'] });
        expect(useMatchStore.getState().newMatchesCount).toBe(1);
        await useMatchStore.getState().markAllAsSeen();
        expect(apiClient.patch).toHaveBeenLastCalledWith('/v1/matches/seen', { ids: ['m2'] });
        expect(useMatchStore.getState().newMatchesCount).toBe(0);
        await useMatchStore.getState().markAllAsSeen();
        expect(apiClient.patch).toHaveBeenCalledTimes(2);
    });

    it('adds matches and clamps unread counts at zero', () => {
        useMatchStore.setState({ matches: [match('m1', false, 1)], totalCount: null, newMatchesCount: 0 });
        useMatchStore.getState().addMatch(match('m2'));
        useMatchStore.getState().updateMatchUnreadCount('m1', -5);
        expect(useMatchStore.getState().matches.map(item => item.id)).toEqual(['m2', 'm1']);
        expect(useMatchStore.getState()).toMatchObject({ totalCount: 1, newMatchesCount: 1 });
        expect(useMatchStore.getState().matches[1]?.unreadCount).toBe(0);
    });

    describe('archives', () => {
        it('archives and unarchives optimistically through token-scoped routes', async () => {
            useMatchStore.setState({ matches: [match('m1'), match('m2')], archivedMatches: [], archivedMatchIds: new Set(), totalCount: 2 });
            await useMatchStore.getState().archiveMatch('m1');
            expect(apiClient.put).toHaveBeenLastCalledWith('/v1/matches/m1/archive', { archived: true });
            expect(useMatchStore.getState().matches.map(item => item.id)).toEqual(['m2']);
            expect(useMatchStore.getState().archivedMatchIds.has('m1')).toBe(true);
            await useMatchStore.getState().unarchiveMatch('m1');
            expect(apiClient.put).toHaveBeenLastCalledWith('/v1/matches/m1/archive', { archived: false });
            expect(useMatchStore.getState()).toMatchObject({ totalCount: 2, archivedMatches: [] });
        });

        it('does not mutate or call the API without an authenticated user', async () => {
            useMatchStore.setState({ matches: [match('m1')], archivedMatches: [match('m2')] });
            useAuthStore.setState({ user: null } as any);
            await useMatchStore.getState().archiveMatch('m1');
            await useMatchStore.getState().unarchiveMatch('m2');
            expect(apiClient.put).not.toHaveBeenCalled();
            expect(useMatchStore.getState().matches).toHaveLength(1);
        });

        it('reverts archive and unarchive mutations on API errors', async () => {
            jest.spyOn(console, 'error').mockImplementation(() => undefined);
            (apiClient.put as jest.Mock).mockRejectedValue(new Error('forbidden'));
            useMatchStore.setState({ matches: [match('m1')], archivedMatches: [], archivedMatchIds: new Set(), totalCount: 1 });
            await useMatchStore.getState().archiveMatch('m1');
            expect(useMatchStore.getState().matches.map(item => item.id)).toEqual(['m1']);
            expect(useMatchStore.getState().totalCount).toBe(1);
            useMatchStore.setState({ matches: [], archivedMatches: [match('m2')], archivedMatchIds: new Set(['m2']), totalCount: 0 });
            await useMatchStore.getState().unarchiveMatch('m2');
            expect(useMatchStore.getState().archivedMatches.map(item => item.id)).toEqual(['m2']);
            expect(useMatchStore.getState().totalCount).toBe(0);
        });

        it('loads archived matches, handles empty responses, and guards missing couple state', async () => {
            (apiClient.get as jest.Mock).mockResolvedValueOnce({ matches: [match('m1')], totalCount: 1 });
            await useMatchStore.getState().fetchArchivedMatches();
            expect(apiClient.get).toHaveBeenCalledWith('/v1/matches?archived=true&limit=100');
            expect(useMatchStore.getState().archivedMatchIds.has('m1')).toBe(true);
            (apiClient.get as jest.Mock).mockResolvedValueOnce({ matches: [], totalCount: 0 });
            await useMatchStore.getState().fetchArchivedMatches();
            expect(useMatchStore.getState()).toMatchObject({ archivedMatches: [], isLoadingArchived: false });
            useAuthStore.setState({ user: { id: 'me', couple_id: null } } as any);
            await useMatchStore.getState().fetchArchivedMatches();
            expect(apiClient.get).toHaveBeenCalledTimes(2);
        });

        it('toggles archived visibility and triggers an initial fetch only', async () => {
            (apiClient.get as jest.Mock).mockResolvedValue({ matches: [], totalCount: 0 });
            useMatchStore.getState().toggleShowArchived();
            // Let the floating fetch settle: its in-flight guard is module-scoped and
            // is only released in a finally, so a half-run request would leak into
            // the next test and silently suppress its archived fetch.
            await jest.runOnlyPendingTimersAsync();
            expect(useMatchStore.getState().showArchived).toBe(true);
            expect(apiClient.get).toHaveBeenCalledTimes(1);
            useMatchStore.getState().toggleShowArchived();
            expect(useMatchStore.getState().showArchived).toBe(false);
        });
    });

    describe('turn views', () => {
        it('loads partner and own pending questions and clears them when unpaired', async () => {
            (apiClient.get as jest.Mock).mockResolvedValueOnce({ questions: [pending('partner')] }).mockResolvedValueOnce({ questions: [pending('mine')] });
            await useMatchStore.getState().fetchPendingQuestions();
            await useMatchStore.getState().fetchTheirTurnQuestions();
            expect(apiClient.get).toHaveBeenNthCalledWith(1, '/v1/questions/pending?direction=partner');
            expect(apiClient.get).toHaveBeenNthCalledWith(2, '/v1/questions/pending?direction=mine');
            expect(useMatchStore.getState()).toMatchObject({ pendingQuestions: [pending('partner')], theirTurnQuestions: [pending('mine')] });
            useAuthStore.setState({ user: null } as any);
            await useMatchStore.getState().fetchPendingQuestions();
            await useMatchStore.getState().fetchTheirTurnQuestions();
            expect(useMatchStore.getState()).toMatchObject({ pendingQuestions: [], theirTurnQuestions: [] });
        });

        it('releases pending loading guards on errors', async () => {
            jest.spyOn(console, 'error').mockImplementation(() => undefined);
            (apiClient.get as jest.Mock).mockRejectedValue(new Error('network'));
            await useMatchStore.getState().fetchPendingQuestions();
            await useMatchStore.getState().fetchTheirTurnQuestions();
            expect(useMatchStore.getState()).toMatchObject({ isLoadingPending: false, isLoadingTheirTurn: false });
        });

        it('updates current view and delegates an empty view fetch', () => {
            const real = useMatchStore.getState().fetchArchivedMatches;
            const fetchArchivedMatches = jest.fn(async () => undefined);
            useMatchStore.setState({ fetchArchivedMatches });
            try {
                useMatchStore.getState().setCurrentView('archived');
                expect(useMatchStore.getState()).toMatchObject({ currentView: 'archived', showArchived: true });
                expect(fetchArchivedMatches).toHaveBeenCalled();
            } finally {
                // Actions live in the same store as the data, and clearMatches does not
                // reset them: leaving the stub in place would silence every later test's
                // archived fetch.
                useMatchStore.setState({ fetchArchivedMatches: real });
            }
        });
    });

    describe('nudges', () => {
        it('sends a nudge and uses the server cooldown', async () => {
            (appDataApi.sendNudge as jest.Mock).mockResolvedValue({ success: true, notification_sent: true, next_nudge_available_at: '2026-08-28T00:00:00Z' });
            await expect(useMatchStore.getState().sendNudge()).resolves.toEqual({ success: true, notificationSent: true });
            expect(useMatchStore.getState()).toMatchObject({ isNudging: false, nudgeCooldownUntil: new Date('2026-08-28T00:00:00Z') });
        });

        it('does not send during an active request or cooldown', async () => {
            useMatchStore.setState({ isNudging: true });
            await expect(useMatchStore.getState().sendNudge()).resolves.toEqual({ success: false, notificationSent: false });
            useMatchStore.setState({ isNudging: false, nudgeCooldownUntil: new Date('2026-08-27T13:00:00Z') });
            await useMatchStore.getState().sendNudge();
            expect(appDataApi.sendNudge).not.toHaveBeenCalled();
        });

        it('records a 429 cooldown and recovers from generic errors', async () => {
            (appDataApi.sendNudge as jest.Mock).mockRejectedValueOnce(new ApiError('rate limited', 429, { cooldown_remaining_seconds: 60 }));
            await expect(useMatchStore.getState().sendNudge()).resolves.toEqual({ success: false, notificationSent: false });
            expect(useMatchStore.getState().nudgeCooldownUntil).toEqual(new Date('2026-08-27T12:01:00Z'));
            jest.spyOn(console, 'error').mockImplementation(() => undefined);
            useMatchStore.setState({ nudgeCooldownUntil: null });
            (appDataApi.sendNudge as jest.Mock).mockRejectedValueOnce(new Error('network'));
            await useMatchStore.getState().sendNudge();
            expect(useMatchStore.getState().isNudging).toBe(false);
        });

        it('derives, clears, and guards persisted cooldown status', async () => {
            (appDataApi.nudgeStatus as jest.Mock).mockResolvedValueOnce({ last_nudge_sent_at: '2026-08-27T06:00:00Z' });
            await useMatchStore.getState().checkNudgeCooldown();
            expect(useMatchStore.getState().nudgeCooldownUntil).toEqual(new Date('2026-08-27T18:00:00Z'));
            (appDataApi.nudgeStatus as jest.Mock).mockResolvedValueOnce({ last_nudge_sent_at: null });
            await useMatchStore.getState().checkNudgeCooldown();
            expect(useMatchStore.getState().nudgeCooldownUntil).toBeNull();
            useAuthStore.setState({ user: null } as any);
            await useMatchStore.getState().checkNudgeCooldown();
            expect(appDataApi.nudgeStatus).toHaveBeenCalledTimes(2);
        });
    });

    describe('view switching and cache freshness', () => {
        /** Answers each of the four view endpoints with an empty payload. */
        const emptyViews = () => (apiClient.get as jest.Mock).mockImplementation(async (path: string) => {
            if (path.startsWith('/v1/matches?archived=true')) return { matches: [], totalCount: 0 };
            if (path.startsWith('/v1/matches')) return { matches: [], totalCount: 0, hasMore: false };
            return { questions: [] };
        });

        it('switches between loaded views without a single extra request, even when every view is empty', async () => {
            emptyViews();
            const views = ['pending', 'their_turn', 'active', 'archived'] as const;

            // First visit to each view loads it once.
            for (const view of views) {
                useMatchStore.getState().setCurrentView(view);
                await jest.runOnlyPendingTimersAsync();
            }
            expect(apiClient.get).toHaveBeenCalledTimes(views.length);
            expect(useMatchStore.getState()).toMatchObject({
                matches: [], pendingQuestions: [], theirTurnQuestions: [], archivedMatches: [],
            });

            // Every subsequent switch is served from cache. An empty view is loaded,
            // not unloaded: this is the bug where `array.length === 0` meant "never
            // fetched" and made every visit pay for the same empty answer.
            (apiClient.get as jest.Mock).mockClear();
            for (const view of [...views, ...views].reverse()) {
                useMatchStore.getState().setCurrentView(view);
                await jest.runOnlyPendingTimersAsync();
            }
            expect(apiClient.get).not.toHaveBeenCalled();
        });

        it('keeps cached rows and raises no foreground spinner during a silent refresh', async () => {
            (apiClient.get as jest.Mock).mockResolvedValueOnce({ matches: [match('cached', false)], totalCount: 1, hasMore: false });
            await useMatchStore.getState().fetchMatches(true);
            expect(useMatchStore.getState().matches.map(item => item.id)).toEqual(['cached']);

            let release: (page: unknown) => void = () => undefined;
            (apiClient.get as jest.Mock).mockReturnValueOnce(new Promise(resolve => { release = resolve; }));
            const refreshing = useMatchStore.getState().fetchMatches(true, { silent: true });

            // Mid-flight: the user still sees the rows they had, and neither the
            // full-screen loader nor the pull-to-refresh spinner is showing.
            expect(useMatchStore.getState()).toMatchObject({ isLoading: false, isRefreshing: false });
            expect(useMatchStore.getState().matches.map(item => item.id)).toEqual(['cached']);

            release({ matches: [match('fresh', false)], totalCount: 1, hasMore: false });
            await refreshing;
            expect(useMatchStore.getState().matches.map(item => item.id)).toEqual(['fresh']);
        });

        it('shows the pull-to-refresh spinner for a user-initiated refresh but never the initial loader', async () => {
            (apiClient.get as jest.Mock).mockResolvedValueOnce({ matches: [match('cached', false)], totalCount: 1, hasMore: false });
            await useMatchStore.getState().fetchMatches(true);

            let release: (page: unknown) => void = () => undefined;
            (apiClient.get as jest.Mock).mockReturnValueOnce(new Promise(resolve => { release = resolve; }));
            const refreshing = useMatchStore.getState().fetchMatches(true);
            expect(useMatchStore.getState()).toMatchObject({ isLoading: false, isRefreshing: true });
            expect(useMatchStore.getState().matches.map(item => item.id)).toEqual(['cached']);
            release({ matches: [], totalCount: 0, hasMore: false });
            await refreshing;
            expect(useMatchStore.getState()).toMatchObject({ isRefreshing: false });
        });

        it('keeps a silent list refresh out of the pending and their-turn loaders', async () => {
            (apiClient.get as jest.Mock).mockResolvedValue({ questions: [pending('p1')] });
            await useMatchStore.getState().fetchPendingQuestions();
            await useMatchStore.getState().fetchTheirTurnQuestions();

            let release: (page: unknown) => void = () => undefined;
            (apiClient.get as jest.Mock).mockReturnValue(new Promise(resolve => { release = resolve; }));
            const quiet = Promise.all([
                useMatchStore.getState().fetchPendingQuestions({ silent: true }),
                useMatchStore.getState().fetchTheirTurnQuestions({ silent: true }),
            ]);
            expect(useMatchStore.getState()).toMatchObject({ isLoadingPending: false, isLoadingTheirTurn: false });
            expect(useMatchStore.getState().pendingQuestions).toHaveLength(1);
            release({ questions: [] });
            await quiet;
        });
    });

    describe('account isolation (generation tokens)', () => {
        it('does not let a stale fetchMatches response populate the store after sign-out, and lets the next account start immediately', async () => {
            let release: (page: unknown) => void = () => undefined;
            (apiClient.get as jest.Mock).mockReturnValueOnce(new Promise(resolve => { release = resolve; }));
            const staleFetch = useMatchStore.getState().fetchMatches(true);

            // Simulates sign-out/account switch while the request is still in flight.
            useMatchStore.getState().clearMatches();
            release({ matches: [match('stale')], totalCount: 1, hasMore: false });
            await staleFetch;

            expect(useMatchStore.getState().matches).toEqual([]);

            (apiClient.get as jest.Mock).mockResolvedValueOnce({ matches: [match('fresh')], totalCount: 1, hasMore: false });
            await useMatchStore.getState().fetchMatches(true);
            expect(useMatchStore.getState().matches.map(item => item.id)).toEqual(['fresh']);
        });

        it('does not let a stale seen-marker write over the next account\'s list', async () => {
            useMatchStore.setState({ matches: [match('theirs')], newMatchesCount: 1 });
            let release: () => void = () => undefined;
            (apiClient.patch as jest.Mock).mockReturnValueOnce(new Promise<void>(resolve => { release = () => resolve(); }));
            const stale = useMatchStore.getState().markAsSeen('theirs');

            useMatchStore.getState().clearMatches();
            useMatchStore.setState({ matches: [match('mine')], newMatchesCount: 1 });
            const untouched = useMatchStore.getState().matches;
            release();
            await stale;

            // Not merely "the same ids": the previous account's response must not
            // rewrite the array at all, because the recount it derives is only true
            // of the rows that account had loaded.
            expect(useMatchStore.getState().matches).toBe(untouched);
            expect(useMatchStore.getState().newMatchesCount).toBe(1);
        });

        it('does not let a stale mark-all-seen clear the next account\'s new badges', async () => {
            useMatchStore.setState({ matches: [match('theirs')], newMatchesCount: 1 });
            let release: () => void = () => undefined;
            (apiClient.patch as jest.Mock).mockReturnValueOnce(new Promise<void>(resolve => { release = () => resolve(); }));
            const stale = useMatchStore.getState().markAllAsSeen();

            useMatchStore.getState().clearMatches();
            useMatchStore.setState({ matches: [match('mine', true), match('mine2', true)], newMatchesCount: 2 });
            release();
            await stale;

            expect(useMatchStore.getState().matches.every(item => item.is_new)).toBe(true);
            expect(useMatchStore.getState().newMatchesCount).toBe(2);
        });

        it('does not roll a failed archive or unarchive back into the next account', async () => {
            jest.spyOn(console, 'error').mockImplementation(() => undefined);
            let fail: (error: Error) => void = () => undefined;
            (apiClient.put as jest.Mock).mockReturnValueOnce(new Promise((_resolve, reject) => { fail = reject; }));
            useMatchStore.setState({ matches: [match('theirs')], archivedMatches: [], archivedMatchIds: new Set<string>(), totalCount: 1 });
            const staleArchive = useMatchStore.getState().archiveMatch('theirs');

            useMatchStore.getState().clearMatches();
            useMatchStore.setState({ matches: [match('mine')], totalCount: 1 });
            fail(new Error('forbidden'));
            await staleArchive;

            // The revert would otherwise put one couple's match into another's list.
            expect(useMatchStore.getState().matches.map(item => item.id)).toEqual(['mine']);
            expect(useMatchStore.getState().totalCount).toBe(1);

            (apiClient.put as jest.Mock).mockReturnValueOnce(new Promise((_resolve, reject) => { fail = reject; }));
            useMatchStore.setState({ archivedMatches: [match('theirsArchived')], archivedMatchIds: new Set(['theirsArchived']) });
            const staleUnarchive = useMatchStore.getState().unarchiveMatch('theirsArchived');

            useMatchStore.getState().clearMatches();
            useMatchStore.setState({ archivedMatches: [match('mineArchived')], archivedMatchIds: new Set(['mineArchived']), totalCount: 0 });
            fail(new Error('forbidden'));
            await staleUnarchive;

            expect(useMatchStore.getState().archivedMatches.map(item => item.id)).toEqual(['mineArchived']);
            expect(useMatchStore.getState().totalCount).toBe(0);
        });

        it('does not carry a nudge cooldown across an account switch', async () => {
            let release: (data: unknown) => void = () => undefined;
            (appDataApi.sendNudge as jest.Mock).mockReturnValueOnce(new Promise(resolve => { release = resolve; }));
            const staleSend = useMatchStore.getState().sendNudge();

            useMatchStore.getState().clearMatches();
            release({ success: true, notification_sent: true, next_nudge_available_at: '2026-08-28T00:00:00Z' });
            await expect(staleSend).resolves.toEqual({ success: false, notificationSent: false });
            expect(useMatchStore.getState().nudgeCooldownUntil).toBeNull();

            // The 429 branch writes a cooldown too, and must be gated the same way.
            let fail: (error: Error) => void = () => undefined;
            (appDataApi.sendNudge as jest.Mock).mockReturnValueOnce(new Promise((_resolve, reject) => { fail = reject; }));
            const staleLimit = useMatchStore.getState().sendNudge();
            useMatchStore.getState().clearMatches();
            fail(new ApiError('rate limited', 429, { cooldown_remaining_seconds: 60 }));
            await staleLimit;
            expect(useMatchStore.getState().nudgeCooldownUntil).toBeNull();
        });

        it('does not let a stale cooldown read clear the next account\'s cooldown', async () => {
            let release: (profile: unknown) => void = () => undefined;
            (appDataApi.nudgeStatus as jest.Mock).mockReturnValueOnce(new Promise(resolve => { release = resolve; }));
            const stale = useMatchStore.getState().checkNudgeCooldown();

            useMatchStore.getState().clearMatches();
            const mine = new Date('2026-08-27T18:00:00Z');
            useMatchStore.setState({ nudgeCooldownUntil: mine });
            // The previous account not being in cooldown says nothing about this one.
            release({ last_nudge_sent_at: null });
            await stale;
            expect(useMatchStore.getState().nudgeCooldownUntil).toEqual(mine);
        });

        it('does not let a stale fetchPendingQuestions response populate the store after sign-out, and lets the next account start immediately', async () => {
            let release: (page: unknown) => void = () => undefined;
            (apiClient.get as jest.Mock).mockReturnValueOnce(new Promise(resolve => { release = resolve; }));
            const staleFetch = useMatchStore.getState().fetchPendingQuestions();

            useMatchStore.getState().clearMatches();
            release({ questions: [pending('stale')] });
            await staleFetch;

            expect(useMatchStore.getState().pendingQuestions).toEqual([]);

            (apiClient.get as jest.Mock).mockResolvedValueOnce({ questions: [pending('fresh')] });
            await useMatchStore.getState().fetchPendingQuestions();
            expect(useMatchStore.getState().pendingQuestions.map(item => item.id)).toEqual(['fresh']);
        });
    });

    it('clearMatches resets all user-scoped state', () => {
        useMatchStore.setState({ matches: [match('m1')], archivedMatches: [match('m2')], pendingQuestions: [pending('p')], theirTurnQuestions: [pending('t')], currentView: 'archived', showArchived: true, isNudging: true });
        useMatchStore.getState().clearMatches();
        expect(useMatchStore.getState()).toMatchObject({ matches: [], archivedMatches: [], pendingQuestions: [], theirTurnQuestions: [], currentView: 'pending', showArchived: false, isNudging: false, page: 0, hasMore: true });
    });
});
