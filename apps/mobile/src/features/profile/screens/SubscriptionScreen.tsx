import React from 'react';
import { ScrollView, StyleSheet, Platform } from 'react-native';

import { GradientBackground } from '../../../components/ui';
import { Paywall } from '../../../components/paywall';
import { spacing } from '../../../theme';
import { useAuthStore, useSubscriptionStore } from '../../../store';
import { useProfileSettings } from '../hooks';
import { ScreenHeader, SubscriptionCard } from '../components';

/**
 * Subscription management sub-screen.
 */
export function SubscriptionScreen() {
    const { user, partner } = useAuthStore();
    const { subscription } = useSubscriptionStore();
    const settings = useProfileSettings();

    // Use OR: if RevenueCat says they're subscribed OR database says premium, it's their own
    const isOwnSubscription = subscription.isProUser || user?.is_premium;
    const hasPremiumAccess = user?.is_premium || partner?.is_premium || subscription.isProUser;

    const formatExpirationDate = (date: Date | null | string) => {
        if (!date) return "Never";
        const d = new Date(date);
        return d.toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
        });
    };

    return (
        <GradientBackground>
            <ScreenHeader title="Subscription" />
            <ScrollView
                style={styles.container}
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
            >
                <SubscriptionCard
                    hasPremiumAccess={hasPremiumAccess}
                    isOwnSubscription={!!isOwnSubscription}
                    expirationDate={formatExpirationDate(subscription.expirationDate)}
                    onUpgradePress={() => settings.setShowPaywall(true)}
                    onManagePress={settings.handleManageSubscription}
                    onRestorePress={settings.handleRestorePurchases}
                    isRestoring={settings.isPurchasing}
                    delay={0}
                />
            </ScrollView>
            <Paywall
                visible={settings.showPaywall}
                onClose={() => settings.setShowPaywall(false)}
            />
        </GradientBackground>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    content: {
        paddingTop: spacing.lg,
        paddingBottom: Platform.OS === 'ios' ? 40 : 20,
    },
});

export default SubscriptionScreen;
