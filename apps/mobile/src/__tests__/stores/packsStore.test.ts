import { usePacksStore } from '@/store/packsStore';
import { useAuthStore } from '@/store/authStore';
import { supabase } from '@/lib/supabase';

function createThenableQuery(result: any) {
    const query: any = {
        select: jest.fn(() => query),
        eq: jest.fn(() => query),
        or: jest.fn(() => query),
        order: jest.fn(() => query),
        upsert: jest.fn(() => query),
        then: (resolve: any, reject: any) => Promise.resolve(result).then(resolve, reject),
    };
    return query;
}

describe('packsStore', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        usePacksStore.setState({ packs: [], categories: [], enabledPackIds: [], isLoading: false } as any);
        useAuthStore.setState({ user: { id: 'me', couple_id: 'c1', max_intensity: 2, show_explicit_content: false } } as any);
    });

    it('fetches categories/packs and filters by max intensity', async () => {
        const categoriesQuery = createThenableQuery({ data: [{ id: 'cat1' }] });
        const packsQuery = createThenableQuery({ data: [{ id: 'pack1', is_explicit: false }] });
        const enabledQuery = createThenableQuery({ data: [{ pack_id: 'pack1' }] });

        (supabase.from as jest.Mock)
            .mockReturnValueOnce(categoriesQuery)
            .mockReturnValueOnce(packsQuery)
            .mockReturnValueOnce(enabledQuery);

        await usePacksStore.getState().fetchPacks();

        expect(packsQuery.or).toHaveBeenCalledWith('max_intensity.is.null,max_intensity.lte.2');

        const state = usePacksStore.getState();
        expect(state.categories).toEqual([{ id: 'cat1' }]);
        expect(state.packs).toEqual([{ id: 'pack1', is_explicit: false }]);
        expect(state.enabledPackIds).toEqual(['pack1']);
        expect(state.isLoading).toBe(false);
    });

    it('togglePack performs optimistic update and returns success on upsert', async () => {
        usePacksStore.setState({ enabledPackIds: [] } as any);

        const upsertQuery = createThenableQuery({ error: null });
        (supabase.from as jest.Mock).mockReturnValueOnce(upsertQuery);

        const result = await usePacksStore.getState().togglePack('pack1');

        expect(result.success).toBe(true);
        expect(usePacksStore.getState().enabledPackIds).toEqual(['pack1']);
    });
});
