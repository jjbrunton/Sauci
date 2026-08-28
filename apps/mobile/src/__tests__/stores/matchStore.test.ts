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
            useMatchStore.setState({ isLoading: true });
            await useMatchStore.getState().fetchMatches(true);
            useMatchStore.setState({ isLoading: false, hasMore: false });
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
            await Promise.resolve();
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
            const fetchArchivedMatches = jest.fn(async () => undefined);
            useMatchStore.setState({ fetchArchivedMatches });
            useMatchStore.getState().setCurrentView('archived');
            expect(useMatchStore.getState()).toMatchObject({ currentView: 'archived', showArchived: true });
            expect(fetchArchivedMatches).toHaveBeenCalled();
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

    it('clearMatches resets all user-scoped state', () => {
        useMatchStore.setState({ matches: [match('m1')], archivedMatches: [match('m2')], pendingQuestions: [pending('p')], theirTurnQuestions: [pending('t')], currentView: 'archived', showArchived: true, isNudging: true });
        useMatchStore.getState().clearMatches();
        expect(useMatchStore.getState()).toMatchObject({ matches: [], archivedMatches: [], pendingQuestions: [], theirTurnQuestions: [], currentView: 'pending', showArchived: false, isNudging: false, page: 0, hasMore: true });
    });
});
