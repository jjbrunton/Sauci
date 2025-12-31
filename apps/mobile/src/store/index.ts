import { create } from "zustand";
import { supabase } from "../lib/supabase";
import { Events } from "../lib/analytics";
import revenueCatService, {
    SubscriptionState,
    PurchasesPackage,
    PurchasesOffering,
} from "../lib/revenuecat";
import type { Profile, Couple, Match, QuestionPack, Category } from "@/types";
import type { Database } from "@/types/supabase";

type Message = Database["public"]["Tables"]["messages"]["Row"];

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
            // First check if we have a session in storage
            const { data: { session } } = await supabase.auth.getSession();

            if (!session?.user) {
                set({ user: null, isAuthenticated: false, isLoading: false });
                return;
            }

            // Validate the session by fetching the user from the server
            // This will fail if the session was deleted server-side
            const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();

            if (authError || !authUser) {
                console.log("[Auth] Session invalid, signing out:", authError?.message);
                // Session is invalid - clear everything
                set({ user: null, couple: null, partner: null, isAuthenticated: false, isLoading: false });
                // Clear other stores
                useMatchStore.getState().clearMatches();
                usePacksStore.getState().clearPacks();
                useMessageStore.getState().clearMessages();
                useSubscriptionStore.getState().clearSubscription();
                // Sign out from Supabase (clears storage)
                await supabase.auth.signOut();
                return;
            }

            const { data: profile } = await supabase
                .from("profiles")
                .select("*")
                .eq("id", authUser.id)
                .maybeSingle();

            set({
                user: profile,
                isAuthenticated: true,
            });

            // If user has a couple, fetch couple data; otherwise clear couple/partner
            if (profile?.couple_id) {
                await get().fetchCouple();
            } else {
                set({ couple: null, partner: null });
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
        Events.signOut();
        // Clear local state FIRST to ensure UI updates even if Supabase call fails
        set({
            user: null,
            couple: null,
            partner: null,
            isAuthenticated: false,
            isLoading: false,
        });
        // Clear other stores
        useMatchStore.getState().clearMatches();
        usePacksStore.getState().clearPacks();
        useMessageStore.getState().clearMessages();
        useSubscriptionStore.getState().clearSubscription();

        // Then try to sign out from Supabase (don't block on this)
        try {
            await supabase.auth.signOut();
        } catch (error) {
            console.error("Supabase signOut error:", error);
        }
    },

    setUser: (user) => {
        set({
            user,
            isAuthenticated: !!user,
            isLoading: false,
            // Clear couple/partner when user is null (signed out)
            ...(user === null && { couple: null, partner: null })
        });
        // Clear other stores when user signs out
        if (user === null) {
            useMatchStore.getState().clearMatches();
            usePacksStore.getState().clearPacks();
            useMessageStore.getState().clearMessages();
            useSubscriptionStore.getState().clearSubscription();
        }
    },
}));

// Match store for managing matches
interface MatchState {
    matches: Match[];
    newMatchesCount: number;
    fetchMatches: () => Promise<void>;
    markAsSeen: (matchId: string) => Promise<void>;
    markAllAsSeen: () => Promise<void>;
    addMatch: (match: Match) => void;
    clearMatches: () => void;
}

export const useMatchStore = create<MatchState>((set, get) => ({
    matches: [],
    newMatchesCount: 0,

    fetchMatches: async () => {
        const userId = useAuthStore.getState().user?.id;

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

        // Fetch unread message counts per match
        const matchIds = matches.map(m => m.id);
        let unreadCounts: Record<string, number> = {};

        if (userId && matchIds.length > 0) {
            const { data: unreadMessages, error } = await supabase
                .from("messages")
                .select("match_id")
                .in("match_id", matchIds)
                .neq("user_id", userId)
                .is("read_at", null);

            if (error) {
                console.error("Error fetching unread messages:", error);
            }

            // Count unread messages per match
            unreadMessages?.forEach(msg => {
                unreadCounts[msg.match_id] = (unreadCounts[msg.match_id] || 0) + 1;
            });
        }

        const data = matches.map(match => ({
            ...match,
            responses: responses?.filter(r => r.question_id === match.question_id) || [],
            unreadCount: unreadCounts[match.id] || 0
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

    clearMatches: () => {
        set({ matches: [], newMatchesCount: 0 });
    },
}));

// Packs store
interface PacksState {
    packs: QuestionPack[];
    categories: Category[];
    enabledPackIds: string[];
    isLoading: boolean;
    fetchPacks: () => Promise<void>;
    fetchEnabledPacks: () => Promise<void>;
    togglePack: (packId: string) => Promise<{ success: boolean; reason?: string }>;
    clearPacks: () => void;
}

export const usePacksStore = create<PacksState>((set, get) => ({
    packs: [],
    categories: [],
    enabledPackIds: [],
    isLoading: false,

    fetchPacks: async () => {
        set({ isLoading: true });

        // Get user's explicit content preference
        const showExplicit = useAuthStore.getState().user?.show_explicit_content ?? true;

        // Fetch categories
        const { data: categories } = await supabase
            .from("categories")
            .select("*")
            .order("sort_order");

        // Fetch packs with category info and question count
        let query = supabase
            .from("question_packs")
            .select("*, category:categories(*), questions(count)")
            .eq("is_public", true)
            .order("sort_order");

        // Filter out explicit packs if user doesn't want to see them
        if (!showExplicit) {
            query = query.eq("is_explicit", false);
        }

        const { data: packs } = await query;

        // Also fetch enabled packs if logged in
        await get().fetchEnabledPacks();

        set({
            packs: packs ?? [],
            categories: categories ?? [],
            isLoading: false
        });
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

    togglePack: async (packId: string): Promise<{ success: boolean; reason?: string }> => {
        const coupleId = useAuthStore.getState().user?.couple_id;
        if (!coupleId) {
            return { success: false, reason: "no_couple" };
        }

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
            return { success: false, reason: "error" };
        }

        // Track pack enable/disable
        if (newValue) {
            Events.packEnabled(packId);
        } else {
            Events.packDisabled(packId);
        }

        return { success: true };
    },

    clearPacks: () => {
        set({ enabledPackIds: [] });
    },
}));

// Message notification store
interface MessageWithMatch extends Message {
    match?: {
        id: string;
        question: {
            text: string;
        };
    };
}

interface MessageState {
    unreadCount: number;
    lastMessage: MessageWithMatch | null;
    activeMatchId: string | null; // Track which chat is currently open
    fetchUnreadCount: () => Promise<void>;
    addMessage: (message: MessageWithMatch) => void;
    clearLastMessage: () => void;
    setActiveMatchId: (matchId: string | null) => void;
    markMatchMessagesAsRead: (matchId: string) => Promise<void>;
    clearMessages: () => void;
}

export const useMessageStore = create<MessageState>((set, get) => ({
    unreadCount: 0,
    lastMessage: null,
    activeMatchId: null,

    fetchUnreadCount: async () => {
        const userId = useAuthStore.getState().user?.id;
        if (!userId) {
            set({ unreadCount: 0 });
            return;
        }

        const { count } = await supabase
            .from("messages")
            .select("*", { count: "exact", head: true })
            .neq("user_id", userId)
            .is("read_at", null);

        set({ unreadCount: count || 0 });
    },

    addMessage: (message) => {
        const userId = useAuthStore.getState().user?.id;
        const activeMatchId = get().activeMatchId;

        // Only show notification if message is from partner and not in the active chat
        if (message.user_id !== userId && message.match_id !== activeMatchId) {
            set((state) => ({
                unreadCount: state.unreadCount + 1,
                lastMessage: message,
            }));
        }
    },

    clearLastMessage: () => {
        set({ lastMessage: null });
    },

    setActiveMatchId: (matchId) => {
        set({ activeMatchId: matchId });
    },

    markMatchMessagesAsRead: async (matchId) => {
        const userId = useAuthStore.getState().user?.id;
        if (!userId) return;

        await supabase
            .from("messages")
            .update({ read_at: new Date().toISOString() })
            .eq("match_id", matchId)
            .neq("user_id", userId)
            .is("read_at", null);

        // Refetch unread count
        await get().fetchUnreadCount();
    },

    clearMessages: () => {
        set({ unreadCount: 0, lastMessage: null, activeMatchId: null });
    },
}));

// Subscription store for RevenueCat
interface SubscriptionStoreState {
    subscription: SubscriptionState;
    offerings: PurchasesOffering | null;
    isLoadingOfferings: boolean;
    isPurchasing: boolean;
    error: string | null;

    // Actions
    initializeRevenueCat: (userId: string) => Promise<void>;
    fetchOfferings: () => Promise<void>;
    purchasePackage: (pkg: PurchasesPackage) => Promise<boolean>;
    restorePurchases: () => Promise<boolean>;
    refreshSubscriptionStatus: () => Promise<void>;
    clearSubscription: () => void;
}

const defaultSubscription: SubscriptionState = {
    isProUser: false,
    activeSubscription: null,
    expirationDate: null,
    willRenew: false,
};

export const useSubscriptionStore = create<SubscriptionStoreState>((set, get) => ({
    subscription: defaultSubscription,
    offerings: null,
    isLoadingOfferings: false,
    isPurchasing: false,
    error: null,

    initializeRevenueCat: async (userId: string) => {
        try {
            // Check if RevenueCat is available (won't work in Expo Go)
            if (!revenueCatService.isAvailable()) {
                console.log("RevenueCat not available, skipping initialization");
                return;
            }

            await revenueCatService.initialize(userId);
            await revenueCatService.login(userId);

            // Set up listener for subscription changes
            const removeListener = revenueCatService.addCustomerInfoUpdateListener(
                (customerInfo) => {
                    const subscription = revenueCatService.parseCustomerInfo(customerInfo);
                    set({ subscription });

                    // Update user's is_premium in auth store if changed
                    const currentUser = useAuthStore.getState().user;
                    if (currentUser && currentUser.is_premium !== subscription.isProUser) {
                        useAuthStore.getState().fetchUser();
                    }
                }
            );

            // Get initial subscription status
            await get().refreshSubscriptionStatus();
        } catch (error) {
            console.error("RevenueCat initialization error:", error);
            // Don't set error - just silently fail to not break the app
        }
    },

    fetchOfferings: async () => {
        set({ isLoadingOfferings: true, error: null });
        try {
            // Check if RevenueCat is initialized
            if (!revenueCatService.isInitialized()) {
                set({
                    offerings: null,
                    isLoadingOfferings: false,
                    error: "Subscriptions not available"
                });
                return;
            }

            const result = await revenueCatService.getOfferingsDebug();

            if (result.error) {
                set({
                    offerings: null,
                    isLoadingOfferings: false,
                    error: result.error
                });
                return;
            }

            const offerings = result.current;

            if (!offerings) {
                set({
                    offerings: null,
                    isLoadingOfferings: false,
                    error: `No current offering. Available: ${result.availableOfferings?.join(", ") || "none"}`
                });
                return;
            }

            if (!offerings.availablePackages || offerings.availablePackages.length === 0) {
                set({
                    offerings: null,
                    isLoadingOfferings: false,
                    error: "No packages in offering. Check RevenueCat dashboard."
                });
                return;
            }

            set({ offerings, isLoadingOfferings: false, error: null });
        } catch (error: any) {
            console.error("Error fetching offerings:", error);
            set({ error: `Error: ${error.message || "Unknown"}`, isLoadingOfferings: false });
        }
    },

    purchasePackage: async (pkg: PurchasesPackage) => {
        set({ isPurchasing: true, error: null });
        try {
            const customerInfo = await revenueCatService.purchasePackage(pkg);
            const subscription = revenueCatService.parseCustomerInfo(customerInfo);
            set({ subscription, isPurchasing: false });

            // Refresh user profile to get updated is_premium
            await useAuthStore.getState().fetchUser();

            return true;
        } catch (error: any) {
            const message =
                error.message === "Purchase cancelled"
                    ? "Purchase was cancelled"
                    : "Purchase failed. Please try again.";
            set({ error: message, isPurchasing: false });
            return false;
        }
    },

    restorePurchases: async () => {
        set({ isPurchasing: true, error: null });
        try {
            const customerInfo = await revenueCatService.restorePurchases();
            const subscription = revenueCatService.parseCustomerInfo(customerInfo);
            set({ subscription, isPurchasing: false });

            // Refresh user profile
            await useAuthStore.getState().fetchUser();

            return subscription.isProUser;
        } catch (error) {
            set({ error: "Failed to restore purchases", isPurchasing: false });
            return false;
        }
    },

    refreshSubscriptionStatus: async () => {
        try {
            const customerInfo = await revenueCatService.getCustomerInfo();
            const subscription = revenueCatService.parseCustomerInfo(customerInfo);
            set({ subscription });

            // Sync with server (server verifies with RevenueCat API)
            const currentUser = useAuthStore.getState().user;
            if (currentUser && currentUser.is_premium !== subscription.isProUser) {
                console.log("Syncing subscription status with server...");

                // Get the session token to pass to the function
                const { data: { session } } = await supabase.auth.getSession();
                if (!session?.access_token) {
                    console.error("No session available for sync");
                    return;
                }

                const { error } = await supabase.functions.invoke("sync-subscription", {
                    headers: {
                        Authorization: `Bearer ${session.access_token}`,
                    },
                });
                if (error) {
                    console.error("Error syncing subscription:", error);
                } else {
                    // Refresh user to get updated is_premium
                    await useAuthStore.getState().fetchUser();
                }
            }
        } catch (error) {
            console.error("Error refreshing subscription:", error);
        }
    },

    clearSubscription: () => {
        revenueCatService.logout();
        set({
            subscription: defaultSubscription,
            offerings: null,
            error: null,
        });
    },
}));
