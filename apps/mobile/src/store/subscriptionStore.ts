import { create } from "zustand";
import { supabase } from "../lib/supabase";
import revenueCatService, {
    SubscriptionState,
    PurchasesPackage,
    PurchasesOffering,
} from "../lib/revenuecat";
import { useAuthStore } from "./authStore";

export type PurchaseResult = {
    success: boolean;
    cancelled?: boolean;
    errorCode?: unknown;
    errorMessage?: unknown;
};

interface SubscriptionStoreState {
    subscription: SubscriptionState;
    offerings: PurchasesOffering | null;
    isLoadingOfferings: boolean;
    isPurchasing: boolean;
    error: string | null;

    // Actions
    initializeRevenueCat: (userId: string) => Promise<void>;
    fetchOfferings: () => Promise<void>;
    purchasePackage: (pkg: PurchasesPackage) => Promise<PurchaseResult>;
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

            return { success: true };
        } catch (error: any) {
            const isCancelled =
                error?.userCancelled === true ||
                error?.message === "Purchase cancelled" ||
                error?.code === "PURCHASE_CANCELLED";

            const message = isCancelled
                ? "Purchase was cancelled"
                : "Purchase failed. Please try again.";

            set({ error: message, isPurchasing: false });
            return {
                success: false,
                cancelled: isCancelled,
                errorCode: error?.code,
                errorMessage: error?.message,
            };
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
