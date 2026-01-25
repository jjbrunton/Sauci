/**
 * Required onboarding version.
 *
 * Bump this number when you need existing users to go through onboarding again
 * to collect new required data (e.g., profile pictures, new fields).
 *
 * Version history:
 * - 1: Initial onboarding (avatar, name, gender, purpose, content prefs, notifications)
 * - 2: Made avatar mandatory for all users
 */
export const REQUIRED_ONBOARDING_VERSION = 2;

/**
 * RevenueCat offering identifier for the onboarding discount paywall.
 *
 * Create this offering in RevenueCat dashboard with discounted products.
 * If the offering doesn't exist, the paywall will fall back to the default offering.
 *
 * To set up:
 * 1. Create discounted products in App Store Connect (e.g., "sauci_annual_onboarding")
 * 2. In RevenueCat → Products, add these products
 * 3. In RevenueCat → Offerings, create offering "onboarding_promo" with the discounted products
 */
export const ONBOARDING_OFFERING_ID = "onboarding_promo";

/**
 * Check if a user needs to complete onboarding based on their current version
 */
export function needsOnboarding(
    onboardingCompleted: boolean | undefined,
    onboardingVersion: number | undefined
): boolean {
    // Never completed onboarding
    if (!onboardingCompleted) {
        return true;
    }

    // Completed an older version - need to re-onboard
    if ((onboardingVersion ?? 0) < REQUIRED_ONBOARDING_VERSION) {
        return true;
    }

    return false;
}
