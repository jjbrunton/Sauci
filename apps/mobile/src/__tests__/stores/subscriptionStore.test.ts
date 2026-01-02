jest.mock('../../lib/revenuecat', () => {
    const service = {
        isAvailable: jest.fn(() => true),
        isInitialized: jest.fn(() => true),
        initialize: jest.fn(async () => {}),
        login: jest.fn(async () => null),
        logout: jest.fn(async () => {}),
        addCustomerInfoUpdateListener: jest.fn(() => null),
        getOfferingsDebug: jest.fn(async () => ({
            current: { identifier: 'default', availablePackages: [{ identifier: 'monthly', packageType: 'MONTHLY', product: { price: 1, priceString: '$1', currencyCode: 'USD' } }] },
            availableOfferings: ['default'],
            error: null,
        })),
        purchasePackage: jest.fn(async () => ({ entitlements: { active: {} } })),
        restorePurchases: jest.fn(async () => ({ entitlements: { active: {} } })),
        getCustomerInfo: jest.fn(async () => ({ entitlements: { active: {} } })),
        parseCustomerInfo: jest.fn(() => ({ isProUser: false, activeSubscription: null, expirationDate: null, willRenew: false })),
    };

    return {
        __esModule: true,
        default: service,
        revenueCatService: service,
        SubscriptionState: {},
        PurchasesPackage: {},
        PurchasesOffering: {},
    };
});

import { useSubscriptionStore } from '@/store/subscriptionStore';
import { useAuthStore } from '@/store/authStore';

describe('subscriptionStore', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        useSubscriptionStore.setState({
            subscription: { isProUser: false, activeSubscription: null, expirationDate: null, willRenew: false },
            offerings: null,
            isLoadingOfferings: false,
            isPurchasing: false,
            error: null,
        } as any);
        useAuthStore.setState({ user: { id: 'me', is_premium: false } } as any);
    });

    it('fetchOfferings stores offering on success', async () => {
        await useSubscriptionStore.getState().fetchOfferings();

        const state = useSubscriptionStore.getState();
        expect(state.offerings).toBeTruthy();
        expect(state.isLoadingOfferings).toBe(false);
        expect(state.error).toBeNull();
    });

    it('clearSubscription resets state', () => {
        useSubscriptionStore.setState({ offerings: { identifier: 'x', availablePackages: [] } } as any);
        useSubscriptionStore.getState().clearSubscription();

        const state = useSubscriptionStore.getState();
        expect(state.offerings).toBeNull();
        expect(state.subscription.isProUser).toBe(false);
    });
});
