import { View, Text, StyleSheet, ScrollView, RefreshControl, Platform, Alert } from "react-native";
import { usePacksStore, useAuthStore, useSubscriptionStore } from "../../src/store";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState, useCallback } from "react";
import Animated, { FadeInDown, FadeIn, Layout } from "react-native-reanimated";
import { GradientBackground } from "../../src/components/ui";
import { Paywall } from "../../src/components/Paywall";
import { PackTeaser } from "../../src/components/PackTeaser";
import { CategoryTabs, FilterType } from "../../src/components/CategoryTabs";
import { BoutiquePackCard } from "../../src/components/BoutiquePackCard";
import { colors, spacing, typography } from "../../src/theme";
import type { QuestionPack } from "../../src/types";

export default function PacksScreen() {
    const { category } = useLocalSearchParams<{ category?: string }>();
    const { packs, categories, enabledPackIds, togglePack, isLoading, fetchPacks } = usePacksStore();
    const { user, partner } = useAuthStore();
    const { subscription } = useSubscriptionStore();
    const [selectedFilter, setSelectedFilter] = useState<FilterType>('all');
    const [showPaywall, setShowPaywall] = useState(false);
    const [showTeaser, setShowTeaser] = useState(false);
    const [teaserPack, setTeaserPack] = useState<QuestionPack | null>(null);

    // Check if user or partner has premium access
    const hasPremiumAccess = useMemo(() => {
        return user?.is_premium || partner?.is_premium || subscription.isProUser;
    }, [user?.is_premium, partner?.is_premium, subscription.isProUser]);

    useEffect(() => {
        fetchPacks();
    }, []);

    // Apply category filter from URL param
    useEffect(() => {
        if (category) {
            setSelectedFilter(category);
        }
    }, [category]);

    // Filter packs by selected filter (all, enabled, or category id)
    const filteredPacks = useMemo(() => {
        if (selectedFilter === 'all') return packs;
        if (selectedFilter === 'enabled') return packs.filter(p => enabledPackIds.includes(p.id));
        // Otherwise it's a category id
        return packs.filter(p => p.category_id === selectedFilter);
    }, [packs, selectedFilter, enabledPackIds]);

    // Split packs into two columns for masonry layout
    const { leftColumn, rightColumn } = useMemo(() => {
        const left: { pack: QuestionPack; index: number }[] = [];
        const right: { pack: QuestionPack; index: number }[] = [];
        let leftHeight = 0;
        let rightHeight = 0;

        filteredPacks.forEach((pack, index) => {
            // Estimate card height based on description length
            const baseHeight = 180;
            const descLength = pack.description?.length || 0;
            const extraHeight = Math.min(Math.ceil(descLength / 40) * 10, 40);
            const cardHeight = baseHeight + extraHeight;

            if (leftHeight <= rightHeight) {
                left.push({ pack, index });
                leftHeight += cardHeight;
            } else {
                right.push({ pack, index });
                rightHeight += cardHeight;
            }
        });

        return { leftColumn: left, rightColumn: right };
    }, [filteredPacks]);

    // Handle toggling a pack - show teaser if premium pack without access
    const handleTogglePack = useCallback(async (pack: QuestionPack) => {
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

    // Handle pack press - navigate or show teaser
    const handlePackPress = useCallback((pack: QuestionPack) => {
        const isPremiumLocked = pack.is_premium && !hasPremiumAccess;
        if (isPremiumLocked) {
            setTeaserPack(pack);
            setShowTeaser(true);
        } else {
            router.push(`/pack/${pack.id}`);
        }
    }, [hasPremiumAccess]);

    // Handle teaser unlock button - show paywall
    const handleTeaserUnlock = useCallback(() => {
        setShowTeaser(false);
        setShowPaywall(true);
    }, []);

    // Handle teaser close
    const handleTeaserClose = useCallback(() => {
        setShowTeaser(false);
        setTeaserPack(null);
    }, []);

    const enabledPacks = packs.filter(p => enabledPackIds.includes(p.id));
    const enabledPackCount = enabledPacks.length;
    const totalQuestions = enabledPacks.reduce((sum, p) => sum + (p.questions?.[0]?.count || 0), 0);

    return (
        <GradientBackground>
            <View style={styles.container}>
                {/* Header */}
                <Animated.View
                    entering={FadeInDown.duration(400)}
                    style={styles.header}
                >
                    <Text style={styles.title}>Question Packs</Text>
                    <Text style={styles.subtitle}>
                        {totalQuestions} {totalQuestions === 1 ? 'question' : 'questions'} from {enabledPackCount} {enabledPackCount === 1 ? 'pack' : 'packs'} enabled
                    </Text>
                </Animated.View>

                {/* Category Tabs */}
                <Animated.View entering={FadeInDown.delay(100).duration(400)}>
                    <CategoryTabs
                        categories={categories}
                        selectedFilter={selectedFilter}
                        onSelectFilter={setSelectedFilter}
                        enabledCount={enabledPackIds.length}
                    />
                </Animated.View>

                {/* Masonry Grid */}
                <ScrollView
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl
                            refreshing={isLoading}
                            onRefresh={fetchPacks}
                            tintColor={colors.primary}
                            colors={[colors.primary]}
                        />
                    }
                    contentContainerStyle={styles.scrollContent}
                >
                    {filteredPacks.length === 0 ? (
                        <Animated.View
                            entering={FadeInDown.delay(200).duration(400)}
                            style={styles.emptyContainer}
                        >
                            <View style={styles.emptyIconContainer}>
                                <Ionicons name="layers-outline" size={48} color={colors.textTertiary} />
                            </View>
                            <Text style={styles.emptyTitle}>No packs available</Text>
                            <Text style={styles.emptyText}>
                                {selectedFilter === 'enabled'
                                    ? "No packs enabled yet. Enable some packs to see them here!"
                                    : selectedFilter !== 'all'
                                    ? "No packs in this category. Try selecting a different one."
                                    : "Check back later for new question packs!"}
                            </Text>
                        </Animated.View>
                    ) : (
                        <View style={styles.masonryContainer}>
                            {/* Left Column */}
                            <View style={styles.column}>
                                {leftColumn.map(({ pack, index }, columnIndex) => (
                                    <Animated.View
                                        key={pack.id}
                                        entering={FadeInDown.delay(columnIndex * 80).duration(400)}
                                        layout={Layout.springify()}
                                    >
                                        <BoutiquePackCard
                                            pack={pack}
                                            index={index}
                                            isEnabled={enabledPackIds.includes(pack.id)}
                                            isPremiumLocked={pack.is_premium && !hasPremiumAccess}
                                            onPress={() => handlePackPress(pack)}
                                            onToggle={() => handleTogglePack(pack)}
                                        />
                                    </Animated.View>
                                ))}
                            </View>

                            {/* Right Column */}
                            <View style={styles.column}>
                                {rightColumn.map(({ pack, index }, columnIndex) => (
                                    <Animated.View
                                        key={pack.id}
                                        entering={FadeInDown.delay(columnIndex * 80 + 40).duration(400)}
                                        layout={Layout.springify()}
                                    >
                                        <BoutiquePackCard
                                            pack={pack}
                                            index={index}
                                            isEnabled={enabledPackIds.includes(pack.id)}
                                            isPremiumLocked={pack.is_premium && !hasPremiumAccess}
                                            onPress={() => handlePackPress(pack)}
                                            onToggle={() => handleTogglePack(pack)}
                                        />
                                    </Animated.View>
                                ))}
                            </View>
                        </View>
                    )}
                </ScrollView>

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
                    onSuccess={() => {
                        // Refresh packs after successful purchase
                        fetchPacks();
                    }}
                />
            </View>
        </GradientBackground>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        paddingTop: 60,
        paddingHorizontal: spacing.lg,
        paddingBottom: spacing.sm,
    },
    title: {
        ...typography.title1,
        color: colors.text,
    },
    subtitle: {
        ...typography.subhead,
        color: colors.textSecondary,
        marginTop: spacing.xs,
    },
    scrollContent: {
        paddingBottom: Platform.OS === 'ios' ? 120 : 100,
    },
    masonryContainer: {
        flexDirection: 'row',
        paddingHorizontal: spacing.md,
        gap: spacing.md,
    },
    column: {
        flex: 1,
        gap: spacing.md,
    },
    emptyContainer: {
        alignItems: "center",
        paddingVertical: spacing.xxl,
        paddingHorizontal: spacing.lg,
    },
    emptyIconContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: colors.glass.background,
        justifyContent: "center",
        alignItems: "center",
        marginBottom: spacing.md,
    },
    emptyTitle: {
        ...typography.title3,
        color: colors.text,
        marginBottom: spacing.xs,
    },
    emptyText: {
        ...typography.body,
        color: colors.textSecondary,
        textAlign: "center",
    },
});
