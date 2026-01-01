import { useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform, useWindowDimensions } from "react-native";
import Animated, {
    FadeInDown,
    FadeInRight,
    FadeIn,
    useSharedValue,
    useAnimatedStyle,
    withRepeat,
    withTiming,
    Easing,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { useAuthStore, useMatchStore, usePacksStore } from "../../src/store";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { GradientBackground, GlassCard } from "../../src/components/ui";
import { colors, gradients, spacing, radius, typography, shadows } from "../../src/theme";

const MAX_CONTENT_WIDTH = 500;
const ACCENT_COLOR = colors.primary;

export default function HomeScreen() {
    const { user, partner, couple } = useAuthStore();
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

    // Subtle pulsating animation for the CTA icon
    const pulseScale = useSharedValue(1);
    const glowOpacity = useSharedValue(0.3);

    useEffect(() => {
        const startPulse = () => {
            pulseScale.value = 1;
            pulseScale.value = withRepeat(
                withTiming(1.1, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
                -1,
                true
            );
            glowOpacity.value = withRepeat(
                withTiming(0.6, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
                -1,
                true
            );
        };
        const timeout = setTimeout(startPulse, 100);
        return () => clearTimeout(timeout);
    }, []);

    const pulseAnimatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: pulseScale.value }],
    }));

    const glowAnimatedStyle = useAnimatedStyle(() => ({
        opacity: glowOpacity.value,
    }));

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
                    {/* Premium Header */}
                    <Animated.View
                        entering={FadeInDown.delay(100).duration(600).springify()}
                        style={styles.header}
                    >
                        {/* Greeting section */}
                        <Text style={styles.label}>WELCOME BACK</Text>
                        <Text style={styles.greeting}>
                            {user?.name || "Beautiful"}
                        </Text>

                        {/* Decorative separator */}
                        <View style={styles.separator}>
                            <View style={styles.separatorLine} />
                            <View style={styles.separatorDiamond} />
                            <View style={styles.separatorLine} />
                        </View>

                        {/* Partner badge */}
                        {partner ? (
                            <Animated.View
                                entering={FadeIn.delay(300).duration(400)}
                                style={styles.partnerBadge}
                            >
                                <Ionicons name="heart" size={12} color={ACCENT_COLOR} />
                                <Text style={styles.partnerText}>
                                    Connected with {partner.name || partner.email?.split('@')[0] || 'Partner'}
                                </Text>
                            </Animated.View>
                        ) : couple ? (
                            <TouchableOpacity
                                style={styles.waitingBadge}
                                onPress={() => router.push("/(app)/pairing")}
                            >
                                <Ionicons name="hourglass-outline" size={12} color={ACCENT_COLOR} />
                                <Text style={styles.waitingText}>Waiting for partner</Text>
                            </TouchableOpacity>
                        ) : (
                            <TouchableOpacity
                                style={styles.pairBadge}
                                onPress={() => router.push("/(app)/pairing")}
                            >
                                <Ionicons name="add-circle-outline" size={12} color={colors.textTertiary} />
                                <Text style={styles.pairText}>Connect with your partner</Text>
                            </TouchableOpacity>
                        )}

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
                            <View style={[styles.statCard, matches.length > 0 && styles.statCardActive]}>
                                <View style={[styles.statIcon, matches.length > 0 && styles.statIconActive]}>
                                    <Ionicons
                                        name="heart"
                                        size={18}
                                        color={matches.length > 0 ? colors.text : ACCENT_COLOR}
                                    />
                                </View>
                                <Text style={styles.statNumber}>{matches.length}</Text>
                                <Text style={styles.statLabel}>Matches</Text>
                            </View>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.statCardWrapper}
                            onPress={() => router.push("/(app)/packs")}
                            activeOpacity={0.7}
                        >
                            <View style={[styles.statCard, enabledPacksCount > 0 && styles.statCardActive]}>
                                <View style={[styles.statIcon, enabledPacksCount > 0 && styles.statIconActive]}>
                                    <Ionicons
                                        name="layers"
                                        size={18}
                                        color={enabledPacksCount > 0 ? colors.text : ACCENT_COLOR}
                                    />
                                </View>
                                <Text style={styles.statNumber}>{enabledPacksCount}</Text>
                                <Text style={styles.statLabel}>Packs</Text>
                            </View>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.statCardWrapper}
                            onPress={() => router.push("/(app)/matches")}
                            activeOpacity={0.7}
                        >
                            <View style={[styles.statCard, newMatchesCount > 0 && styles.statCardActive]}>
                                <View style={[styles.statIcon, newMatchesCount > 0 && styles.statIconActive]}>
                                    <Ionicons
                                        name="sparkles"
                                        size={18}
                                        color={newMatchesCount > 0 ? colors.text : ACCENT_COLOR}
                                    />
                                </View>
                                <Text style={styles.statNumber}>{newMatchesCount}</Text>
                                <Text style={styles.statLabel}>New</Text>
                            </View>
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
                            <View style={styles.ctaCard}>
                                {/* Glow effect */}
                                <Animated.View style={[styles.ctaGlow, glowAnimatedStyle]} />

                                <LinearGradient
                                    colors={gradients.primary as [string, string]}
                                    style={styles.ctaGradient}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                >
                                    <View style={styles.ctaContent}>
                                        <Text style={styles.ctaLabel}>EXPLORE</Text>
                                        <Text style={styles.ctaTitle}>Ready to explore?</Text>
                                        <Text style={styles.ctaSubtitle}>
                                            Discover new experiences
                                        </Text>
                                    </View>
                                    <Animated.View style={[styles.ctaIconContainer, pulseAnimatedStyle]}>
                                        <Ionicons name="flame" size={28} color={colors.text} />
                                    </Animated.View>
                                </LinearGradient>
                            </View>
                        </TouchableOpacity>
                    </Animated.View>

                    {/* Recent Matches */}
                    {recentMatches.length > 0 && (
                        <Animated.View
                            entering={FadeInDown.delay(400).duration(500)}
                            style={styles.section}
                        >
                            <View style={styles.sectionHeader}>
                                <View style={styles.sectionTitleRow}>
                                    <View style={styles.sectionIcon}>
                                        <Ionicons name="heart" size={14} color={ACCENT_COLOR} />
                                    </View>
                                    <Text style={styles.sectionTitle}>Recent Matches</Text>
                                </View>
                                <TouchableOpacity
                                    onPress={() => router.push("/(app)/matches")}
                                    style={styles.seeAllButton}
                                >
                                    <Text style={styles.seeAllText}>See all</Text>
                                    <Ionicons name="chevron-forward" size={14} color={ACCENT_COLOR} />
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
                                        <View style={styles.matchCard}>
                                            <View style={styles.matchRow}>
                                                <LinearGradient
                                                    colors={gradients.primary as [string, string]}
                                                    style={styles.matchIcon}
                                                    start={{ x: 0, y: 0 }}
                                                    end={{ x: 1, y: 1 }}
                                                >
                                                    <Ionicons name="heart" size={14} color={colors.text} />
                                                </LinearGradient>
                                                <Text style={styles.matchText} numberOfLines={1}>
                                                    {(match as any).question?.text || "A new match!"}
                                                </Text>
                                                {match.is_new && <View style={styles.newBadge} />}
                                            </View>
                                        </View>
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
                            <View style={styles.sectionHeader}>
                                <View style={styles.sectionTitleRow}>
                                    <View style={styles.sectionIcon}>
                                        <Ionicons name="compass" size={14} color={ACCENT_COLOR} />
                                    </View>
                                    <Text style={styles.sectionTitle}>Getting Started</Text>
                                </View>
                            </View>

                            <View style={styles.tipCard}>
                                <View style={styles.tipRow}>
                                    <View style={styles.tipIcon}>
                                        <Ionicons name="layers-outline" size={18} color={ACCENT_COLOR} />
                                    </View>
                                    <View style={styles.tipContent}>
                                        <Text style={styles.tipText}>Enable question packs</Text>
                                        <Text style={styles.tipSubtext}>Choose topics to explore together</Text>
                                    </View>
                                </View>
                            </View>
                            <View style={[styles.tipCard, styles.tipCardSpaced]}>
                                <View style={styles.tipRow}>
                                    <View style={styles.tipIcon}>
                                        <Ionicons name="swap-horizontal-outline" size={18} color={ACCENT_COLOR} />
                                    </View>
                                    <View style={styles.tipContent}>
                                        <Text style={styles.tipText}>Swipe on questions</Text>
                                        <Text style={styles.tipSubtext}>Answer yes, no, or maybe</Text>
                                    </View>
                                </View>
                            </View>
                            <View style={[styles.tipCard, styles.tipCardSpaced]}>
                                <View style={styles.tipRow}>
                                    <View style={styles.tipIcon}>
                                        <Ionicons name="heart-outline" size={18} color={ACCENT_COLOR} />
                                    </View>
                                    <View style={styles.tipContent}>
                                        <Text style={styles.tipText}>Discover matches</Text>
                                        <Text style={styles.tipSubtext}>See where you both agree</Text>
                                    </View>
                                </View>
                            </View>
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
        paddingBottom: spacing.xl,
        alignItems: 'center',
    },
    label: {
        ...typography.caption2,
        fontWeight: '600',
        letterSpacing: 2.5,
        color: ACCENT_COLOR,
        textAlign: 'center',
        marginBottom: spacing.xs,
    },
    greeting: {
        ...typography.largeTitle,
        color: colors.text,
        textAlign: 'center',
    },
    separator: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginVertical: spacing.md,
        width: 120,
    },
    separatorLine: {
        flex: 1,
        height: 1,
        backgroundColor: 'rgba(233, 69, 96, 0.3)',
    },
    separatorDiamond: {
        width: 5,
        height: 5,
        backgroundColor: ACCENT_COLOR,
        transform: [{ rotate: '45deg' }],
        marginHorizontal: spacing.sm,
        opacity: 0.6,
    },
    partnerBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(233, 69, 96, 0.1)',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: radius.full,
        borderWidth: 1,
        borderColor: 'rgba(233, 69, 96, 0.2)',
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
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: radius.full,
        borderWidth: 1,
        borderColor: colors.glass.border,
        gap: spacing.xs,
    },
    pairText: {
        ...typography.caption1,
        color: colors.textTertiary,
    },
    waitingBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(233, 69, 96, 0.1)',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: radius.full,
        borderWidth: 1,
        borderColor: 'rgba(233, 69, 96, 0.2)',
        gap: spacing.xs,
    },
    waitingText: {
        ...typography.caption1,
        color: colors.text,
        fontWeight: '500',
    },
    statsContainer: {
        flexDirection: "row",
        paddingHorizontal: spacing.lg,
        gap: spacing.sm,
    },
    statCardWrapper: {
        flex: 1,
    },
    statCard: {
        alignItems: "center",
        paddingVertical: spacing.md,
        backgroundColor: 'rgba(233, 69, 96, 0.05)',
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: 'rgba(233, 69, 96, 0.1)',
    },
    statCardActive: {
        backgroundColor: 'rgba(233, 69, 96, 0.1)',
        borderColor: 'rgba(233, 69, 96, 0.2)',
    },
    statIcon: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(233, 69, 96, 0.1)',
        justifyContent: "center",
        alignItems: "center",
        marginBottom: spacing.sm,
    },
    statIconActive: {
        backgroundColor: ACCENT_COLOR,
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
        marginTop: spacing.xl,
    },
    ctaCard: {
        position: 'relative',
        borderRadius: radius.xl,
        overflow: 'hidden',
    },
    ctaGlow: {
        position: 'absolute',
        top: -20,
        left: -20,
        right: -20,
        bottom: -20,
        backgroundColor: ACCENT_COLOR,
        borderRadius: radius.xl + 20,
    },
    ctaGradient: {
        borderRadius: radius.xl,
        padding: spacing.lg,
        flexDirection: "row",
        alignItems: "center",
        ...shadows.lg,
    },
    ctaContent: {
        flex: 1,
    },
    ctaLabel: {
        ...typography.caption2,
        fontWeight: '600',
        letterSpacing: 2,
        color: 'rgba(255,255,255,0.8)',
        marginBottom: spacing.xs,
    },
    ctaTitle: {
        ...typography.title2,
        color: colors.text,
        marginBottom: spacing.xs,
    },
    ctaSubtitle: {
        ...typography.subhead,
        color: "rgba(255,255,255,0.8)",
    },
    ctaIconContainer: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: "rgba(255,255,255,0.2)",
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.3)',
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
    sectionTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    sectionIcon: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: 'rgba(233, 69, 96, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
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
        color: ACCENT_COLOR,
    },
    matchCard: {
        marginBottom: spacing.sm,
        backgroundColor: 'rgba(233, 69, 96, 0.05)',
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: 'rgba(233, 69, 96, 0.1)',
        padding: spacing.md,
    },
    matchRow: {
        flexDirection: "row",
        alignItems: "center",
    },
    matchIcon: {
        width: 28,
        height: 28,
        borderRadius: 14,
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
        backgroundColor: ACCENT_COLOR,
    },
    tipCard: {
        backgroundColor: 'rgba(233, 69, 96, 0.05)',
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: 'rgba(233, 69, 96, 0.1)',
        padding: spacing.md,
    },
    tipCardSpaced: {
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
        backgroundColor: 'rgba(233, 69, 96, 0.1)',
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
