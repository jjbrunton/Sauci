import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { ShimmerEffect } from '../../../components/ui';
import { colors, gradients, spacing, typography, radius, shadows } from '../../../theme';

export interface SubscriptionCardProps {
    /** Whether user has premium access (own or partner's) */
    hasPremiumAccess: boolean;
    /** Whether this is the user's own subscription (vs partner's) */
    isOwnSubscription: boolean;
    /** Formatted expiration/renewal date */
    expirationDate: string;
    /** Callback when upgrade button is pressed */
    onUpgradePress: () => void;
    /** Callback when manage subscription is pressed */
    onManagePress: () => void;
    /** Callback when restore purchases is pressed */
    onRestorePress: () => void;
    /** Whether restore is in progress */
    isRestoring?: boolean;
    /** Animation delay */
    delay?: number;
}

const PREMIUM_FEATURES = [
    { icon: 'layers' as const, text: '50+ Premium Packs' },
    { icon: 'flame' as const, text: 'All Intensity Levels' },
    { icon: 'sparkles' as const, text: 'New Packs Weekly' },
];

export function SubscriptionCard({
    hasPremiumAccess,
    isOwnSubscription,
    expirationDate,
    onUpgradePress,
    onManagePress,
    onRestorePress,
    isRestoring = false,
    delay = 350,
}: SubscriptionCardProps) {
    if (hasPremiumAccess) {
        return (
            <Animated.View
                entering={FadeInDown.delay(delay).duration(500)}
                style={styles.container}
            >
                <ProMemberCard
                    isOwnSubscription={isOwnSubscription}
                    expirationDate={expirationDate}
                    onManagePress={onManagePress}
                />
            </Animated.View>
        );
    }

    return (
        <Animated.View
            entering={FadeInDown.delay(delay).duration(500)}
            style={styles.container}
        >
            <FreeUserCard
                onUpgradePress={onUpgradePress}
                onRestorePress={onRestorePress}
                isRestoring={isRestoring}
            />
        </Animated.View>
    );
}

/** Premium member card - celebratory gold treatment */
function ProMemberCard({
    isOwnSubscription,
    expirationDate,
    onManagePress,
}: {
    isOwnSubscription: boolean;
    expirationDate: string;
    onManagePress: () => void;
}) {
    return (
        <View style={styles.proCard}>
            {/* Gold gradient border effect */}
            <LinearGradient
                colors={[colors.premium.gold, colors.premium.goldDark]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.proBorderGradient}
            />
            <View style={styles.proCardInner}>
                {/* Header with badge */}
                <View style={styles.proHeader}>
                    <LinearGradient
                        colors={gradients.premiumGold as [string, string]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.proBadge}
                    >
                        <Ionicons name="star" size={16} color={colors.background} />
                    </LinearGradient>
                    <View style={styles.proHeaderText}>
                        <Text style={styles.proTitle}>Pro Member</Text>
                        <Text style={styles.proSubtitle}>
                            {isOwnSubscription
                                ? `Renews ${expirationDate}`
                                : "Via partner's subscription"
                            }
                        </Text>
                    </View>
                    {isOwnSubscription && (
                        <TouchableOpacity
                            style={styles.manageButton}
                            onPress={onManagePress}
                            activeOpacity={0.7}
                        >
                            <Text style={styles.manageButtonText}>Manage</Text>
                        </TouchableOpacity>
                    )}
                </View>

                {/* Status row */}
                <View style={styles.proStatusRow}>
                    <View style={styles.proStatusItem}>
                        <Ionicons name="checkmark-circle" size={16} color={colors.premium.gold} />
                        <Text style={styles.proStatusText}>All Packs Unlocked</Text>
                    </View>
                    <View style={styles.proStatusItem}>
                        <Ionicons name="infinite" size={16} color={colors.premium.gold} />
                        <Text style={styles.proStatusText}>Unlimited Access</Text>
                    </View>
                </View>
            </View>
        </View>
    );
}

/** Free user card - premium upsell with shimmer */
function FreeUserCard({
    onUpgradePress,
    onRestorePress,
    isRestoring,
}: {
    onUpgradePress: () => void;
    onRestorePress: () => void;
    isRestoring: boolean;
}) {
    return (
        <ShimmerEffect
            shimmerColor={colors.premium.gold}
            duration={5000}
            style={styles.shimmerContainer}
        >
            <View style={styles.freeCard}>
                {/* Gold gradient border */}
                <LinearGradient
                    colors={[`${colors.premium.gold}60`, `${colors.premium.goldDark}40`]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.freeBorderGradient}
                />
                <View style={styles.freeCardInner}>
                    {/* Header */}
                    <View style={styles.freeHeader}>
                        <LinearGradient
                            colors={gradients.premiumGold as [string, string]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.freeHeaderBadge}
                        >
                            <Ionicons name="sparkles" size={14} color={colors.background} />
                            <Text style={styles.freeHeaderBadgeText}>SAUCI PRO</Text>
                        </LinearGradient>
                    </View>

                    {/* Features list */}
                    <View style={styles.featuresList}>
                        {PREMIUM_FEATURES.map((feature, index) => (
                            <View key={index} style={styles.featureItem}>
                                <View style={styles.featureIconContainer}>
                                    <Ionicons
                                        name={feature.icon}
                                        size={16}
                                        color={colors.premium.gold}
                                    />
                                </View>
                                <Text style={styles.featureText}>{feature.text}</Text>
                            </View>
                        ))}
                    </View>

                    {/* CTA Button */}
                    <TouchableOpacity
                        onPress={onUpgradePress}
                        activeOpacity={0.8}
                        style={styles.ctaButtonContainer}
                    >
                        <LinearGradient
                            colors={gradients.premiumGold as [string, string]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.ctaButton}
                        >
                            <Ionicons name="star" size={18} color={colors.background} />
                            <Text style={styles.ctaButtonText}>Upgrade to Pro</Text>
                        </LinearGradient>
                    </TouchableOpacity>

                    {/* Restore link */}
                    <TouchableOpacity
                        style={styles.restoreLink}
                        onPress={onRestorePress}
                        disabled={isRestoring}
                    >
                        <Text style={styles.restoreLinkText}>
                            {isRestoring ? "Restoring..." : "Restore Purchases"}
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>
        </ShimmerEffect>
    );
}

const styles = StyleSheet.create({
    container: {
        marginBottom: spacing.lg,
        paddingHorizontal: spacing.lg,
    },
    shimmerContainer: {
        borderRadius: radius.lg,
    },

    // Pro Member Card Styles
    proCard: {
        borderRadius: radius.lg,
        overflow: 'hidden',
    },
    proBorderGradient: {
        ...StyleSheet.absoluteFillObject,
        opacity: 0.3,
    },
    proCardInner: {
        backgroundColor: 'rgba(22, 33, 62, 0.8)',
        margin: 1,
        borderRadius: radius.lg - 1,
        padding: spacing.md,
    },
    proHeader: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    proBadge: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
        ...shadows.glow(colors.premium.gold),
    },
    proHeaderText: {
        flex: 1,
        marginLeft: spacing.md,
    },
    proTitle: {
        ...typography.headline,
        color: colors.premium.champagne,
        fontWeight: '700',
    },
    proSubtitle: {
        ...typography.caption1,
        color: colors.textTertiary,
        marginTop: 2,
    },
    manageButton: {
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: radius.md,
        backgroundColor: colors.glass.background,
        borderWidth: 1,
        borderColor: `${colors.premium.gold}40`,
    },
    manageButtonText: {
        ...typography.subhead,
        color: colors.premium.gold,
        fontWeight: '600',
    },
    proStatusRow: {
        flexDirection: 'row',
        marginTop: spacing.md,
        paddingTop: spacing.md,
        borderTopWidth: 1,
        borderTopColor: colors.glass.border,
        gap: spacing.lg,
    },
    proStatusItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
    },
    proStatusText: {
        ...typography.caption1,
        color: colors.textSecondary,
    },

    // Free User Card Styles
    freeCard: {
        borderRadius: radius.lg,
        overflow: 'hidden',
    },
    freeBorderGradient: {
        ...StyleSheet.absoluteFillObject,
    },
    freeCardInner: {
        backgroundColor: 'rgba(22, 33, 62, 0.85)',
        margin: 1,
        borderRadius: radius.lg - 1,
        padding: spacing.lg,
    },
    freeHeader: {
        alignItems: 'center',
        marginBottom: spacing.lg,
    },
    freeHeaderBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: radius.full,
        gap: spacing.xs,
    },
    freeHeaderBadgeText: {
        ...typography.caption1,
        fontWeight: '800',
        letterSpacing: 2,
        color: colors.background,
    },
    featuresList: {
        marginBottom: spacing.lg,
    },
    featureItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: spacing.sm,
    },
    featureIconContainer: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: colors.premium.goldLight,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: spacing.md,
    },
    featureText: {
        ...typography.body,
        color: colors.text,
    },
    ctaButtonContainer: {
        borderRadius: radius.md,
        overflow: 'hidden',
        ...shadows.glow(colors.premium.gold),
    },
    ctaButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: spacing.md,
        gap: spacing.sm,
    },
    ctaButtonText: {
        ...typography.headline,
        color: colors.background,
        fontWeight: '700',
    },
    restoreLink: {
        alignItems: 'center',
        marginTop: spacing.md,
        padding: spacing.sm,
    },
    restoreLinkText: {
        ...typography.caption1,
        color: colors.textTertiary,
    },
});

export default SubscriptionCard;
