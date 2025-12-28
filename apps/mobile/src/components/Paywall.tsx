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
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSubscriptionStore } from "../store";
import { colors, gradients, spacing, radius, typography } from "../theme";
import type { PurchasesPackage } from "../lib/revenuecat";

interface PaywallProps {
    visible: boolean;
    onClose: () => void;
    onSuccess?: () => void;
}

const FEATURES = [
    {
        icon: "heart" as const,
        title: "Unlock All Packs",
        description: "Access every question pack",
    },
    {
        icon: "sparkles" as const,
        title: "Exclusive Content",
        description: "New packs added regularly",
    },
    {
        icon: "people" as const,
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

        const success = await purchasePackage(selectedPackage);
        if (success) {
            onSuccess?.();
            onClose();
        }
    };

    const handleRestore = async () => {
        const restored = await restorePurchases();
        if (restored) {
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
                            <LinearGradient
                                colors={gradients.primary as [string, string]}
                                style={styles.iconContainer}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                            >
                                <Ionicons name="star" size={32} color={colors.text} />
                            </LinearGradient>
                            <Text style={styles.title}>Upgrade to Pro</Text>
                            <Text style={styles.subtitle}>
                                Unlock all premium content for you and your partner
                            </Text>
                        </View>

                        {/* Features */}
                        <View style={styles.features}>
                            {FEATURES.map((feature) => (
                                <View key={feature.title} style={styles.featureRow}>
                                    <View style={styles.featureIcon}>
                                        <Ionicons
                                            name={feature.icon}
                                            size={20}
                                            color={colors.primary}
                                        />
                                    </View>
                                    <View style={styles.featureText}>
                                        <Text style={styles.featureTitle}>{feature.title}</Text>
                                        <Text style={styles.featureDescription}>
                                            {feature.description}
                                        </Text>
                                    </View>
                                </View>
                            ))}
                        </View>

                        {/* Packages */}
                        <View style={styles.packages}>
                            {isLoadingOfferings ? (
                                <View style={styles.loadingContainer}>
                                    <ActivityIndicator color={colors.primary} size="large" />
                                    <Text style={styles.loadingText}>
                                        Loading subscription options...
                                    </Text>
                                </View>
                            ) : offerings?.availablePackages ? (
                                offerings.availablePackages.map((pkg) => {
                                    const isSelected =
                                        selectedPackage?.identifier === pkg.identifier;
                                    const isAnnual = pkg.packageType === "ANNUAL";

                                    return (
                                        <TouchableOpacity
                                            key={pkg.identifier}
                                            onPress={() => setSelectedPackage(pkg)}
                                            activeOpacity={0.7}
                                            style={[
                                                styles.packageCard,
                                                isSelected && styles.packageCardSelected,
                                            ]}
                                        >
                                            {isAnnual && savings && savings > 0 && (
                                                <View style={styles.savingsBadge}>
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
                                                    <Text style={styles.packageTitle}>
                                                        {isAnnual ? "Annual" : "Monthly"}
                                                    </Text>
                                                    <Text style={styles.packagePrice}>
                                                        {formatPrice(pkg)}
                                                    </Text>
                                                </View>
                                            </View>
                                        </TouchableOpacity>
                                    );
                                })
                            ) : (
                                <View style={styles.errorContainer}>
                                    <Text style={styles.errorText}>
                                        Unable to load subscription options.
                                    </Text>
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
                            <TouchableOpacity
                                style={[
                                    styles.purchaseButton,
                                    (!selectedPackage || isPurchasing) &&
                                        styles.purchaseButtonDisabled,
                                ]}
                                onPress={handlePurchase}
                                disabled={!selectedPackage || isPurchasing}
                                activeOpacity={0.8}
                            >
                                {isPurchasing ? (
                                    <ActivityIndicator size="small" color={colors.text} />
                                ) : (
                                    <LinearGradient
                                        colors={gradients.primary as [string, string]}
                                        style={styles.purchaseButtonGradient}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 0 }}
                                    >
                                        <Text style={styles.purchaseButtonText}>Subscribe Now</Text>
                                    </LinearGradient>
                                )}
                            </TouchableOpacity>

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
        backgroundColor: "rgba(0, 0, 0, 0.8)",
        justifyContent: "flex-end",
    },
    content: {
        backgroundColor: colors.backgroundLight,
        borderTopLeftRadius: radius.xxl,
        borderTopRightRadius: radius.xxl,
        maxHeight: "90%",
        borderWidth: 1,
        borderBottomWidth: 0,
        borderColor: colors.glass.border,
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
        backgroundColor: colors.glass.background,
        justifyContent: "center",
        alignItems: "center",
        zIndex: 10,
    },
    header: {
        alignItems: "center",
        marginBottom: spacing.xl,
    },
    iconContainer: {
        width: 72,
        height: 72,
        borderRadius: 36,
        justifyContent: "center",
        alignItems: "center",
        marginBottom: spacing.md,
    },
    title: {
        ...typography.title1,
        color: colors.text,
        marginBottom: spacing.xs,
    },
    subtitle: {
        ...typography.body,
        color: colors.textSecondary,
        textAlign: "center",
    },
    features: {
        marginBottom: spacing.xl,
    },
    featureRow: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: spacing.md,
    },
    featureIcon: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: colors.primaryLight,
        justifyContent: "center",
        alignItems: "center",
        marginRight: spacing.md,
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
        backgroundColor: colors.glass.background,
        borderRadius: radius.lg,
        borderWidth: 2,
        borderColor: colors.glass.border,
        padding: spacing.md,
        overflow: "visible",
    },
    packageCardSelected: {
        borderColor: colors.primary,
        backgroundColor: colors.primaryLight,
    },
    savingsBadge: {
        position: "absolute",
        top: -10,
        right: spacing.md,
        backgroundColor: colors.primary,
        paddingHorizontal: spacing.sm,
        paddingVertical: 4,
        borderRadius: radius.xs,
    },
    savingsText: {
        ...typography.caption2,
        color: colors.text,
        fontWeight: "700",
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
        borderColor: colors.textSecondary,
        justifyContent: "center",
        alignItems: "center",
        marginRight: spacing.md,
    },
    radioOuterSelected: {
        borderColor: colors.primary,
    },
    radioInner: {
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: colors.primary,
    },
    packageInfo: {
        flex: 1,
    },
    packageTitle: {
        ...typography.headline,
        color: colors.text,
    },
    packagePrice: {
        ...typography.subhead,
        color: colors.textSecondary,
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
        backgroundColor: colors.glass.background,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.sm,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: colors.glass.border,
    },
    retryButtonText: {
        ...typography.subhead,
        color: colors.primary,
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
    },
    purchaseButtonDisabled: {
        opacity: 0.5,
    },
    purchaseButtonGradient: {
        paddingVertical: spacing.md,
        alignItems: "center",
    },
    purchaseButtonText: {
        ...typography.headline,
        color: colors.text,
    },
    restoreButton: {
        alignItems: "center",
        marginTop: spacing.md,
        padding: spacing.sm,
    },
    restoreText: {
        ...typography.subhead,
        color: colors.primary,
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
