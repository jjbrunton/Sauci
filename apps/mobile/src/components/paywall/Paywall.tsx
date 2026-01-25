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
    Linking,
    Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useAuthStore, useSubscriptionStore } from "../../store";
import { colors, gradients, spacing, radius, typography, shadows } from "../../theme";
import type { PurchasesPackage } from "../../lib/revenuecat";
import { Events } from "../../lib/analytics";

const logoImage = require("../../../assets/logo.png");

interface PaywallProps {
    visible: boolean;
    onClose: () => void;
    onSuccess?: () => void;
    /** Optional RevenueCat offering identifier. If not provided, uses the default offering. */
    offeringId?: string;
}

const FEATURES = [
    {
        icon: "layers" as const,
        title: "All Premium Packs",
        description: "Unlock every intimate collection",
    },
    {
        icon: "sparkles" as const,
        title: "New Content Weekly",
        description: "Fresh questions added regularly",
    },
    {
        icon: "heart" as const,
        title: "Shared Access",
        description: "Your partner gets Pro too",
    },
];

export function Paywall({ visible, onClose, onSuccess, offeringId }: PaywallProps) {
    const { isAnonymous } = useAuthStore();

    const handleClose = (reason: "dismiss" | "success" | "restore" | "system") => {
        Events.paywallClosed("paywall", reason);
        onClose();
    };
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
    const [showGuestConfirm, setShowGuestConfirm] = useState(false);
    const [guestConfirmed, setGuestConfirmed] = useState(false);

    useEffect(() => {
        if (visible) {
            fetchOfferings(offeringId);
            Events.paywallShown("paywall");
            setGuestConfirmed(false);
            setShowGuestConfirm(false);
        }
    }, [visible, offeringId, fetchOfferings]);

    useEffect(() => {
        // Auto-select annual package as default (better value)
        if (offerings?.availablePackages) {
            const annual = offerings.availablePackages.find(
                (p) => p.packageType === "ANNUAL"
            );
            setSelectedPackage(annual || offerings.availablePackages[0]);
        }
    }, [offerings]);

    const doPurchase = async () => {
        if (!selectedPackage) return;

        const packageType = selectedPackage.packageType || "unknown";
        Events.purchaseInitiated(packageType);

        const result = await purchasePackage(selectedPackage);
        if (result.success) {
            Events.purchaseCompleted(packageType);
            onSuccess?.();
            handleClose("success");
            return;
        }

        if (result.cancelled) {
            Events.purchaseCancelled(packageType, result.errorCode);
            return;
        }

        Events.purchaseFailed(packageType, result.errorCode, result.errorMessage);
    };

    const handlePurchase = async () => {
        if (!selectedPackage) return;

        if (isAnonymous && !guestConfirmed) {
            setShowGuestConfirm(true);
            return;
        }

        await doPurchase();
    };

    const handleRestore = async () => {
        const restored = await restorePurchases();
        if (restored) {
            Events.purchaseRestored();
            onSuccess?.();
            handleClose("restore");
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
            onRequestClose={() => handleClose("system")}
        >
            <View style={styles.overlay}>
                <View style={styles.content}>
                    {/* Gold accent line at top */}
                    <LinearGradient
                        colors={[colors.premium.gold, colors.premium.goldDark]}
                        style={styles.topAccent}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                    />

                    <ScrollView
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={styles.scrollContent}
                    >
                        {/* Close Button */}
                        <TouchableOpacity
                            style={styles.closeButton}
                            onPress={() => handleClose("dismiss")}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                            <Ionicons name="close" size={22} color={colors.textSecondary} />
                        </TouchableOpacity>

                        {/* Header */}
                        <View style={styles.header}>
                            {/* Sauci logo */}
                            <View style={styles.logoContainer}>
                                <Image
                                    source={logoImage}
                                    style={styles.logo}
                                    resizeMode="contain"
                                />
                            </View>

                            <Text style={styles.title}>Sauci Pro</Text>
                            <Text style={styles.subtitle}>
                                Unlock the full intimate experience
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
                                            color={colors.premium.gold}
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
                                    <ActivityIndicator color={colors.premium.gold} size="large" />
                                    <Text style={styles.loadingText}>
                                        Loading options...
                                    </Text>
                                </View>
                            ) : offerings?.availablePackages ? (
                                <>
                                    {/* Annual package - hero card */}
                                    {offerings.availablePackages
                                        .filter((p) => p.packageType === "ANNUAL")
                                        .map((pkg) => {
                                            const isSelected = selectedPackage?.identifier === pkg.identifier;
                                            return (
                                                <Pressable
                                                    key={pkg.identifier}
                                                    onPress={() => setSelectedPackage(pkg)}
                                                    style={[
                                                        styles.packageCard,
                                                        styles.packageCardAnnual,
                                                        isSelected && styles.packageCardSelected,
                                                    ]}
                                                >
                                                    {/* Subtle gold tint background */}
                                                    <View style={styles.annualBackground} />

                                                    {/* Best value badge */}
                                                    {savings && savings > 0 && (
                                                        <View style={styles.savingsBadge}>
                                                            <LinearGradient
                                                                colors={[colors.premium.gold, colors.premium.goldDark]}
                                                                style={StyleSheet.absoluteFill}
                                                                start={{ x: 0, y: 0 }}
                                                                end={{ x: 1, y: 0 }}
                                                            />
                                                            <Text style={styles.savingsText}>
                                                                SAVE {savings}%
                                                            </Text>
                                                        </View>
                                                    )}

                                                    <View style={styles.packageContent}>
                                                        <View style={[
                                                            styles.radioOuter,
                                                            isSelected && styles.radioOuterSelected,
                                                        ]}>
                                                            {isSelected && <View style={styles.radioInner} />}
                                                        </View>
                                                        <View style={styles.packageInfo}>
                                                            <View style={styles.packageHeader}>
                                                                <Text style={styles.packageTitleAnnual}>Annual</Text>
                                                                <View style={styles.recommendedBadge}>
                                                                    <Ionicons name="star" size={10} color={colors.premium.gold} />
                                                                    <Text style={styles.recommendedText}>BEST VALUE</Text>
                                                                </View>
                                                            </View>
                                                            <Text style={styles.packagePriceAnnual}>
                                                                {formatPrice(pkg)}
                                                            </Text>
                                                        </View>
                                                    </View>
                                                </Pressable>
                                            );
                                        })}

                                    {/* Monthly package */}
                                    {offerings.availablePackages
                                        .filter((p) => p.packageType === "MONTHLY")
                                        .map((pkg) => {
                                            const isSelected = selectedPackage?.identifier === pkg.identifier;
                                            return (
                                                <Pressable
                                                    key={pkg.identifier}
                                                    onPress={() => setSelectedPackage(pkg)}
                                                    style={[
                                                        styles.packageCard,
                                                        isSelected && styles.packageCardSelected,
                                                    ]}
                                                >
                                                    <View style={styles.packageContent}>
                                                        <View style={[
                                                            styles.radioOuter,
                                                            isSelected && styles.radioOuterSelected,
                                                        ]}>
                                                            {isSelected && <View style={styles.radioInner} />}
                                                        </View>
                                                        <View style={styles.packageInfo}>
                                                            <Text style={styles.packageTitle}>Monthly</Text>
                                                            <Text style={styles.packagePrice}>
                                                                {formatPrice(pkg)}
                                                            </Text>
                                                        </View>
                                                    </View>
                                                </Pressable>
                                            );
                                        })}
                                </>
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
                                        onPress={() => fetchOfferings(offeringId)}
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
                            <View style={styles.legalLinks}>
                                <TouchableOpacity
                                    onPress={() => Linking.openURL("https://sauci.app/terms")}
                                >
                                    <Text style={styles.legalLinkText}>Terms</Text>
                                </TouchableOpacity>
                                <Text style={styles.legalSeparator}>•</Text>
                                <TouchableOpacity
                                    onPress={() => Linking.openURL("https://sauci.app/privacy")}
                                >
                                    <Text style={styles.legalLinkText}>Privacy</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </ScrollView>

                    {/* Guest confirmation modal */}
                    {showGuestConfirm && (
                        <View style={styles.guestConfirmOverlay}>
                            <Pressable
                                style={StyleSheet.absoluteFill}
                                onPress={() => setShowGuestConfirm(false)}
                            />
                            <View style={styles.guestConfirmCard}>
                                <View style={styles.guestConfirmHeader}>
                                    <View style={styles.guestConfirmIconWrapper}>
                                        <Ionicons name="shield-checkmark" size={24} color={colors.premium.gold} />
                                    </View>
                                    <TouchableOpacity
                                        onPress={() => setShowGuestConfirm(false)}
                                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                        style={styles.guestConfirmClose}
                                    >
                                        <Ionicons name="close" size={18} color={colors.textSecondary} />
                                    </TouchableOpacity>
                                </View>

                                <Text style={styles.guestConfirmTitle}>Save your account first?</Text>
                                <Text style={styles.guestConfirmBody}>
                                    Unsaved accounts can't be recovered if you delete the app or switch devices.
                                    Saving protects your Pro access.
                                </Text>

                                <View style={styles.guestConfirmActions}>
                                    <Pressable
                                        style={styles.guestConfirmPrimary}
                                        onPress={async () => {
                                            setShowGuestConfirm(false);
                                            handleClose("dismiss");
                                            router.push("/(app)/settings/save-account" as any);
                                        }}
                                    >
                                        <LinearGradient
                                            colors={[colors.premium.gold, colors.premium.goldDark]}
                                            style={styles.guestConfirmPrimaryGradient}
                                            start={{ x: 0, y: 0 }}
                                            end={{ x: 1, y: 0 }}
                                        >
                                            <Text style={styles.guestConfirmPrimaryText}>Save account</Text>
                                        </LinearGradient>
                                    </Pressable>

                                    <Pressable
                                        style={styles.guestConfirmSecondary}
                                        onPress={async () => {
                                            setGuestConfirmed(true);
                                            setShowGuestConfirm(false);
                                            await doPurchase();
                                        }}
                                    >
                                        <Text style={styles.guestConfirmSecondaryText}>Continue anyway</Text>
                                    </Pressable>
                                </View>
                            </View>
                        </View>
                    )}
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
        maxHeight: "92%",
        overflow: 'hidden',
    },
    topAccent: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 3,
        borderTopLeftRadius: radius.xxl,
        borderTopRightRadius: radius.xxl,
    },
    scrollContent: {
        padding: spacing.lg,
        paddingTop: spacing.xxl,
        paddingBottom: Platform.OS === "ios" ? 44 : spacing.xl,
    },
    closeButton: {
        position: "absolute",
        top: spacing.sm,
        right: spacing.sm,
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: colors.backgroundLight,
        justifyContent: "center",
        alignItems: "center",
        zIndex: 10,
    },

    // Header
    header: {
        alignItems: "center",
        marginBottom: spacing.xl,
    },
    logoContainer: {
        width: 88,
        height: 88,
        justifyContent: "center",
        alignItems: "center",
        marginBottom: spacing.lg,
    },
    logo: {
        width: 88,
        height: 88,
    },
    title: {
        ...typography.largeTitle,
        color: colors.text,
        marginBottom: spacing.xs,
    },
    subtitle: {
        ...typography.body,
        color: colors.textSecondary,
        textAlign: "center",
    },

    // Features
    features: {
        marginBottom: spacing.xl,
        gap: spacing.sm,
    },
    featureRow: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
        backgroundColor: colors.backgroundLight,
        borderRadius: radius.md,
    },
    featureIcon: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: colors.premium.goldLight,
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
        marginTop: 2,
    },

    // Packages
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
        backgroundColor: colors.backgroundLight,
        borderRadius: radius.lg,
        borderWidth: 2,
        borderColor: colors.border,
        padding: spacing.md,
        overflow: "hidden",
    },
    packageCardSelected: {
        borderColor: colors.premium.gold,
    },
    packageCardAnnual: {
        borderColor: colors.premium.goldLight,
    },
    annualBackground: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: colors.premium.goldLight,
        opacity: 0.3,
    },
    savingsBadge: {
        position: "absolute",
        top: 0,
        right: spacing.md,
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
        borderColor: colors.border,
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
    packageHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    packageTitle: {
        ...typography.headline,
        color: colors.text,
    },
    packageTitleAnnual: {
        ...typography.headline,
        color: colors.premium.champagne,
    },
    recommendedBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: colors.premium.goldLight,
        paddingHorizontal: spacing.sm,
        paddingVertical: 2,
        borderRadius: radius.xs,
    },
    recommendedText: {
        ...typography.caption2,
        color: colors.premium.gold,
        fontWeight: '700',
        letterSpacing: 0.3,
    },
    packagePrice: {
        ...typography.subhead,
        color: colors.textSecondary,
        marginTop: 2,
    },
    packagePriceAnnual: {
        ...typography.subhead,
        color: colors.premium.champagne,
        marginTop: 2,
    },

    // Error states
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
        backgroundColor: colors.premium.goldLight,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.sm,
        borderRadius: radius.md,
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

    // Actions
    actions: {
        marginBottom: spacing.lg,
    },
    purchaseButton: {
        borderRadius: radius.lg,
        overflow: "hidden",
        ...shadows.lg,
        shadowColor: colors.premium.gold,
        shadowOpacity: 0.4,
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
        paddingVertical: spacing.md,
        alignItems: "center",
        justifyContent: 'center',
    },
    purchaseButtonText: {
        ...typography.headline,
        color: colors.background,
        fontWeight: '700',
        fontSize: 18,
    },
    restoreButton: {
        alignItems: "center",
        marginTop: spacing.md,
        padding: spacing.sm,
    },
    restoreText: {
        ...typography.subhead,
        color: colors.textSecondary,
    },

    // Legal
    legal: {
        paddingHorizontal: spacing.sm,
    },
    legalText: {
        ...typography.caption1,
        color: colors.textTertiary,
        textAlign: "center",
        lineHeight: 18,
    },
    legalLinks: {
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "center",
        marginTop: spacing.sm,
        gap: spacing.sm,
    },
    legalLinkText: {
        ...typography.caption1,
        color: colors.textSecondary,
        textDecorationLine: "underline",
    },
    legalSeparator: {
        ...typography.caption1,
        color: colors.textTertiary,
    },

    // Guest confirm modal
    guestConfirmOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: "rgba(0, 0, 0, 0.8)",
        justifyContent: "center",
        alignItems: "center",
        padding: spacing.lg,
    },
    guestConfirmCard: {
        width: "100%",
        maxWidth: 400,
        backgroundColor: colors.backgroundLight,
        borderRadius: radius.xl,
        padding: spacing.lg,
        borderWidth: 1,
        borderColor: colors.border,
    },
    guestConfirmHeader: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: spacing.md,
    },
    guestConfirmIconWrapper: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: colors.premium.goldLight,
        justifyContent: "center",
        alignItems: "center",
    },
    guestConfirmClose: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: colors.background,
        justifyContent: "center",
        alignItems: "center",
    },
    guestConfirmTitle: {
        ...typography.title3,
        color: colors.text,
        marginBottom: spacing.sm,
    },
    guestConfirmBody: {
        ...typography.body,
        color: colors.textSecondary,
        lineHeight: 22,
        marginBottom: spacing.lg,
    },
    guestConfirmActions: {
        gap: spacing.sm,
    },
    guestConfirmPrimary: {
        borderRadius: radius.lg,
        overflow: 'hidden',
    },
    guestConfirmPrimaryGradient: {
        paddingVertical: spacing.md,
        alignItems: "center",
    },
    guestConfirmPrimaryText: {
        ...typography.headline,
        color: colors.background,
        fontWeight: "700",
    },
    guestConfirmSecondary: {
        backgroundColor: colors.background,
        paddingVertical: spacing.md,
        borderRadius: radius.lg,
        alignItems: "center",
        borderWidth: 1,
        borderColor: colors.border,
    },
    guestConfirmSecondaryText: {
        ...typography.subhead,
        color: colors.textSecondary,
        fontWeight: "600",
    },
});

export default Paywall;
