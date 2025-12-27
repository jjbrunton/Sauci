import { create } from "zustand";
import { supabase } from "../lib/supabase";
import type { Profile, Couple, Match, QuestionPack } from "@/types";

interface AuthState {
    user: Profile | null;
    couple: Couple | null;
    partner: Profile | null;
    isLoading: boolean;
    isAuthenticated: boolean;

    // Actions
    fetchUser: () => Promise<void>;
    fetchCouple: () => Promise<void>;
    signOut: () => Promise<void>;
    setUser: (user: Profile | null) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
    user: null,
    couple: null,
    partner: null,
    isLoading: true,
    isAuthenticated: false,

    fetchUser: async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();

            if (!session?.user) {
                set({ user: null, isAuthenticated: false, isLoading: false });
                return;
            }

            const { data: profile } = await supabase
                .from("profiles")
                .select("*")
                .eq("id", session.user.id)
                .maybeSingle();

            set({
                user: profile,
                isAuthenticated: true,
            });

            // If user has a couple, fetch couple data
            if (profile?.couple_id) {
                await get().fetchCouple();
            }

            set({ isLoading: false });
        } catch (error) {
            console.error("Error fetching user:", error);
            set({ isLoading: false });
        }
    },

    fetchCouple: async () => {
        const user = get().user;
        if (!user?.couple_id) return;

        const { data: couple } = await supabase
            .from("couples")
            .select("*")
            .eq("id", user.couple_id)
            .maybeSingle();

        // Fetch partner
        const { data: partner } = await supabase
            .from("profiles")
            .select("*")
            .eq("couple_id", user.couple_id)
            .neq("id", user.id)
            .maybeSingle();

        set({ couple, partner });
    },

    signOut: async () => {
        await supabase.auth.signOut();
        set({
            user: null,
            couple: null,
            partner: null,
            isAuthenticated: false
        });
    },

    setUser: (user) => set({ user }),
}));

// Match store for managing matches
interface MatchState {
    matches: Match[];
    newMatchesCount: number;
    fetchMatches: () => Promise<void>;
    markAsSeen: (matchId: string) => Promise<void>;
    markAllAsSeen: () => Promise<void>;
    addMatch: (match: Match) => void;
}

export const useMatchStore = create<MatchState>((set, get) => ({
    matches: [],
    newMatchesCount: 0,

    fetchMatches: async () => {
        const { data: matches } = await supabase
            .from("matches")
            .select(`
        *,
        question:questions(*)
      `)
            .order("created_at", { ascending: false });

        if (!matches) return;

        // Fetch all responses for these questions to determine who answered first
        const questionIds = matches.map(m => m.question_id);
        const { data: responses } = await supabase
            .from("responses")
            .select("*")
            .in("question_id", questionIds);

        const data = matches.map(match => ({
            ...match,
            responses: responses?.filter(r => r.question_id === match.question_id) || []
        }));

        const newCount = data.filter((m) => m.is_new).length;
        set({ matches: data, newMatchesCount: newCount });
    },

    markAsSeen: async (matchId) => {
        await supabase
            .from("matches")
            .update({ is_new: false })
            .eq("id", matchId);

        const matches = get().matches.map((m) =>
            m.id === matchId ? { ...m, is_new: false } : m
        );
        const newCount = matches.filter((m) => m.is_new).length;
        set({ matches, newMatchesCount: newCount });
    },

    markAllAsSeen: async () => {
        const newMatches = get().matches.filter((m) => m.is_new);
        if (newMatches.length === 0) return;

        const newMatchIds = newMatches.map((m) => m.id);
        await supabase
            .from("matches")
            .update({ is_new: false })
            .in("id", newMatchIds);

        const matches = get().matches.map((m) =>
            m.is_new ? { ...m, is_new: false } : m
        );
        set({ matches, newMatchesCount: 0 });
    },

    addMatch: (match) => {
        set((state) => ({
            matches: [match, ...state.matches],
            newMatchesCount: state.newMatchesCount + 1,
        }));
    },
}));

// Packs store
interface PacksState {
    packs: QuestionPack[];
    enabledPackIds: string[];
    isLoading: boolean;
    fetchPacks: () => Promise<void>;
    fetchEnabledPacks: () => Promise<void>;
    togglePack: (packId: string) => Promise<void>;
}

export const usePacksStore = create<PacksState>((set, get) => ({
    packs: [],
    enabledPackIds: [],
    isLoading: false,

    fetchPacks: async () => {
        set({ isLoading: true });

        const { data: packs } = await supabase
            .from("question_packs")
            .select("*")
            .eq("is_public", true)
            .order("sort_order");

        // Also fetch enabled packs if logged in
        await get().fetchEnabledPacks();

        set({ packs: packs ?? [], isLoading: false });
    },

    fetchEnabledPacks: async () => {
        const coupleId = useAuthStore.getState().user?.couple_id;
        if (!coupleId) {
            set({ enabledPackIds: [] });
            return;
        }

        const { data: couplePacks } = await supabase
            .from("couple_packs")
            .select("pack_id")
            .eq("couple_id", coupleId)
            .eq("enabled", true);

        const ids = couplePacks?.map(cp => cp.pack_id) || [];
        set({ enabledPackIds: ids });
    },

    togglePack: async (packId: string) => {
        const coupleId = useAuthStore.getState().user?.couple_id;
        if (!coupleId) return;

        const isEnabled = get().enabledPackIds.includes(packId);
        const newValue = !isEnabled;

        // Optimistic update
        const newIds = newValue
            ? [...get().enabledPackIds, packId]
            : get().enabledPackIds.filter(id => id !== packId);

        set({ enabledPackIds: newIds });

        const { error } = await supabase
            .from("couple_packs")
            .upsert({
                couple_id: coupleId,
                pack_id: packId,
                enabled: newValue
            });

        if (error) {
            console.error("Error toggling pack:", error);
            // Revert by refetching
            get().fetchEnabledPacks();
        }
    }
}));
