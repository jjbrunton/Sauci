import { useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform } from "react-native";
import Animated, { FadeInDown, FadeInRight } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { useAuthStore, useMatchStore, usePacksStore } from "../../src/store";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { GradientBackground, GlassCard, GlassButton } from "../../src/components/ui";
import { colors, gradients, spacing, radius, typography, shadows } from "../../src/theme";

export default function HomeScreen() {
    const { user, partner } = useAuthStore();
    const { matches, newMatchesCount, fetchMatches } = useMatchStore();
    const { packs, fetchPacks } = usePacksStore();

    useEffect(() => {
        fetchMatches();
        fetchPacks();
    }, []);

    const recentMatches = matches.slice(0, 3);

    return (
        <GradientBackground>
            <ScrollView
                style={styles.container}
                contentContainerStyle={styles.contentContainer}
                showsVerticalScrollIndicator={false}
            >
                {/* Header */}
                <Animated.View
                    entering={FadeInDown.delay(100).duration(500)}
                    style={styles.header}
                >
                    <View>
                        <Text style={styles.greeting}>
                            Hey, {user?.name || "there"}
                        </Text>
                        {partner && (
                            <Text style={styles.partnerText}>
                                Paired with {partner.name || partner.email || 'your partner'}
                            </Text>
                        )}
                    </View>
                    <TouchableOpacity
                        style={styles.profileButton}
                        onPress={() => router.push("/(app)/profile")}
                        activeOpacity={0.7}
                    >
                        <Text style={styles.profileButtonText}>
                            {user?.name?.[0]?.toUpperCase() || "U"}
                        </Text>
                    </TouchableOpacity>
                </Animated.View>

                {/* Quick Stats */}
                <Animated.View
                    entering={FadeInDown.delay(200).duration(500)}
                    style={styles.statsContainer}
                >
                    <GlassCard style={styles.statCard}>
                        <View style={styles.statIconContainer}>
                            <Ionicons name="heart" size={20} color={colors.primary} />
                        </View>
                        <Text style={styles.statNumber}>{matches.length}</Text>
                        <Text style={styles.statLabel}>Matches</Text>
                    </GlassCard>
                    <GlassCard style={styles.statCard}>
                        <View style={styles.statIconContainer}>
                            <Ionicons name="layers" size={20} color={colors.primary} />
                        </View>
                        <Text style={styles.statNumber}>{packs.length}</Text>
                        <Text style={styles.statLabel}>Packs</Text>
                    </GlassCard>
                    <GlassCard style={styles.statCard}>
                        <View style={[styles.statIconContainer, newMatchesCount > 0 && styles.statIconHighlight]}>
                            <Ionicons name="sparkles" size={20} color={newMatchesCount > 0 ? colors.text : colors.primary} />
                        </View>
                        <Text style={styles.statNumber}>{newMatchesCount}</Text>
                        <Text style={styles.statLabel}>New</Text>
                    </GlassCard>
                </Animated.View>

                {/* Start Playing CTA */}
                <Animated.View entering={FadeInDown.delay(300).duration(500)}>
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
                                <Ionicons name="arrow-forward" size={24} color={colors.text} />
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
                            <TouchableOpacity onPress={() => router.push("/(app)/matches")}>
                                <Text style={styles.seeAll}>See all</Text>
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
                                    <GlassCard style={styles.matchItem}>
                                        <View style={styles.matchIcon}>
                                            <Ionicons name="heart" size={18} color={colors.primary} />
                                        </View>
                                        <Text style={styles.matchText} numberOfLines={1}>
                                            {(match as any).question?.text || "A new match!"}
                                        </Text>
                                        {match.is_new && <View style={styles.newBadge} />}
                                    </GlassCard>
                                </TouchableOpacity>
                            </Animated.View>
                        ))}
                    </Animated.View>
                )}

                {/* Bottom spacing for tab bar */}
                <View style={styles.bottomSpacer} />
            </ScrollView>
        </GradientBackground>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    contentContainer: {
        paddingBottom: Platform.OS === 'ios' ? 100 : 80,
    },
    header: {
        paddingTop: 60,
        paddingHorizontal: spacing.lg,
        paddingBottom: spacing.lg,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    greeting: {
        ...typography.title1,
        color: colors.text,
    },
    partnerText: {
        ...typography.subhead,
        color: colors.textSecondary,
        marginTop: spacing.xs,
    },
    profileButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
        ...shadows.md,
    },
    profileButtonText: {
        ...typography.headline,
        color: colors.text,
    },
    statsContainer: {
        flexDirection: "row",
        paddingHorizontal: spacing.lg,
        gap: spacing.sm,
    },
    statCard: {
        flex: 1,
        alignItems: "center",
        paddingVertical: spacing.md,
    },
    statIconContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: colors.primaryLight,
        justifyContent: "center",
        alignItems: "center",
        marginBottom: spacing.sm,
    },
    statIconHighlight: {
        backgroundColor: colors.primary,
    },
    statNumber: {
        ...typography.title2,
        color: colors.text,
    },
    statLabel: {
        ...typography.caption1,
        color: colors.textSecondary,
        marginTop: spacing.xs,
    },
    ctaCard: {
        margin: spacing.lg,
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
    },
    ctaSubtitle: {
        ...typography.subhead,
        color: "rgba(255,255,255,0.8)",
        marginTop: spacing.xs,
    },
    ctaIconContainer: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: "rgba(255,255,255,0.2)",
        justifyContent: "center",
        alignItems: "center",
        marginLeft: spacing.md,
    },
    section: {
        paddingHorizontal: spacing.lg,
        marginTop: spacing.sm,
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
    seeAll: {
        ...typography.subhead,
        color: colors.primary,
    },
    matchItem: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: spacing.sm,
    },
    matchIcon: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: colors.primaryLight,
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
    bottomSpacer: {
        height: spacing.lg,
    },
});
