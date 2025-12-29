import { View, Text, StyleSheet, FlatList, TouchableOpacity, Switch, RefreshControl, Platform } from "react-native";
import { usePacksStore, useAuthStore, useSubscriptionStore } from "../../src/store";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useMemo, useState, useCallback } from "react";
import Animated, { FadeInDown, FadeInRight, FadeIn, FadeOut, Layout } from "react-native-reanimated";
import { GradientBackground, GlassCard } from "../../src/components/ui";
import { Paywall } from "../../src/components/Paywall";
import { PackTeaser } from "../../src/components/PackTeaser";
import { colors, spacing, typography, radius } from "../../src/theme";
import type { QuestionPack, Category } from "../../src/types";

interface CategoryWithPacks extends Category {
    packs: QuestionPack[];
}

export default function PacksScreen() {
    const { packs, categories, enabledPackIds, togglePack, isLoading, fetchPacks } = usePacksStore();
    const { user, partner } = useAuthStore();
    const { subscription } = useSubscriptionStore();
    const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
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

    // Handle toggling a pack - show teaser if premium pack without access
    const handleTogglePack = useCallback((pack: QuestionPack) => {
        if (pack.is_premium && !hasPremiumAccess) {
            setTeaserPack(pack);
            setShowTeaser(true);
            return;
        }
        togglePack(pack.id);
    }, [hasPremiumAccess, togglePack]);

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

    // Group packs by category
    const categoriesWithPacks = useMemo((): CategoryWithPacks[] => {
        return categories
            .map(category => ({
                ...category,
                packs: packs.filter(p => p.category_id === category.id)
            }))
            .filter(cat => cat.packs.length > 0);
    }, [packs, categories]);

    const toggleCategory = useCallback((categoryId: string) => {
        setExpandedCategories(prev => {
            const next = new Set(prev);
            if (next.has(categoryId)) {
                next.delete(categoryId);
            } else {
                next.add(categoryId);
            }
            return next;
        });
    }, []);

    const renderPack = (item: QuestionPack, index: number) => {
        const isEnabled = enabledPackIds.includes(item.id);
        const isPremiumLocked = item.is_premium && !hasPremiumAccess;

        return (
            <Animated.View
                key={item.id}
                entering={FadeIn.delay(index * 50).duration(200)}
                exiting={FadeOut.duration(150)}
                layout={Layout.springify()}
            >
                <View style={styles.packItem}>
                    <TouchableOpacity
                        style={styles.packContent}
                        activeOpacity={0.7}
                        onPress={() => {
                            if (isPremiumLocked) {
                                setTeaserPack(item);
                                setShowTeaser(true);
                            } else {
                                router.push(`/pack/${item.id}`);
                            }
                        }}
                    >
                        <View style={[
                            styles.packIcon,
                            isEnabled && styles.packIconActive,
                            isPremiumLocked && styles.packIconLocked
                        ]}>
                            <Text style={styles.packEmoji}>{item.icon || "📦"}</Text>
                        </View>
                        <View style={styles.packInfo}>
                            <View style={styles.packHeader}>
                                <Text style={[
                                    styles.packName,
                                    isPremiumLocked && styles.packNameLocked
                                ]}>
                                    {item.name}
                                </Text>
                                {item.is_premium && (
                                    <View style={[
                                        styles.badge,
                                        isPremiumLocked && styles.badgeLocked
                                    ]}>
                                        <Ionicons
                                            name={isPremiumLocked ? "lock-closed" : "star"}
                                            size={10}
                                            color={colors.text}
                                        />
                                        <Text style={styles.badgeText}>PRO</Text>
                                    </View>
                                )}
                            </View>
                            <Text style={[
                                styles.packDescription,
                                isPremiumLocked && styles.packDescriptionLocked
                            ]} numberOfLines={1}>
                                {isPremiumLocked ? "Upgrade to unlock" : item.description}
                            </Text>
                        </View>
                    </TouchableOpacity>
                    <Switch
                        value={isEnabled}
                        onValueChange={() => handleTogglePack(item)}
                        disabled={isPremiumLocked}
                        trackColor={{
                            false: colors.glass.background,
                            true: colors.primary,
                        }}
                        thumbColor={colors.text}
                        ios_backgroundColor={colors.glass.background}
                        style={isPremiumLocked ? { opacity: 0.4 } : undefined}
                    />
                </View>
            </Animated.View>
        );
    };

    const renderCategory = ({ item: category, index }: { item: CategoryWithPacks; index: number }) => {
        const isExpanded = expandedCategories.has(category.id);
        const enabledInCategory = category.packs.filter(p => enabledPackIds.includes(p.id)).length;

        return (
            <Animated.View
                entering={FadeInDown.delay(index * 100).duration(300)}
                layout={Layout.springify()}
            >
                <GlassCard style={styles.categoryCard}>
                    <TouchableOpacity
                        style={styles.categoryHeader}
                        activeOpacity={0.7}
                        onPress={() => toggleCategory(category.id)}
                    >
                        <Text style={styles.categoryIcon}>{category.icon}</Text>
                        <View style={styles.categoryInfo}>
                            <Text style={styles.categoryName}>{category.name}</Text>
                            <Text style={styles.categoryMeta}>
                                {category.packs.length} packs · {enabledInCategory} enabled
                            </Text>
                        </View>
                        <Ionicons
                            name={isExpanded ? "chevron-up" : "chevron-down"}
                            size={24}
                            color={colors.textSecondary}
                        />
                    </TouchableOpacity>

                    {isExpanded && (
                        <Animated.View
                            entering={FadeIn.duration(200)}
                            exiting={FadeOut.duration(150)}
                            style={styles.packsContainer}
                        >
                            {category.packs.map((pack, idx) => renderPack(pack, idx))}
                        </Animated.View>
                    )}
                </GlassCard>
            </Animated.View>
        );
    };

    return (
        <GradientBackground>
            <View style={styles.container}>
                <Animated.View
                    entering={FadeInDown.duration(400)}
                    style={styles.header}
                >
                    <Text style={styles.title}>Question Packs</Text>
                    <Text style={styles.subtitle}>
                        {totalQuestions} {totalQuestions === 1 ? 'question' : 'questions'} from {enabledPackCount} {enabledPackCount === 1 ? 'pack' : 'packs'} enabled
                    </Text>
                </Animated.View>

                <FlatList
                    data={categoriesWithPacks}
                    renderItem={renderCategory}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.list}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl
                            refreshing={isLoading}
                            onRefresh={fetchPacks}
                            tintColor={colors.primary}
                            colors={[colors.primary]}
                        />
                    }
                    ListEmptyComponent={
                        <Animated.View
                            entering={FadeInDown.delay(200).duration(400)}
                            style={styles.emptyContainer}
                        >
                            <View style={styles.emptyIconContainer}>
                                <Ionicons name="layers-outline" size={48} color={colors.textTertiary} />
                            </View>
                            <Text style={styles.emptyTitle}>No packs available</Text>
                            <Text style={styles.emptyText}>
                                Check back later for new question packs!
                            </Text>
                        </Animated.View>
                    }
                />

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
        paddingBottom: spacing.md,
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
    list: {
        padding: spacing.lg,
        paddingBottom: Platform.OS === 'ios' ? 120 : 100,
    },
    categoryCard: {
        marginBottom: spacing.md,
    },
    categoryHeader: {
        flexDirection: "row",
        alignItems: "center",
    },
    categoryIcon: {
        fontSize: 32,
        marginRight: spacing.md,
    },
    categoryInfo: {
        flex: 1,
    },
    categoryName: {
        ...typography.title3,
        color: colors.text,
    },
    categoryMeta: {
        ...typography.caption1,
        color: colors.textSecondary,
        marginTop: 2,
    },
    packsContainer: {
        marginTop: spacing.md,
        paddingTop: spacing.md,
        borderTopWidth: 1,
        borderTopColor: colors.glass.border,
    },
    packItem: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: spacing.sm,
    },
    packContent: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
    },
    packIcon: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: colors.glass.background,
        justifyContent: "center",
        alignItems: "center",
        marginRight: spacing.md,
    },
    packIconActive: {
        backgroundColor: colors.primaryLight,
    },
    packIconLocked: {
        opacity: 0.5,
    },
    packEmoji: {
        fontSize: 22,
    },
    packInfo: {
        flex: 1,
        marginRight: spacing.sm,
    },
    packHeader: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 2,
    },
    packName: {
        ...typography.headline,
        color: colors.text,
        marginRight: spacing.sm,
    },
    packNameLocked: {
        color: colors.textSecondary,
    },
    packDescription: {
        ...typography.caption1,
        color: colors.textSecondary,
    },
    packDescriptionLocked: {
        color: colors.textTertiary,
        fontStyle: "italic",
    },
    badge: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: colors.primary,
        paddingHorizontal: spacing.sm,
        paddingVertical: 2,
        borderRadius: radius.xs,
        gap: 2,
    },
    badgeLocked: {
        backgroundColor: colors.glass.backgroundLight,
    },
    badgeText: {
        ...typography.caption2,
        color: colors.text,
        fontWeight: "700",
    },
    emptyContainer: {
        alignItems: "center",
        paddingVertical: spacing.xxl,
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
