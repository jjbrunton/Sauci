import { Platform } from "react-native";

const REVENUECAT_IOS_API_KEY =
    process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY || "";
const ENTITLEMENT_ID =
    process.env.EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID || "pro"; // Your RevenueCat entitlement identifier

export interface SubscriptionState {
    isProUser: boolean;
    activeSubscription: string | null;
    expirationDate: Date | null;
    willRenew: boolean;
}

// Type definitions for RevenueCat (minimal subset we use)
interface CustomerInfo {
    entitlements: {
        active: {
            [key: string]: {
                productIdentifier: string;
                expirationDate: string | null;
                willRenew: boolean;
            } | undefined;
        };
    };
}

interface PurchasesPackage {
    identifier: string;
    packageType: string;
    product: {
        price: number;
        priceString: string;
        currencyCode: string;
    };
}

interface PurchasesOffering {
    identifier: string;
    availablePackages: PurchasesPackage[];
}

// Re-export for consumers
export type { CustomerInfo, PurchasesPackage, PurchasesOffering };

class RevenueCatService {
    private initialized = false;
    private Purchases: any = null;

    isAvailable(): boolean {
        return Platform.OS === "ios";
    }

    private async loadPurchases(): Promise<boolean> {
        if (this.Purchases) return true;

        try {
            const module = require("react-native-purchases");
            this.Purchases = module.default || module;
            return true;
        } catch (e) {
            console.log("RevenueCat: Native module not available (running in Expo Go?)");
            return false;
        }
    }

    async initialize(userId?: string): Promise<void> {
        if (this.initialized) return;

        // Only initialize on iOS
        if (Platform.OS !== "ios") {
            console.log("RevenueCat: Skipping initialization on non-iOS platform");
            return;
        }

        // Skip if API key is missing or placeholder
        if (!REVENUECAT_IOS_API_KEY || REVENUECAT_IOS_API_KEY === "your_revenuecat_ios_api_key") {
            console.log("RevenueCat: Skipping - no valid API key configured");
            return;
        }

        const available = await this.loadPurchases();
        if (!available) return;

        try {
            // Always enable debug logging for now to diagnose issues
            this.Purchases.setLogLevel(this.Purchases.LOG_LEVEL?.DEBUG || 4);

            const keyPrefix = REVENUECAT_IOS_API_KEY.substring(0, 10);
            console.log("RevenueCat: Configuring with API key prefix:", keyPrefix + "...");

            await this.Purchases.configure({
                apiKey: REVENUECAT_IOS_API_KEY,
                appUserID: userId,
            });

            this.initialized = true;
            console.log("RevenueCat: Initialized successfully with user:", userId || "anonymous");
        } catch (error) {
            console.error("RevenueCat: Failed to initialize:", error);
            // Don't rethrow - allow app to continue without subscriptions
        }
    }

    isInitialized(): boolean {
        return this.initialized;
    }

    async login(userId: string): Promise<CustomerInfo | null> {
        if (!this.initialized || !this.Purchases) {
            return null;
        }

        try {
            const { customerInfo } = await this.Purchases.logIn(userId);
            console.log("RevenueCat: Logged in user", userId);
            return customerInfo;
        } catch (error) {
            console.error("RevenueCat: Login error:", error);
            return null;
        }
    }

    async logout(): Promise<void> {
        if (!this.initialized || !this.Purchases) return;

        try {
            await this.Purchases.logOut();
            console.log("RevenueCat: Logged out");
        } catch (error) {
            console.error("RevenueCat: Logout error:", error);
        }
    }

    async getOfferings(): Promise<PurchasesOffering | null> {
        const result = await this.getOfferingsDebug();
        return result.current;
    }

    async getOfferingsDebug(): Promise<{
        current: PurchasesOffering | null;
        availableOfferings: string[] | null;
        error: string | null;
    }> {
        if (!this.initialized || !this.Purchases) {
            return {
                current: null,
                availableOfferings: null,
                error: "RevenueCat not initialized"
            };
        }

        try {
            const offerings = await this.Purchases.getOfferings();
            const availableOfferings = Object.keys(offerings.all || {});

            return {
                current: offerings.current,
                availableOfferings,
                error: null
            };
        } catch (error: any) {
            return {
                current: null,
                availableOfferings: null,
                error: error.message || "Failed to fetch offerings"
            };
        }
    }

    async purchasePackage(pkg: PurchasesPackage): Promise<CustomerInfo> {
        if (!this.initialized || !this.Purchases) {
            throw new Error("RevenueCat not initialized");
        }

        try {
            const { customerInfo } = await this.Purchases.purchasePackage(pkg);
            return customerInfo;
        } catch (error: any) {
            if (error.userCancelled) {
                throw new Error("Purchase cancelled");
            }
            console.error("RevenueCat: Purchase error:", error);
            throw error;
        }
    }

    async restorePurchases(): Promise<CustomerInfo> {
        if (!this.initialized || !this.Purchases) {
            throw new Error("RevenueCat not initialized");
        }

        try {
            const customerInfo = await this.Purchases.restorePurchases();
            return customerInfo;
        } catch (error) {
            console.error("RevenueCat: Restore error:", error);
            throw error;
        }
    }

    async getCustomerInfo(): Promise<CustomerInfo | null> {
        if (!this.initialized || !this.Purchases) {
            return null;
        }

        try {
            return await this.Purchases.getCustomerInfo();
        } catch (error) {
            console.error("RevenueCat: Error getting customer info:", error);
            return null;
        }
    }

    parseCustomerInfo(customerInfo: CustomerInfo | null): SubscriptionState {
        if (!customerInfo) {
            console.log("RevenueCat: No customer info");
            return {
                isProUser: false,
                activeSubscription: null,
                expirationDate: null,
                willRenew: false,
            };
        }

        // Debug: Log all active entitlements
        const activeEntitlements = Object.keys(customerInfo.entitlements.active);
        console.log("RevenueCat: Active entitlements:", activeEntitlements);
        console.log("RevenueCat: Looking for entitlement ID:", ENTITLEMENT_ID);

        const entitlement = customerInfo.entitlements.active[ENTITLEMENT_ID];
        console.log("RevenueCat: Found entitlement:", entitlement ? "yes" : "no");

        return {
            isProUser: !!entitlement,
            activeSubscription: entitlement?.productIdentifier || null,
            expirationDate: entitlement?.expirationDate
                ? new Date(entitlement.expirationDate)
                : null,
            willRenew: entitlement?.willRenew || false,
        };
    }

    addCustomerInfoUpdateListener(
        callback: (customerInfo: CustomerInfo) => void
    ): (() => void) | null {
        if (!this.initialized || !this.Purchases) {
            return null;
        }

        try {
            const subscription = this.Purchases.addCustomerInfoUpdateListener(callback);
            return () => {
                if (subscription && typeof subscription.remove === "function") {
                    subscription.remove();
                }
            };
        } catch (error) {
            console.error("RevenueCat: Error adding listener:", error);
            return null;
        }
    }
}

export const revenueCatService = new RevenueCatService();
export default revenueCatService;
