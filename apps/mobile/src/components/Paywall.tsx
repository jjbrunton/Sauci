import React, { useEffect, useState } from "react";
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    ActivityIndicator,
    ScrollView,
    Platform,
    Pressable,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSubscriptionStore } from "../store";
import { colors, gradients, spacing, radius, typography } from "../theme";
import type { PurchasesPackage } from "../lib/revenuecat";
import { Events } from "../lib/analytics";

interface PaywallProps {
    visible: boolean;
    onClose: () => void;
    onSuccess?: () => void;
}

const FEATURES = [
    {
        icon: "diamond" as const,
        title: "Unlock All Packs",
        description: "Access every premium collection",
    },
    {
        icon: "sparkles" as const,
        title: "Exclusive Content",
        description: "New packs added regularly",
    },
    {
        icon: "heart" as const,
        title: "Share with Partner",
        description: "Both of you get Pro access",
    },
];

export function Paywall({ visible, onClose, onSuccess }: PaywallProps) {
    const {
        offerings,
        isLoadingOfferings,
        isPurchasing,
        error,
        fetchOfferings,
        purchasePackage,
        restorePurchases,
    } = useSubscriptionStore();

    const [selectedPackage, setSelectedPackage] = useState<PurchasesPackage | null>(
        null
    );

    useEffect(() => {
        if (visible && !offerings) {
            fetchOfferings();
        }
        if (visible) {
            Events.paywallShown("paywall");
        }
    }, [visible, offerings, fetchOfferings]);

    useEffect(() => {
        // Auto-select annual package as default (better value)
        if (offerings?.availablePackages) {
            const annual = offerings.availablePackages.find(
                (p) => p.packageType === "ANNUAL"
            );
            setSelectedPackage(annual || offerings.availablePackages[0]);
        }
    }, [offerings]);

    const handlePurchase = async () => {
        if (!selectedPackage) return;

        Events.purchaseInitiated(selectedPackage.packageType || "unknown");
        const success = await purchasePackage(selectedPackage);
        if (success) {
            Events.purchaseCompleted(selectedPackage.packageType || "unknown");
            onSuccess?.();
            onClose();
        }
    };

    const handleRestore = async () => {
        const restored = await restorePurchases();
        if (restored) {
            Events.purchaseRestored();
            onSuccess?.();
            onClose();
        }
    };

    const formatPrice = (pkg: PurchasesPackage) => {
        const price = pkg.product.priceString;
        if (pkg.packageType === "ANNUAL") {
            const monthlyPrice = (pkg.product.price / 12).toFixed(2);
            return `${price}/year (${pkg.product.currencyCode} ${monthlyPrice}/mo)`;
        }
        return `${price}/month`;
    };

    const calculateSavings = () => {
        if (!offerings?.availablePackages) return null;
        const monthly = offerings.availablePackages.find(
            (p) => p.packageType === "MONTHLY"
        );
        const annual = offerings.availablePackages.find(
            (p) => p.packageType === "ANNUAL"
        );

        if (monthly && annual) {
            const yearlyFromMonthly = monthly.product.price * 12;
            const savings = Math.round(
                (1 - annual.product.price / yearlyFromMonthly) * 100
            );
            return savings;
        }
        return null;
    };

    const savings = calculateSavings();


    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <View style={styles.content}>
                    {/* Premium gradient background */}
                    <LinearGradient
                        colors={['rgba(22, 33, 62, 0.98)', 'rgba(13, 13, 26, 1)']}
                        style={StyleSheet.absoluteFill}
                    />
                    {/* Top silk highlight */}
                    <LinearGradient
                        colors={['rgba(212, 175, 55, 0.08)', 'transparent']}
                        style={styles.silkHighlight}
                    />
                    {/* Premium border accent */}
                    <View style={styles.premiumBorderAccent} />

                    <ScrollView
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={styles.scrollContent}
                    >
                        {/* Close Button */}
                        <TouchableOpacity
                            style={styles.closeButton}
                            onPress={onClose}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                            <Ionicons name="close" size={24} color={colors.textSecondary} />
                        </TouchableOpacity>

                        {/* Header */}
                        <View style={styles.header}>
                            {/* Premium label */}
                            <Text style={styles.label}>EXCLUSIVE ACCESS</Text>

                            {/* Icon with glow */}
                            <View style={styles.iconContainer}>
                                <LinearGradient
                                    colors={[colors.premium.gold, colors.premium.goldDark]}
                                    style={StyleSheet.absoluteFill}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                />
                                <Ionicons name="diamond" size={32} color={colors.background} />
                            </View>

                            <Text style={styles.title}>Sauci Pro</Text>

                            {/* Decorative separator */}
                            <View style={styles.separator}>
                                <View style={styles.separatorLine} />
                                <View style={styles.separatorDiamond} />
                                <View style={styles.separatorLine} />
                            </View>

                            <Text style={styles.subtitle}>
                                Unlock all premium content for you and your partner
                            </Text>
                        </View>

                        {/* Features */}
                        <View style={styles.features}>
                            {FEATURES.map((feature, index) => (
                                <View key={feature.title} style={styles.featureRow}>
                                    <View style={styles.featureIcon}>
                                        <Ionicons
                                            name={feature.icon}
                                            size={18}
                                            color={colors.premium.gold}
                                        />
                                    </View>
                                    <View style={styles.featureText}>
                                        <Text style={styles.featureTitle}>{feature.title}</Text>
                                        <Text style={styles.featureDescription}>
                                            {feature.description}
                                        </Text>
                                    </View>
                                    <Ionicons
                                        name="checkmark-circle"
                                        size={20}
                                        color={colors.premium.gold}
                                    />
                                </View>
                            ))}
                        </View>

                        {/* Packages */}
                        <View style={styles.packages}>
                            {isLoadingOfferings ? (
                                <View style={styles.loadingContainer}>
                                    <ActivityIndicator color={colors.premium.gold} size="large" />
                                    <Text style={styles.loadingText}>
                                        Loading options...
                                    </Text>
                                </View>
                            ) : offerings?.availablePackages ? (
                                offerings.availablePackages.map((pkg) => {
                                    const isSelected =
                                        selectedPackage?.identifier === pkg.identifier;
                                    const isAnnual = pkg.packageType === "ANNUAL";

                                    return (
                                        <Pressable
                                            key={pkg.identifier}
                                            onPress={() => setSelectedPackage(pkg)}
                                            style={[
                                                styles.packageCard,
                                                isSelected && styles.packageCardSelected,
                                                isAnnual && styles.packageCardAnnual,
                                            ]}
                                        >
                                            {isAnnual && (
                                                <LinearGradient
                                                    colors={['rgba(212, 175, 55, 0.1)', 'rgba(184, 134, 11, 0.05)']}
                                                    style={StyleSheet.absoluteFill}
                                                />
                                            )}
                                            {isAnnual && savings && savings > 0 && (
                                                <View style={styles.savingsBadge}>
                                                    <LinearGradient
                                                        colors={[colors.premium.gold, colors.premium.goldDark]}
                                                        style={StyleSheet.absoluteFill}
                                                        start={{ x: 0, y: 0 }}
                                                        end={{ x: 1, y: 0 }}
                                                    />
                                                    <Ionicons name="star" size={10} color={colors.background} />
                                                    <Text style={styles.savingsText}>
                                                        SAVE {savings}%
                                                    </Text>
                                                </View>
                                            )}
                                            <View style={styles.packageContent}>
                                                <View
                                                    style={[
                                                        styles.radioOuter,
                                                        isSelected && styles.radioOuterSelected,
                                                    ]}
                                                >
                                                    {isSelected && <View style={styles.radioInner} />}
                                                </View>
                                                <View style={styles.packageInfo}>
                                                    <View style={styles.packageTitleRow}>
                                                        <Text style={[
                                                            styles.packageTitle,
                                                            isAnnual && styles.packageTitleAnnual
                                                        ]}>
                                                            {isAnnual ? "Annual" : "Monthly"}
                                                        </Text>
                                                        {isAnnual && (
                                                            <View style={styles.bestValueBadge}>
                                                                <Text style={styles.bestValueText}>BEST VALUE</Text>
                                                            </View>
                                                        )}
                                                    </View>
                                                    <Text style={[
                                                        styles.packagePrice,
                                                        isAnnual && styles.packagePriceAnnual
                                                    ]}>
                                                        {formatPrice(pkg)}
                                                    </Text>
                                                </View>
                                            </View>
                                        </Pressable>
                                    );
                                })
                            ) : (
                                <View style={styles.errorContainer}>
                                    <Text style={styles.errorText}>
                                        Unable to load subscription options.
                                    </Text>
                                    {error && (
                                        <Text style={[styles.errorText, { fontSize: 12, marginTop: 4 }]}>
                                            {error}
                                        </Text>
                                    )}
                                    <TouchableOpacity
                                        style={styles.retryButton}
                                        onPress={fetchOfferings}
                                    >
                                        <Text style={styles.retryButtonText}>Retry</Text>
                                    </TouchableOpacity>
                                </View>
                            )}
                        </View>

                        {/* Error Message */}
                        {error && (
                            <View style={styles.errorBanner}>
                                <Text style={styles.errorBannerText}>{error}</Text>
                            </View>
                        )}

                        {/* Purchase Button */}
                        <View style={styles.actions}>
                            <Pressable
                                style={[
                                    styles.purchaseButton,
                                    (!selectedPackage || isPurchasing) &&
                                        styles.purchaseButtonDisabled,
                                ]}
                                onPress={handlePurchase}
                                disabled={!selectedPackage || isPurchasing}
                            >
                                {isPurchasing ? (
                                    <View style={styles.purchaseButtonLoading}>
                                        <ActivityIndicator size="small" color={colors.background} />
                                    </View>
                                ) : (
                                    <LinearGradient
                                        colors={[colors.premium.gold, colors.premium.goldDark]}
                                        style={styles.purchaseButtonGradient}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 0 }}
                                    >
                                        <Ionicons name="diamond" size={18} color={colors.background} style={{ marginRight: spacing.sm }} />
                                        <Text style={styles.purchaseButtonText}>Unlock Pro</Text>
                                    </LinearGradient>
                                )}
                            </Pressable>

                            <TouchableOpacity
                                style={styles.restoreButton}
                                onPress={handleRestore}
                                disabled={isPurchasing}
                            >
                                <Text style={styles.restoreText}>Restore Purchases</Text>
                            </TouchableOpacity>
                        </View>

                        {/* Legal */}
                        <View style={styles.legal}>
                            <Text style={styles.legalText}>
                                Payment will be charged to your Apple ID account at confirmation.
                                Subscription automatically renews unless cancelled at least 24 hours
                                before the end of the current period.
                            </Text>
                        </View>
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: "rgba(0, 0, 0, 0.85)",
        justifyContent: "flex-end",
    },
    content: {
        backgroundColor: colors.background,
        borderTopLeftRadius: radius.xxl,
        borderTopRightRadius: radius.xxl,
        maxHeight: "90%",
        borderWidth: 1,
        borderBottomWidth: 0,
        borderColor: 'rgba(212, 175, 55, 0.2)',
        overflow: 'hidden',
    },
    silkHighlight: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 150,
        borderTopLeftRadius: radius.xxl,
        borderTopRightRadius: radius.xxl,
    },
    premiumBorderAccent: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 2,
        backgroundColor: colors.premium.gold,
        opacity: 0.4,
    },
    scrollContent: {
        padding: spacing.lg,
        paddingTop: spacing.xl,
        paddingBottom: Platform.OS === "ios" ? 40 : spacing.lg,
    },
    closeButton: {
        position: "absolute",
        top: spacing.md,
        right: spacing.md,
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        justifyContent: "center",
        alignItems: "center",
        zIndex: 10,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    header: {
        alignItems: "center",
        marginBottom: spacing.xl,
    },
    label: {
        ...typography.caption1,
        fontWeight: '600',
        letterSpacing: 3,
        color: colors.premium.gold,
        textAlign: 'center',
        marginBottom: spacing.md,
    },
    iconContainer: {
        width: 72,
        height: 72,
        borderRadius: 36,
        justifyContent: "center",
        alignItems: "center",
        overflow: 'hidden',
        marginBottom: spacing.md,
        shadowColor: colors.premium.gold,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.6,
        shadowRadius: 20,
        elevation: 12,
    },
    title: {
        ...typography.title1,
        color: colors.text,
        marginBottom: spacing.xs,
        textShadowColor: 'rgba(212, 175, 55, 0.3)',
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: 10,
    },
    separator: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginVertical: spacing.md,
        width: 140,
    },
    separatorLine: {
        flex: 1,
        height: 1,
        backgroundColor: 'rgba(212, 175, 55, 0.3)',
    },
    separatorDiamond: {
        width: 6,
        height: 6,
        backgroundColor: colors.premium.gold,
        transform: [{ rotate: '45deg' }],
        marginHorizontal: spacing.md,
        opacity: 0.8,
    },
    subtitle: {
        ...typography.body,
        color: colors.textSecondary,
        textAlign: "center",
        lineHeight: 24,
    },
    features: {
        marginBottom: spacing.xl,
        backgroundColor: 'rgba(212, 175, 55, 0.05)',
        borderRadius: radius.lg,
        padding: spacing.md,
        borderWidth: 1,
        borderColor: 'rgba(212, 175, 55, 0.1)',
    },
    featureRow: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: spacing.sm,
    },
    featureIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(212, 175, 55, 0.1)',
        justifyContent: "center",
        alignItems: "center",
        marginRight: spacing.md,
        borderWidth: 1,
        borderColor: 'rgba(212, 175, 55, 0.2)',
    },
    featureText: {
        flex: 1,
    },
    featureTitle: {
        ...typography.headline,
        color: colors.text,
    },
    featureDescription: {
        ...typography.subhead,
        color: colors.textSecondary,
    },
    packages: {
        marginBottom: spacing.lg,
        gap: spacing.md,
    },
    loadingContainer: {
        alignItems: "center",
        padding: spacing.xl,
    },
    loadingText: {
        ...typography.subhead,
        color: colors.textSecondary,
        marginTop: spacing.md,
    },
    packageCard: {
        position: "relative",
        backgroundColor: 'rgba(22, 33, 62, 0.4)',
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
        padding: spacing.md,
        overflow: "hidden",
    },
    packageCardSelected: {
        borderColor: colors.premium.gold,
        borderWidth: 2,
    },
    packageCardAnnual: {
        borderColor: 'rgba(212, 175, 55, 0.3)',
    },
    savingsBadge: {
        position: "absolute",
        top: -1,
        right: spacing.md,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: spacing.sm,
        paddingVertical: 4,
        borderBottomLeftRadius: radius.sm,
        borderBottomRightRadius: radius.sm,
        overflow: 'hidden',
    },
    savingsText: {
        ...typography.caption2,
        color: colors.background,
        fontWeight: "800",
        letterSpacing: 0.5,
    },
    packageContent: {
        flexDirection: "row",
        alignItems: "center",
    },
    radioOuter: {
        width: 24,
        height: 24,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: 'rgba(255, 255, 255, 0.3)',
        justifyContent: "center",
        alignItems: "center",
        marginRight: spacing.md,
    },
    radioOuterSelected: {
        borderColor: colors.premium.gold,
    },
    radioInner: {
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: colors.premium.gold,
    },
    packageInfo: {
        flex: 1,
    },
    packageTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    packageTitle: {
        ...typography.headline,
        color: colors.text,
    },
    packageTitleAnnual: {
        color: colors.premium.champagne,
    },
    bestValueBadge: {
        backgroundColor: 'rgba(212, 175, 55, 0.2)',
        paddingHorizontal: spacing.xs,
        paddingVertical: 2,
        borderRadius: radius.xs,
    },
    bestValueText: {
        ...typography.caption2,
        color: colors.premium.gold,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    packagePrice: {
        ...typography.subhead,
        color: colors.textSecondary,
        marginTop: 2,
    },
    packagePriceAnnual: {
        color: colors.premium.champagne,
        opacity: 0.8,
    },
    errorContainer: {
        alignItems: "center",
        padding: spacing.lg,
    },
    errorText: {
        ...typography.subhead,
        color: colors.textSecondary,
        textAlign: "center",
        marginBottom: spacing.md,
    },
    retryButton: {
        backgroundColor: 'rgba(212, 175, 55, 0.1)',
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.sm,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: 'rgba(212, 175, 55, 0.2)',
    },
    retryButtonText: {
        ...typography.subhead,
        color: colors.premium.gold,
        fontWeight: "600",
    },
    errorBanner: {
        backgroundColor: colors.errorLight,
        padding: spacing.md,
        borderRadius: radius.md,
        marginBottom: spacing.md,
    },
    errorBannerText: {
        ...typography.subhead,
        color: colors.error,
        textAlign: "center",
    },
    actions: {
        marginBottom: spacing.lg,
    },
    purchaseButton: {
        borderRadius: radius.lg,
        overflow: "hidden",
        shadowColor: colors.premium.gold,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
    purchaseButtonDisabled: {
        opacity: 0.5,
        shadowOpacity: 0,
    },
    purchaseButtonLoading: {
        paddingVertical: spacing.md,
        alignItems: "center",
        backgroundColor: colors.premium.gold,
    },
    purchaseButtonGradient: {
        flexDirection: 'row',
        paddingVertical: spacing.md,
        alignItems: "center",
        justifyContent: 'center',
    },
    purchaseButtonText: {
        ...typography.headline,
        color: colors.background,
        fontWeight: '700',
    },
    restoreButton: {
        alignItems: "center",
        marginTop: spacing.md,
        padding: spacing.sm,
    },
    restoreText: {
        ...typography.subhead,
        color: colors.premium.gold,
        opacity: 0.8,
    },
    legal: {
        paddingHorizontal: spacing.md,
    },
    legalText: {
        ...typography.caption1,
        color: colors.textTertiary,
        textAlign: "center",
        lineHeight: 18,
    },
});

export default Paywall;
