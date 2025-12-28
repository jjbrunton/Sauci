import { useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform, useWindowDimensions } from "react-native";
import Animated, { FadeInDown, FadeInRight } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { useAuthStore, useMatchStore, usePacksStore } from "../../src/store";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { GradientBackground, GlassCard } from "../../src/components/ui";
import { colors, gradients, spacing, radius, typography, shadows } from "../../src/theme";

const MAX_CONTENT_WIDTH = 500;

export default function HomeScreen() {
    const { user, partner } = useAuthStore();
    const { matches, newMatchesCount, fetchMatches } = useMatchStore();
    const { packs, fetchPacks } = usePacksStore();
    const { width } = useWindowDimensions();

    useEffect(() => {
        fetchMatches();
        fetchPacks();
    }, []);

    const recentMatches = matches.slice(0, 3);
    const isWideScreen = width > MAX_CONTENT_WIDTH;
    const enabledPacksCount = packs.length;

    return (
        <GradientBackground>
            <ScrollView
                style={styles.container}
                contentContainerStyle={[
                    styles.contentContainer,
                    isWideScreen && styles.contentContainerWide,
                ]}
                showsVerticalScrollIndicator={false}
            >
                <View style={[styles.innerContainer, isWideScreen && styles.innerContainerWide]}>
                    {/* Header */}
                    <Animated.View
                        entering={FadeInDown.delay(100).duration(500)}
                        style={styles.header}
                    >
                        <View style={styles.headerLeft}>
                            <Text style={styles.greeting}>
                                Hey, {user?.name || "there"}
                            </Text>
                            {partner ? (
                                <View style={styles.partnerBadge}>
                                    <Ionicons name="heart" size={12} color={colors.primary} />
                                    <Text style={styles.partnerText}>
                                        {partner.name || partner.email?.split('@')[0] || 'Partner'}
                                    </Text>
                                </View>
                            ) : (
                                <TouchableOpacity
                                    style={styles.pairBadge}
                                    onPress={() => router.push("/(app)/pairing")}
                                >
                                    <Ionicons name="add-circle-outline" size={12} color={colors.textTertiary} />
                                    <Text style={styles.pairText}>Pair with partner</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                        <TouchableOpacity
                            onPress={() => router.push("/(app)/profile")}
                            activeOpacity={0.8}
                        >
                            <LinearGradient
                                colors={gradients.primary as [string, string]}
                                style={styles.avatarGradient}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                            >
                                <View style={styles.avatarInner}>
                                    <Text style={styles.avatarText}>
                                        {user?.name?.[0]?.toUpperCase() || "U"}
                                    </Text>
                                </View>
                            </LinearGradient>
                        </TouchableOpacity>
                    </Animated.View>

                    {/* Stats Row */}
                    <Animated.View
                        entering={FadeInDown.delay(200).duration(500)}
                        style={styles.statsContainer}
                    >
                        <TouchableOpacity
                            style={styles.statCardWrapper}
                            onPress={() => router.push("/(app)/matches")}
                            activeOpacity={0.7}
                        >
                            <GlassCard>
                                <View style={styles.statContent}>
                                    <LinearGradient
                                        colors={matches.length > 0 ? gradients.primary as [string, string] : [colors.glass.background, colors.glass.background]}
                                        style={styles.statIcon}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 1 }}
                                    >
                                        <Ionicons
                                            name="heart"
                                            size={18}
                                            color={matches.length > 0 ? colors.text : colors.primary}
                                        />
                                    </LinearGradient>
                                    <Text style={styles.statNumber}>{matches.length}</Text>
                                    <Text style={styles.statLabel}>Matches</Text>
                                </View>
                            </GlassCard>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.statCardWrapper}
                            onPress={() => router.push("/(app)/packs")}
                            activeOpacity={0.7}
                        >
                            <GlassCard>
                                <View style={styles.statContent}>
                                    <LinearGradient
                                        colors={enabledPacksCount > 0 ? gradients.primary as [string, string] : [colors.glass.background, colors.glass.background]}
                                        style={styles.statIcon}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 1 }}
                                    >
                                        <Ionicons
                                            name="layers"
                                            size={18}
                                            color={enabledPacksCount > 0 ? colors.text : colors.primary}
                                        />
                                    </LinearGradient>
                                    <Text style={styles.statNumber}>{enabledPacksCount}</Text>
                                    <Text style={styles.statLabel}>Packs</Text>
                                </View>
                            </GlassCard>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.statCardWrapper}
                            onPress={() => router.push("/(app)/matches")}
                            activeOpacity={0.7}
                        >
                            <GlassCard>
                                <View style={styles.statContent}>
                                    <LinearGradient
                                        colors={newMatchesCount > 0 ? gradients.primary as [string, string] : [colors.glass.background, colors.glass.background]}
                                        style={styles.statIcon}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 1 }}
                                    >
                                        <Ionicons
                                            name="sparkles"
                                            size={18}
                                            color={newMatchesCount > 0 ? colors.text : colors.primary}
                                        />
                                    </LinearGradient>
                                    <Text style={styles.statNumber}>{newMatchesCount}</Text>
                                    <Text style={styles.statLabel}>New</Text>
                                </View>
                            </GlassCard>
                        </TouchableOpacity>
                    </Animated.View>

                    {/* Play CTA */}
                    <Animated.View
                        entering={FadeInDown.delay(300).duration(500)}
                        style={styles.ctaSection}
                    >
                        <TouchableOpacity
                            onPress={() => router.push("/(app)/swipe")}
                            activeOpacity={0.9}
                        >
                            <LinearGradient
                                colors={gradients.primary as [string, string]}
                                style={styles.ctaCard}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                            >
                                <View style={styles.ctaContent}>
                                    <Text style={styles.ctaTitle}>Ready to explore?</Text>
                                    <Text style={styles.ctaSubtitle}>
                                        Swipe through questions and discover what you both enjoy
                                    </Text>
                                </View>
                                <View style={styles.ctaIconContainer}>
                                    <Ionicons name="play" size={24} color={colors.text} />
                                </View>
                            </LinearGradient>
                        </TouchableOpacity>
                    </Animated.View>

                    {/* Recent Matches */}
                    {recentMatches.length > 0 && (
                        <Animated.View
                            entering={FadeInDown.delay(400).duration(500)}
                            style={styles.section}
                        >
                            <View style={styles.sectionHeader}>
                                <Text style={styles.sectionTitle}>Recent Matches</Text>
                                <TouchableOpacity
                                    onPress={() => router.push("/(app)/matches")}
                                    style={styles.seeAllButton}
                                >
                                    <Text style={styles.seeAllText}>See all</Text>
                                    <Ionicons name="chevron-forward" size={14} color={colors.primary} />
                                </TouchableOpacity>
                            </View>
                            {recentMatches.map((match, index) => (
                                <Animated.View
                                    key={match.id}
                                    entering={FadeInRight.delay(450 + index * 100).duration(400)}
                                >
                                    <TouchableOpacity
                                        onPress={() => router.push(`/chat/${match.id}`)}
                                        activeOpacity={0.7}
                                    >
                                        <GlassCard style={styles.matchCard}>
                                            <View style={styles.matchRow}>
                                                <LinearGradient
                                                    colors={gradients.primary as [string, string]}
                                                    style={styles.matchIcon}
                                                    start={{ x: 0, y: 0 }}
                                                    end={{ x: 1, y: 1 }}
                                                >
                                                    <Ionicons name="heart" size={16} color={colors.text} />
                                                </LinearGradient>
                                                <Text style={styles.matchText} numberOfLines={1}>
                                                    {(match as any).question?.text || "A new match!"}
                                                </Text>
                                                {match.is_new && <View style={styles.newBadge} />}
                                            </View>
                                        </GlassCard>
                                    </TouchableOpacity>
                                </Animated.View>
                            ))}
                        </Animated.View>
                    )}

                    {/* Tips when no matches */}
                    {recentMatches.length === 0 && (
                        <Animated.View
                            entering={FadeInDown.delay(400).duration(500)}
                            style={styles.section}
                        >
                            <Text style={styles.tipsTitle}>Getting Started</Text>
                            <GlassCard>
                                <View style={styles.tipRow}>
                                    <View style={styles.tipIcon}>
                                        <Ionicons name="layers-outline" size={18} color={colors.primary} />
                                    </View>
                                    <View style={styles.tipContent}>
                                        <Text style={styles.tipText}>Enable question packs</Text>
                                        <Text style={styles.tipSubtext}>Choose topics you want to explore</Text>
                                    </View>
                                </View>
                            </GlassCard>
                            <GlassCard style={styles.tipCard}>
                                <View style={styles.tipRow}>
                                    <View style={styles.tipIcon}>
                                        <Ionicons name="swap-horizontal-outline" size={18} color={colors.primary} />
                                    </View>
                                    <View style={styles.tipContent}>
                                        <Text style={styles.tipText}>Swipe on questions</Text>
                                        <Text style={styles.tipSubtext}>Answer yes, no, or maybe</Text>
                                    </View>
                                </View>
                            </GlassCard>
                            <GlassCard style={styles.tipCard}>
                                <View style={styles.tipRow}>
                                    <View style={styles.tipIcon}>
                                        <Ionicons name="heart-outline" size={18} color={colors.primary} />
                                    </View>
                                    <View style={styles.tipContent}>
                                        <Text style={styles.tipText}>Discover matches</Text>
                                        <Text style={styles.tipSubtext}>See where you both agree</Text>
                                    </View>
                                </View>
                            </GlassCard>
                        </Animated.View>
                    )}

                    <View style={styles.bottomSpacer} />
                </View>
            </ScrollView>
        </GradientBackground>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    contentContainer: {
        flexGrow: 1,
        paddingBottom: Platform.OS === 'ios' ? 100 : 80,
    },
    contentContainerWide: {
        alignItems: 'center',
    },
    innerContainer: {
        flex: 1,
        width: '100%',
    },
    innerContainerWide: {
        maxWidth: MAX_CONTENT_WIDTH,
    },
    header: {
        paddingTop: 60,
        paddingHorizontal: spacing.lg,
        paddingBottom: spacing.lg,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    headerLeft: {
        flex: 1,
    },
    greeting: {
        ...typography.title1,
        color: colors.text,
    },
    partnerBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.primaryLight,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
        borderRadius: radius.full,
        alignSelf: 'flex-start',
        marginTop: spacing.sm,
        gap: spacing.xs,
    },
    partnerText: {
        ...typography.caption1,
        color: colors.text,
        fontWeight: '500',
    },
    pairBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.glass.background,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
        borderRadius: radius.full,
        alignSelf: 'flex-start',
        marginTop: spacing.sm,
        gap: spacing.xs,
    },
    pairText: {
        ...typography.caption1,
        color: colors.textTertiary,
    },
    avatarGradient: {
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
        ...shadows.md,
    },
    avatarInner: {
        width: 42,
        height: 42,
        borderRadius: 21,
        backgroundColor: colors.background,
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarText: {
        ...typography.headline,
        color: colors.text,
    },
    statsContainer: {
        flexDirection: "row",
        paddingHorizontal: spacing.lg,
        gap: spacing.sm,
    },
    statCardWrapper: {
        flex: 1,
    },
    statContent: {
        alignItems: "center",
        paddingVertical: spacing.sm,
    },
    statIcon: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: "center",
        alignItems: "center",
        marginBottom: spacing.sm,
    },
    statNumber: {
        ...typography.title2,
        color: colors.text,
    },
    statLabel: {
        ...typography.caption2,
        color: colors.textSecondary,
        marginTop: 2,
    },
    ctaSection: {
        paddingHorizontal: spacing.lg,
        marginTop: spacing.lg,
    },
    ctaCard: {
        borderRadius: radius.xl,
        padding: spacing.lg,
        flexDirection: "row",
        alignItems: "center",
        ...shadows.lg,
    },
    ctaContent: {
        flex: 1,
    },
    ctaTitle: {
        ...typography.title3,
        color: colors.text,
        marginBottom: spacing.xs,
    },
    ctaSubtitle: {
        ...typography.subhead,
        color: "rgba(255,255,255,0.8)",
        lineHeight: 20,
    },
    ctaIconContainer: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: "rgba(255,255,255,0.2)",
        justifyContent: "center",
        alignItems: "center",
        marginLeft: spacing.md,
    },
    section: {
        paddingHorizontal: spacing.lg,
        marginTop: spacing.xl,
    },
    sectionHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: spacing.md,
    },
    sectionTitle: {
        ...typography.headline,
        color: colors.text,
    },
    seeAllButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
    },
    seeAllText: {
        ...typography.subhead,
        color: colors.primary,
    },
    matchCard: {
        marginBottom: spacing.sm,
    },
    matchRow: {
        flexDirection: "row",
        alignItems: "center",
    },
    matchIcon: {
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: "center",
        alignItems: "center",
        marginRight: spacing.md,
    },
    matchText: {
        flex: 1,
        ...typography.body,
        color: colors.text,
    },
    newBadge: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: colors.primary,
    },
    tipsTitle: {
        ...typography.caption1,
        color: colors.textTertiary,
        textTransform: 'uppercase',
        letterSpacing: 1.5,
        marginBottom: spacing.sm,
        marginLeft: spacing.xs,
    },
    tipCard: {
        marginTop: spacing.sm,
    },
    tipRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    tipIcon: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: colors.primaryLight,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: spacing.md,
    },
    tipContent: {
        flex: 1,
    },
    tipText: {
        ...typography.body,
        color: colors.text,
        fontWeight: '500',
    },
    tipSubtext: {
        ...typography.caption1,
        color: colors.textSecondary,
        marginTop: 2,
    },
    bottomSpacer: {
        height: spacing.lg,
    },
});
