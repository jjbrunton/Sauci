import { View, Text, StyleSheet, RefreshControl, Platform, Alert, Pressable } from "react-native";
import { usePacksStore, useAuthStore, useSubscriptionStore } from "../../../src/store";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useMemo, useState, useCallback } from "react";
import Animated, {
    FadeIn,
    FadeOut,
    useAnimatedStyle,
    useSharedValue,
    withTiming,
    useAnimatedScrollHandler,
    interpolate,
    Extrapolation,
} from "react-native-reanimated";
import { BlurView } from "expo-blur";
import { GradientBackground } from "../../../src/components/ui";
import { Paywall } from "../../../src/components/paywall";
import { PackTeaser } from "../../../src/components/PackTeaser";
import { colors, spacing, radius, typography } from "../../../src/theme";
import { getPackIconName } from "../../../src/lib/packIcons";
import type { QuestionPack, Category } from "../../../src/types";

const HEADER_MAX_HEIGHT = 180;
const HEADER_MIN_HEIGHT = 100;
const HEADER_SCROLL_DISTANCE = HEADER_MAX_HEIGHT - HEADER_MIN_HEIGHT;

const INTENSITY_LABELS: Record<number, string> = {
    1: "Light",
    2: "Mild",
    3: "Moderate",
    4: "Spicy",
    5: "Intense",
};

const clampIntensity = (value: number) => Math.min(5, Math.max(1, Math.round(value)));

const isValidIntensity = (value?: number | null): value is number =>
    typeof value === "number" && value >= 1 && value <= 5;

const getIntensityDisplay = (pack: QuestionPack) => {
    const min = isValidIntensity(pack.min_intensity) ? pack.min_intensity : null;
    const max = isValidIntensity(pack.max_intensity) ? pack.max_intensity : null;
    const avg = typeof pack.avg_intensity === "number" ? clampIntensity(pack.avg_intensity) : null;

    const flameCount = max ?? avg ?? (pack.is_explicit ? 5 : 2);
    const label = min && max
        ? min === max
            ? INTENSITY_LABELS[min]
            : `${INTENSITY_LABELS[min]} - ${INTENSITY_LABELS[max]}`
        : INTENSITY_LABELS[flameCount];

    return { flameCount, label };
};


interface PackRowProps {
    pack: QuestionPack;
    isEnabled: boolean;
    isPremiumLocked: boolean;
    isExpanded: boolean;
    onToggle: () => void;
    onPress: () => void;
    onInfoPress: () => void;
}

function PackRow({ pack, isEnabled, isPremiumLocked, isExpanded, onToggle, onPress, onInfoPress }: PackRowProps) {
    const questionCount = pack.questions?.[0]?.count || 0;
    const intensityDisplay = getIntensityDisplay(pack);


    return (
        <Pressable onPress={onPress} style={styles.packRow}>
            <View style={styles.packRowMain}>
                <View style={[styles.packIcon, isEnabled && styles.packIconEnabled]}>
                    <Ionicons
                        name={getPackIconName(pack.icon)}
                        size={20}
                        color={isEnabled ? colors.primary : colors.textSecondary}
                    />
                </View>

                <View style={styles.packContent}>
                    <View style={styles.packTitleRow}>
                        <Text style={styles.packName} numberOfLines={1}>{pack.name}</Text>
                        {pack.is_premium && (
                            <View style={[styles.premiumBadge, isPremiumLocked && styles.premiumBadgeLocked]}>
                                <Ionicons
                                    name={isPremiumLocked ? "lock-closed" : "sparkles"}
                                    size={12}
                                    color={colors.premium.gold}
                                />
                                <Text style={styles.premiumBadgeText}>PRO</Text>
                            </View>
                        )}
                    </View>
                    <Text style={styles.packMeta}>
                        {questionCount} {questionCount === 1 ? "question" : "questions"}
                        {isEnabled && <Text style={styles.packMetaEnabled}> · Enabled</Text>}
                    </Text>
                    <View style={styles.packIntensityRow}>
                        <View style={styles.packIntensityFlames}>
                            {Array.from({ length: 5 }).map((_, index) => (
                                <Ionicons
                                    key={`intensity-${pack.id}-${index}`}
                                    name={index < intensityDisplay.flameCount ? "flame" : "flame-outline"}
                                    size={12}
                                    color={index < intensityDisplay.flameCount ? colors.primary : colors.textTertiary}
                                />
                            ))}
                        </View>
                        <Text style={styles.packIntensityText}>{intensityDisplay.label}</Text>
                    </View>
                </View>


                <Ionicons
                    name={isExpanded ? "chevron-up" : "chevron-down"}
                    size={20}
                    color={colors.textTertiary}
                />
            </View>

            {isExpanded && (
                <Animated.View
                    entering={FadeIn.duration(200)}
                    exiting={FadeOut.duration(150)}
                    style={styles.packExpanded}
                >
                    {pack.description && (
                        <Text style={styles.packDescription}>{pack.description}</Text>
                    )}
                    <View style={styles.packActions}>
                        <Pressable style={styles.packInfoButton} onPress={onInfoPress}>
                            <Ionicons name="eye-outline" size={18} color={colors.textSecondary} />
                            <Text style={styles.packInfoButtonText}>Preview</Text>
                        </Pressable>

                        <Pressable
                            style={[
                                styles.packToggleButton,
                                isEnabled && styles.packToggleButtonEnabled,
                                isPremiumLocked && styles.packToggleButtonLocked,
                            ]}
                            onPress={onToggle}
                        >
                            {isPremiumLocked ? (
                                <>
                                    <Ionicons name="lock-closed" size={16} color={colors.premium.gold} />
                                    <Text style={[styles.packToggleButtonText, styles.packToggleButtonTextLocked]}>
                                        Unlock
                                    </Text>
                                </>
                            ) : isEnabled ? (
                                <>
                                    <Ionicons name="checkmark" size={16} color={colors.primary} />
                                    <Text style={[styles.packToggleButtonText, styles.packToggleButtonTextEnabled]}>
                                        Enabled
                                    </Text>
                                </>
                            ) : (
                                <>
                                    <Ionicons name="add" size={16} color={colors.text} />
                                    <Text style={styles.packToggleButtonText}>Enable</Text>
                                </>
                            )}
                        </Pressable>
                    </View>
                </Animated.View>
            )}
        </Pressable>
    );
}

interface CategorySectionProps {
    category: Category;
    packs: QuestionPack[];
    enabledPackIds: string[];
    hasPremiumAccess: boolean;
    expandedPackId: string | null;
    onPackPress: (packId: string) => void;
    onPackToggle: (pack: QuestionPack) => void;
    onPackInfo: (pack: QuestionPack) => void;
}

function CategorySection({
    category,
    packs,
    enabledPackIds,
    hasPremiumAccess,
    expandedPackId,
    onPackPress,
    onPackToggle,
    onPackInfo,
}: CategorySectionProps) {
    const [isCollapsed, setIsCollapsed] = useState(false);
    const enabledCount = packs.filter(p => enabledPackIds.includes(p.id)).length;

    const rotateAnim = useSharedValue(0);

    const chevronStyle = useAnimatedStyle(() => ({
        transform: [{ rotate: `${rotateAnim.value}deg` }],
    }));

    const handleToggleCollapse = () => {
        rotateAnim.value = withTiming(isCollapsed ? 0 : -90, { duration: 200 });
        setIsCollapsed(!isCollapsed);
    };

    return (
        <View style={styles.categorySection}>
            <Pressable style={styles.categoryHeader} onPress={handleToggleCollapse}>
                <View style={styles.categoryHeaderLeft}>
                    <Ionicons
                        name={getPackIconName(category.icon)}
                        size={16}
                        color={colors.textSecondary}
                    />
                    <Text style={styles.categoryName}>{category.name}</Text>
                    {enabledCount > 0 && (
                        <View style={styles.categoryBadge}>
                            <Text style={styles.categoryBadgeText}>{enabledCount}</Text>
                        </View>
                    )}
                </View>
                <Animated.View style={chevronStyle}>
                    <Ionicons name="chevron-down" size={20} color={colors.textSecondary} />
                </Animated.View>
            </Pressable>

            {!isCollapsed && (
                <Animated.View
                    entering={FadeIn.duration(200)}
                    exiting={FadeOut.duration(150)}
                    style={styles.packsList}
                >
                    {packs.map((pack) => (
                        <PackRow
                            key={pack.id}
                            pack={pack}
                            isEnabled={enabledPackIds.includes(pack.id)}
                            isPremiumLocked={pack.is_premium && !hasPremiumAccess}
                            isExpanded={expandedPackId === pack.id}
                            onPress={() => onPackPress(pack.id)}
                            onToggle={() => onPackToggle(pack)}
                            onInfoPress={() => onPackInfo(pack)}
                        />
                    ))}
                </Animated.View>
            )}
        </View>
    );
}

export default function QuestionPacksScreen() {
    const { packs, categories, enabledPackIds, togglePack, isLoading, fetchPacks } = usePacksStore();
    const { user, partner } = useAuthStore();
    const { subscription } = useSubscriptionStore();

    const [expandedPackId, setExpandedPackId] = useState<string | null>(null);
    const [showPaywall, setShowPaywall] = useState(false);
    const [showTeaser, setShowTeaser] = useState(false);
    const [teaserPack, setTeaserPack] = useState<QuestionPack | null>(null);

    const scrollY = useSharedValue(0);

    const scrollHandler = useAnimatedScrollHandler({
        onScroll: (event) => {
            scrollY.value = event.contentOffset.y;
        },
    });

    const hasPremiumAccess = useMemo(() => {
        return user?.is_premium || partner?.is_premium || subscription.isProUser;
    }, [user?.is_premium, partner?.is_premium, subscription.isProUser]);

    const packsByCategory = useMemo(() => {
        const grouped = new Map<string, QuestionPack[]>();
        categories.forEach(cat => grouped.set(cat.id, []));
        grouped.set("uncategorized", []);
        packs.forEach(pack => {
            const catId = pack.category_id || "uncategorized";
            const existing = grouped.get(catId) || [];
            existing.push(pack);
            grouped.set(catId, existing);
        });
        return grouped;
    }, [packs, categories]);

    const handlePackPress = useCallback((packId: string) => {
        setExpandedPackId(current => current === packId ? null : packId);
    }, []);

    const handlePackToggle = useCallback(async (pack: QuestionPack) => {
        if (pack.is_premium && !hasPremiumAccess) {
            setTeaserPack(pack);
            setShowTeaser(true);
            return;
        }
        const result = await togglePack(pack.id);
        if (!result.success && result.reason === "no_couple") {
            Alert.alert(
                "Pair with Partner",
                "You need to pair with your partner before you can customise question packs.",
                [
                    { text: "Later", style: "cancel" },
                    { text: "Pair Now", onPress: () => router.push("/pairing") }
                ]
            );
        }
    }, [hasPremiumAccess, togglePack]);

    const handlePackInfo = useCallback((pack: QuestionPack) => {
        const isPremiumLocked = pack.is_premium && !hasPremiumAccess;
        if (isPremiumLocked) {
            setTeaserPack(pack);
            setShowTeaser(true);
        } else {
            router.push(`/pack/${pack.id}`);
        }
    }, [hasPremiumAccess]);

    const handleTeaserUnlock = useCallback(() => {
        setShowTeaser(false);
        setShowPaywall(true);
    }, []);

    const handleTeaserClose = useCallback(() => {
        setShowTeaser(false);
        setTeaserPack(null);
    }, []);

    const enabledPackCount = enabledPackIds.length;
    const totalQuestions = packs
        .filter(p => enabledPackIds.includes(p.id))
        .reduce((sum, p) => sum + (p.questions?.[0]?.count || 0), 0);

    // Animated styles for collapsing header
    const largeHeaderStyle = useAnimatedStyle(() => {
        const opacity = interpolate(
            scrollY.value,
            [0, HEADER_SCROLL_DISTANCE * 0.5],
            [1, 0],
            Extrapolation.CLAMP
        );
        const translateY = interpolate(
            scrollY.value,
            [0, HEADER_SCROLL_DISTANCE],
            [0, -20],
            Extrapolation.CLAMP
        );
        return { opacity, transform: [{ translateY }] };
    });

    const compactHeaderStyle = useAnimatedStyle(() => {
        const opacity = interpolate(
            scrollY.value,
            [HEADER_SCROLL_DISTANCE * 0.5, HEADER_SCROLL_DISTANCE],
            [0, 1],
            Extrapolation.CLAMP
        );
        return { opacity };
    });

    const navBarBackgroundStyle = useAnimatedStyle(() => {
        const opacity = interpolate(
            scrollY.value,
            [0, HEADER_SCROLL_DISTANCE * 0.8],
            [0, 1],
            Extrapolation.CLAMP
        );
        return { opacity };
    });

    return (
        <GradientBackground>
            <View style={styles.container}>
                {/* Fixed Nav Bar */}
                <View style={styles.navBar}>
                    {/* Nav bar background with blur */}
                    <Animated.View style={[styles.navBarBackground, navBarBackgroundStyle]}>
                        {Platform.OS === "ios" ? (
                            <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />
                        ) : (
                            <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(13, 13, 26, 0.95)" }]} />
                        )}
                    </Animated.View>

                    {/* Back button */}
                    <Pressable
                        style={styles.backButton}
                        onPress={() => router.back()}
                        hitSlop={8}
                    >
                        <Ionicons name="chevron-back" size={24} color={colors.text} />
                    </Pressable>

                    {/* Compact title (fades in on scroll) */}
                    <Animated.Text style={[styles.navBarTitle, compactHeaderStyle]}>
                        Question Packs
                    </Animated.Text>

                    {/* Spacer for alignment */}
                    <View style={styles.navBarSpacer} />
                </View>

                {/* Scrollable Content */}
                <Animated.ScrollView
                    showsVerticalScrollIndicator={false}
                    onScroll={scrollHandler}
                    scrollEventThrottle={16}
                    refreshControl={
                        <RefreshControl
                            refreshing={isLoading}
                            onRefresh={fetchPacks}
                            tintColor={colors.primary}
                            colors={[colors.primary]}
                            progressViewOffset={HEADER_MAX_HEIGHT}
                        />
                    }
                    contentContainerStyle={styles.scrollContent}
                >
                    {/* Large Header (fades out on scroll) */}
                    <Animated.View style={[styles.largeHeader, largeHeaderStyle]}>
                        <Text style={styles.label}>COLLECTION</Text>
                        <Text style={styles.title}>Question Packs</Text>

                        <View style={styles.separator}>
                            <View style={styles.separatorLine} />
                            <View style={styles.separatorDiamond} />
                            <View style={styles.separatorLine} />
                        </View>

                        <View style={styles.statsBadge}>
                            <Ionicons name="checkmark-circle" size={14} color={colors.primary} />
                            <Text style={styles.statsBadgeText}>
                                {totalQuestions} {totalQuestions === 1 ? "question" : "questions"} from {enabledPackCount} {enabledPackCount === 1 ? "pack" : "packs"}
                            </Text>
                        </View>
                    </Animated.View>

                    {/* Categories */}
                    <View style={styles.categoriesContainer}>
                        {categories.map(category => {
                            const categoryPacks = packsByCategory.get(category.id) || [];
                            if (categoryPacks.length === 0) return null;

                            return (
                                <CategorySection
                                    key={category.id}
                                    category={category}
                                    packs={categoryPacks}
                                    enabledPackIds={enabledPackIds}
                                    hasPremiumAccess={hasPremiumAccess}
                                    expandedPackId={expandedPackId}
                                    onPackPress={handlePackPress}
                                    onPackToggle={handlePackToggle}
                                    onPackInfo={handlePackInfo}
                                />
                            );
                        })}

                        {(packsByCategory.get("uncategorized")?.length || 0) > 0 && (
                            <CategorySection
                                category={{ id: "uncategorized", name: "Other", description: null, icon: "📁", sort_order: 999, created_at: "" }}
                                packs={packsByCategory.get("uncategorized") || []}
                                enabledPackIds={enabledPackIds}
                                hasPremiumAccess={hasPremiumAccess}
                                expandedPackId={expandedPackId}
                                onPackPress={handlePackPress}
                                onPackToggle={handlePackToggle}
                                onPackInfo={handlePackInfo}
                            />
                        )}
                    </View>
                </Animated.ScrollView>

                {/* Modals */}
                {teaserPack && (
                    <PackTeaser
                        visible={showTeaser}
                        packId={teaserPack.id}
                        packName={teaserPack.name}
                        packIcon={teaserPack.icon}
                        onClose={handleTeaserClose}
                        onUnlock={handleTeaserUnlock}
                    />
                )}

                <Paywall
                    visible={showPaywall}
                    onClose={() => setShowPaywall(false)}
                    onSuccess={() => fetchPacks()}
                />
            </View>
        </GradientBackground>
    );
}

const NAV_BAR_HEIGHT = 44;
const STATUS_BAR_HEIGHT = 60; // Match other pages

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },

    // Fixed Nav Bar
    navBar: {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        height: STATUS_BAR_HEIGHT + NAV_BAR_HEIGHT,
        flexDirection: "row",
        alignItems: "center",
        paddingTop: STATUS_BAR_HEIGHT - 10,
        paddingHorizontal: spacing.md,
        zIndex: 100,
    },
    navBarBackground: {
        ...StyleSheet.absoluteFillObject,
        borderBottomWidth: 1,
        borderBottomColor: "rgba(255, 255, 255, 0.1)",
        overflow: "hidden",
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: "rgba(255, 255, 255, 0.1)",
        justifyContent: "center",
        alignItems: "center",
    },
    navBarTitle: {
        flex: 1,
        ...typography.headline,
        color: colors.text,
        textAlign: "center",
        marginRight: 40, // Balance with back button
    },
    navBarSpacer: {
        width: 0,
    },

    // Large Header
    largeHeader: {
        alignItems: "center",
        paddingBottom: spacing.lg,
    },
    label: {
        ...typography.caption1,
        fontWeight: "600",
        letterSpacing: 3,
        color: colors.primary,
        textAlign: "center",
        marginBottom: spacing.xs,
    },
    title: {
        ...typography.title1,
        color: colors.text,
        textAlign: "center",
    },
    separator: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        marginVertical: spacing.md,
        width: 140,
    },
    separatorLine: {
        flex: 1,
        height: 1,
        backgroundColor: "rgba(233, 69, 96, 0.3)",
    },
    separatorDiamond: {
        width: 6,
        height: 6,
        backgroundColor: colors.primary,
        transform: [{ rotate: "45deg" }],
        marginHorizontal: spacing.md,
        opacity: 0.6,
    },
    statsBadge: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "rgba(233, 69, 96, 0.1)",
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: radius.full,
        borderWidth: 1,
        borderColor: "rgba(233, 69, 96, 0.2)",
        gap: spacing.sm,
    },
    statsBadgeText: {
        ...typography.caption1,
        color: colors.textSecondary,
        fontWeight: "500",
    },

    // Scroll Content
    scrollContent: {
        paddingTop: 60, // Match other pages
        paddingBottom: Platform.OS === "ios" ? 120 : 100,
    },
    categoriesContainer: {
        paddingHorizontal: spacing.lg,
    },

    // Category Section
    categorySection: {
        marginBottom: spacing.lg,
    },
    categoryHeader: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingVertical: spacing.sm,
        marginBottom: spacing.xs,
    },
    categoryHeaderLeft: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
    },
    categoryName: {
        ...typography.headline,
        color: colors.text,
        textTransform: "uppercase",
        letterSpacing: 1,
        fontSize: 13,
    },
    categoryBadge: {
        backgroundColor: colors.primary,
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 10,
        minWidth: 20,
        alignItems: "center",
    },
    categoryBadgeText: {
        ...typography.caption2,
        color: colors.text,
        fontWeight: "600",
    },
    packsList: {
        backgroundColor: "rgba(255, 255, 255, 0.03)",
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: colors.glass.border,
        overflow: "hidden",
    },

    // Pack Row
    packRow: {
        borderBottomWidth: 1,
        borderBottomColor: colors.glass.border,
    },
    packRowMain: {
        flexDirection: "row",
        alignItems: "center",
        padding: spacing.md,
        gap: spacing.md,
    },
    packIcon: {
        width: 44,
        height: 44,
        borderRadius: 12,
        backgroundColor: "rgba(255, 255, 255, 0.05)",
        justifyContent: "center",
        alignItems: "center",
        borderWidth: 1,
        borderColor: "rgba(255, 255, 255, 0.08)",
    },
    packIconEnabled: {
        backgroundColor: "rgba(233, 69, 96, 0.1)",
        borderColor: "rgba(233, 69, 96, 0.2)",
    },
    packContent: {
        flex: 1,
    },
    packTitleRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.xs,
    },
    packName: {
        ...typography.body,
        color: colors.text,
        fontWeight: "500",
        flexShrink: 1,
    },
    premiumBadge: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: radius.full,
        backgroundColor: "rgba(212, 175, 55, 0.12)",
        borderWidth: 1,
        borderColor: "rgba(212, 175, 55, 0.25)",
    },
    premiumBadgeLocked: {
        backgroundColor: "rgba(212, 175, 55, 0.18)",
        borderColor: "rgba(212, 175, 55, 0.35)",
    },
    premiumBadgeText: {
        ...typography.caption2,
        color: colors.premium.gold,
        fontWeight: "700",
        letterSpacing: 0.6,
    },
    packMeta: {
        ...typography.caption1,
        color: colors.textTertiary,
        marginTop: 2,
    },
    packMetaEnabled: {
        color: colors.primary,
    },
    packIntensityRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        marginTop: spacing.xs,
    },
    packIntensityFlames: {
        flexDirection: "row",
        gap: 2,
    },
    packIntensityText: {
        ...typography.caption2,
        color: colors.textSecondary,
        fontWeight: "600",
    },

    // Expanded Pack
    packExpanded: {
        paddingHorizontal: spacing.md,
        paddingBottom: spacing.md,
        paddingTop: 0,
    },
    packDescription: {
        ...typography.subhead,
        color: colors.textSecondary,
        lineHeight: 20,
        marginBottom: spacing.md,
    },
    packActions: {
        flexDirection: "row",
        gap: spacing.sm,
    },
    packInfoButton: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.xs,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
        borderRadius: radius.sm,
        backgroundColor: "rgba(255, 255, 255, 0.05)",
        borderWidth: 1,
        borderColor: colors.glass.border,
    },
    packInfoButtonText: {
        ...typography.subhead,
        color: colors.textSecondary,
    },
    packToggleButton: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: spacing.xs,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
        borderRadius: radius.sm,
        backgroundColor: "rgba(255, 255, 255, 0.08)",
        borderWidth: 1,
        borderColor: "rgba(255, 255, 255, 0.12)",
    },
    packToggleButtonEnabled: {
        backgroundColor: "rgba(233, 69, 96, 0.1)",
        borderColor: "rgba(233, 69, 96, 0.3)",
    },
    packToggleButtonLocked: {
        backgroundColor: "rgba(212, 175, 55, 0.1)",
        borderColor: "rgba(212, 175, 55, 0.3)",
    },
    packToggleButtonText: {
        ...typography.subhead,
        color: colors.text,
        fontWeight: "500",
    },
    packToggleButtonTextEnabled: {
        color: colors.primary,
    },
    packToggleButtonTextLocked: {
        color: colors.premium.gold,
    },
});
