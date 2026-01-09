jest.mock('../../lib/revenuecat', () => ({
    __esModule: true,
    default: {
        isAvailable: jest.fn(() => true),
        isInitialized: jest.fn(() => true),
        initialize: jest.fn(async () => {}),
        login: jest.fn(async () => null),
        logout: jest.fn(async () => {}),
        addCustomerInfoUpdateListener: jest.fn(() => () => {}),
        getOfferingsDebug: jest.fn(async () => ({
            current: { identifier: 'default', availablePackages: [{ identifier: 'monthly', packageType: 'MONTHLY', product: { price: 1, priceString: '$1', currencyCode: 'USD' } }] },
            availableOfferings: ['default'],
            error: null,
        })),
        purchasePackage: jest.fn(async () => ({ entitlements: { active: {} } })),
        restorePurchases: jest.fn(async () => ({ entitlements: { active: {} } })),
        getCustomerInfo: jest.fn(async () => ({ entitlements: { active: {} } })),
        parseCustomerInfo: jest.fn(() => ({ isProUser: false, activeSubscription: null, expirationDate: null, willRenew: false })),
    },
    get revenueCatService() {
        return this.default;
    },
    SubscriptionState: {},
    PurchasesPackage: {},
    PurchasesOffering: {},
}));

import { useSubscriptionStore } from '@/store/subscriptionStore';
import { useAuthStore } from '@/store/authStore';
import { supabase } from '@/lib/supabase';
import revenueCatService from '../../lib/revenuecat';

describe('subscriptionStore', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        // Reset mock implementations to defaults
        (revenueCatService.isAvailable as jest.Mock).mockReturnValue(true);
        (revenueCatService.isInitialized as jest.Mock).mockReturnValue(true);
        (revenueCatService.parseCustomerInfo as jest.Mock).mockReturnValue({
            isProUser: false,
            activeSubscription: null,
            expirationDate: null,
            willRenew: false,
        });

        useSubscriptionStore.setState({
            subscription: { isProUser: false, activeSubscription: null, expirationDate: null, willRenew: false },
            offerings: null,
            isLoadingOfferings: false,
            isPurchasing: false,
            error: null,
        } as any);
        useAuthStore.setState({
            user: { id: 'me', is_premium: false },
            fetchUser: jest.fn(),
        } as any);
    });

    describe('initializeRevenueCat', () => {
        it('skips initialization if RevenueCat not available', async () => {
            (revenueCatService.isAvailable as jest.Mock).mockReturnValue(false);

            await useSubscriptionStore.getState().initializeRevenueCat('user1');

            expect(revenueCatService.initialize).not.toHaveBeenCalled();
        });

        it('initializes and logs in when available', async () => {
            await useSubscriptionStore.getState().initializeRevenueCat('user1');

            expect(revenueCatService.initialize).toHaveBeenCalledWith('user1');
            expect(revenueCatService.login).toHaveBeenCalledWith('user1');
            expect(revenueCatService.addCustomerInfoUpdateListener).toHaveBeenCalled();
        });

        it('handles initialization errors gracefully', async () => {
            (revenueCatService.initialize as jest.Mock).mockRejectedValueOnce(new Error('Init failed'));

            // Should not throw
            await useSubscriptionStore.getState().initializeRevenueCat('user1');

            // Error is logged but not set in state
            expect(useSubscriptionStore.getState().error).toBeNull();
        });
    });

    describe('fetchOfferings', () => {
        it('stores offering on success', async () => {
            await useSubscriptionStore.getState().fetchOfferings();

            const state = useSubscriptionStore.getState();
            expect(state.offerings).toBeTruthy();
            expect(state.isLoadingOfferings).toBe(false);
            expect(state.error).toBeNull();
        });

        it('sets error if RevenueCat not initialized', async () => {
            (revenueCatService.isInitialized as jest.Mock).mockReturnValue(false);

            await useSubscriptionStore.getState().fetchOfferings();

            const state = useSubscriptionStore.getState();
            expect(state.error).toBe('Subscriptions not available');
            expect(state.offerings).toBeNull();
            expect(state.isLoadingOfferings).toBe(false);
        });

        it('handles offering fetch error', async () => {
            (revenueCatService.getOfferingsDebug as jest.Mock).mockResolvedValueOnce({
                error: 'Failed to fetch',
            });

            await useSubscriptionStore.getState().fetchOfferings();

            const state = useSubscriptionStore.getState();
            expect(state.error).toBe('Failed to fetch');
            expect(state.offerings).toBeNull();
        });

        it('handles no current offering', async () => {
            (revenueCatService.getOfferingsDebug as jest.Mock).mockResolvedValueOnce({
                current: null,
                availableOfferings: ['test'],
            });

            await useSubscriptionStore.getState().fetchOfferings();

            const state = useSubscriptionStore.getState();
            expect(state.error).toContain('No current offering');
        });

        it('handles empty packages', async () => {
            (revenueCatService.getOfferingsDebug as jest.Mock).mockResolvedValueOnce({
                current: { identifier: 'default', availablePackages: [] },
            });

            await useSubscriptionStore.getState().fetchOfferings();

            const state = useSubscriptionStore.getState();
            expect(state.error).toContain('No packages in offering');
        });

        it('handles exception during fetch', async () => {
            (revenueCatService.getOfferingsDebug as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

            await useSubscriptionStore.getState().fetchOfferings();

            const state = useSubscriptionStore.getState();
            expect(state.error).toContain('Error: Network error');
            expect(state.isLoadingOfferings).toBe(false);
        });
    });

    describe('purchasePackage', () => {
        it('purchases package successfully', async () => {
            const mockPackage = { identifier: 'monthly' };
            (revenueCatService.parseCustomerInfo as jest.Mock).mockReturnValue({
                isProUser: true,
                activeSubscription: 'monthly',
                expirationDate: '2025-01-01',
                willRenew: true,
            });

            const result = await useSubscriptionStore.getState().purchasePackage(mockPackage as any);

            expect(result).toBe(true);
            const state = useSubscriptionStore.getState();
            expect(state.subscription.isProUser).toBe(true);
            expect(state.isPurchasing).toBe(false);
            expect(useAuthStore.getState().fetchUser).toHaveBeenCalled();
        });

        it('handles cancelled purchase', async () => {
            const mockPackage = { identifier: 'monthly' };
            (revenueCatService.purchasePackage as jest.Mock).mockRejectedValueOnce(
                new Error('Purchase cancelled')
            );

            const result = await useSubscriptionStore.getState().purchasePackage(mockPackage as any);

            expect(result).toBe(false);
            const state = useSubscriptionStore.getState();
            expect(state.error).toBe('Purchase was cancelled');
            expect(state.isPurchasing).toBe(false);
        });

        it('handles other purchase errors', async () => {
            const mockPackage = { identifier: 'monthly' };
            (revenueCatService.purchasePackage as jest.Mock).mockRejectedValueOnce(
                new Error('Payment failed')
            );

            const result = await useSubscriptionStore.getState().purchasePackage(mockPackage as any);

            expect(result).toBe(false);
            const state = useSubscriptionStore.getState();
            expect(state.error).toBe('Purchase failed. Please try again.');
        });
    });

    describe('restorePurchases', () => {
        it('restores purchases successfully when user has pro', async () => {
            (revenueCatService.parseCustomerInfo as jest.Mock).mockReturnValue({
                isProUser: true,
                activeSubscription: 'yearly',
                expirationDate: '2025-12-01',
                willRenew: true,
            });

            const result = await useSubscriptionStore.getState().restorePurchases();

            expect(result).toBe(true);
            const state = useSubscriptionStore.getState();
            expect(state.subscription.isProUser).toBe(true);
            expect(state.isPurchasing).toBe(false);
        });

        it('returns false when no purchases to restore', async () => {
            const result = await useSubscriptionStore.getState().restorePurchases();

            expect(result).toBe(false);
        });

        it('handles restore error', async () => {
            (revenueCatService.restorePurchases as jest.Mock).mockRejectedValueOnce(
                new Error('Restore failed')
            );

            const result = await useSubscriptionStore.getState().restorePurchases();

            expect(result).toBe(false);
            const state = useSubscriptionStore.getState();
            expect(state.error).toBe('Failed to restore purchases');
        });
    });

    describe('refreshSubscriptionStatus', () => {
        it('refreshes subscription status', async () => {
            (revenueCatService.parseCustomerInfo as jest.Mock).mockReturnValue({
                isProUser: true,
                activeSubscription: 'monthly',
                expirationDate: '2025-01-01',
                willRenew: true,
            });

            await useSubscriptionStore.getState().refreshSubscriptionStatus();

            const state = useSubscriptionStore.getState();
            expect(state.subscription.isProUser).toBe(true);
        });

        it('handles refresh errors gracefully', async () => {
            (revenueCatService.getCustomerInfo as jest.Mock).mockRejectedValueOnce(
                new Error('Network error')
            );

            // Should not throw
            await useSubscriptionStore.getState().refreshSubscriptionStatus();
        });
    });

    describe('clearSubscription', () => {
        it('resets state and logs out', () => {
            useSubscriptionStore.setState({
                subscription: {
                    isProUser: true,
                    activeSubscription: 'monthly',
                    expirationDate: new Date('2025-01-01'),
                    willRenew: true,
                },
                offerings: { identifier: 'x', availablePackages: [] } as any,
                error: 'some error',
            });

            useSubscriptionStore.getState().clearSubscription();

            const state = useSubscriptionStore.getState();
            expect(state.offerings).toBeNull();
            expect(state.subscription.isProUser).toBe(false);
            expect(state.subscription.activeSubscription).toBeNull();
            expect(state.error).toBeNull();
            expect(revenueCatService.logout).toHaveBeenCalled();
        });
    });
});
