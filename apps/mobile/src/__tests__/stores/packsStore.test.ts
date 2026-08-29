import { apiClient } from '@/lib/apiClient';
import { useAuthStore } from '@/store/authStore';
import { usePacksStore } from '@/store/packsStore';

describe('packsStore standalone API integration', () => {
    beforeEach(() => {
        jest.restoreAllMocks();
        usePacksStore.setState({
            packs: [], categories: [], enabledPackIds: [], packProgress: new Map(),
            isLoading: false,
        } as any);
        useAuthStore.setState({ user: { id: 'me', couple_id: 'c1', hide_nsfw: true } } as any);
    });

    it('loads the server-filtered catalog, couple selection, and user progress', async () => {
        const getSpy = jest.spyOn(apiClient, 'get')
            .mockResolvedValueOnce({
                categories: [{ id: 'cat1', is_public: true }],
                packs: [{ id: 'pack1', questions: [{ count: 3 }] }],
            })
            .mockResolvedValueOnce({ enabledPackIds: ['pack1'] })
            .mockResolvedValueOnce({
                progress: [{ packId: 'pack1', totalQuestions: 3, answeredQuestions: 1 }],
            });

        await usePacksStore.getState().fetchPacks();

        expect(getSpy).toHaveBeenNthCalledWith(1, '/v1/packs?showAllIntensities=false');
        expect(getSpy).toHaveBeenNthCalledWith(2, '/v1/me/enabled-packs');
        expect(getSpy).toHaveBeenNthCalledWith(3, '/v1/me/pack-progress');
        expect(usePacksStore.getState()).toMatchObject({ enabledPackIds: ['pack1'], isLoading: false });
        expect(usePacksStore.getState().packProgress.get('pack1')).toEqual({
            totalQuestions: 3, answeredQuestions: 1,
        });
    });

    it('sends an authenticated toggle and accepts the authoritative enabled list', async () => {
        usePacksStore.setState({ enabledPackIds: [] } as any);
        const putSpy = jest.spyOn(apiClient, 'put').mockResolvedValueOnce({ enabledPackIds: ['pack1'] });

        await expect(usePacksStore.getState().togglePack('pack1')).resolves.toEqual({ success: true });

        expect(putSpy).toHaveBeenCalledWith('/v1/me/enabled-packs/pack1', { enabled: true });
        expect(usePacksStore.getState().enabledPackIds).toEqual(['pack1']);
    });

    it('rolls back an optimistic toggle when the API rejects it', async () => {
        usePacksStore.setState({ enabledPackIds: ['pack1'] } as any);
        jest.spyOn(apiClient, 'put').mockRejectedValueOnce(new Error('offline'));
        jest.spyOn(console, 'error').mockImplementation(() => undefined);

        await expect(usePacksStore.getState().togglePack('pack1')).resolves.toEqual({
            success: false, reason: 'error',
        });
        expect(usePacksStore.getState().enabledPackIds).toEqual(['pack1']);
    });

    it('does not issue couple requests when the user has no couple', async () => {
        useAuthStore.setState({ user: { id: 'me', couple_id: null } } as any);
        const getSpy = jest.spyOn(apiClient, 'get');

        await usePacksStore.getState().fetchEnabledPacks();

        expect(getSpy).not.toHaveBeenCalled();
        expect(usePacksStore.getState().enabledPackIds).toEqual([]);
    });

    describe('account isolation (generation tokens)', () => {
        it('does not let a stale fetchEnabledPacks response populate the store after clearPacks, and lets the next account start immediately', async () => {
            let release: (page: unknown) => void = () => undefined;
            const getSpy = jest.spyOn(apiClient, 'get').mockReturnValueOnce(new Promise(resolve => { release = resolve; }));
            const staleFetch = usePacksStore.getState().fetchEnabledPacks();

            // Simulates sign-out/account switch while the request is still in flight.
            usePacksStore.getState().clearPacks();
            release({ enabledPackIds: ['stale-pack'] });
            await staleFetch;

            expect(usePacksStore.getState().enabledPackIds).toEqual([]);

            getSpy.mockResolvedValueOnce({ enabledPackIds: ['fresh-pack'] });
            await usePacksStore.getState().fetchEnabledPacks();
            expect(usePacksStore.getState().enabledPackIds).toEqual(['fresh-pack']);
        });

        it('does not let a stale fetchPackProgress response populate the store after clearPacks, and lets the next account start immediately', async () => {
            let release: (page: unknown) => void = () => undefined;
            const getSpy = jest.spyOn(apiClient, 'get').mockReturnValueOnce(new Promise(resolve => { release = resolve; }));
            const staleFetch = usePacksStore.getState().fetchPackProgress();

            usePacksStore.getState().clearPacks();
            release({ progress: [{ packId: 'stale', totalQuestions: 1, answeredQuestions: 1 }] });
            await staleFetch;

            expect(usePacksStore.getState().packProgress.size).toBe(0);

            getSpy.mockResolvedValueOnce({ progress: [{ packId: 'fresh', totalQuestions: 2, answeredQuestions: 1 }] });
            await usePacksStore.getState().fetchPackProgress();
            expect(usePacksStore.getState().packProgress.get('fresh')).toEqual({ totalQuestions: 2, answeredQuestions: 1 });
        });

        it('does not let a stale toggle write the previous couple\'s pack selection', async () => {
            usePacksStore.setState({ enabledPackIds: [] } as any);
            let release: (value: unknown) => void = () => undefined;
            jest.spyOn(apiClient, 'put').mockReturnValueOnce(new Promise(resolve => { release = resolve; }));
            const staleToggle = usePacksStore.getState().togglePack('pack1');

            usePacksStore.getState().clearPacks();
            usePacksStore.setState({ enabledPackIds: ['next-couple-pack'] } as any);

            release({ enabledPackIds: ['pack1'] });
            await expect(staleToggle).resolves.toEqual({ success: false, reason: 'stale' });
            expect(usePacksStore.getState().enabledPackIds).toEqual(['next-couple-pack']);
        });

        it('does not roll a failed toggle back into the next couple\'s selection', async () => {
            usePacksStore.setState({ enabledPackIds: ['pack1'] } as any);
            let reject: (reason: unknown) => void = () => undefined;
            jest.spyOn(apiClient, 'put').mockReturnValueOnce(new Promise((_resolve, fail) => { reject = fail; }));
            jest.spyOn(console, 'error').mockImplementation(() => undefined);
            const staleToggle = usePacksStore.getState().togglePack('pack1');

            usePacksStore.getState().clearPacks();
            usePacksStore.setState({ enabledPackIds: ['next-couple-pack'] } as any);

            reject(new Error('offline'));
            await expect(staleToggle).resolves.toEqual({ success: false, reason: 'stale' });
            // The rollback would have re-added pack1, which this couple never enabled.
            expect(usePacksStore.getState().enabledPackIds).toEqual(['next-couple-pack']);
        });
    });
});
