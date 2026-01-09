import { View, Text, StyleSheet, FlatList, RefreshControl, TouchableOpacity, ActivityIndicator, Platform, useWindowDimensions } from "react-native";
import { useMatchStore, useAuthStore } from "../../src/store";
import { useEffect, useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
    FadeIn,
    FadeInDown,
    FadeInRight,
    FadeInUp,
    useSharedValue,
    useAnimatedScrollHandler,
    useAnimatedStyle,
    interpolate,
    Extrapolation,
} from "react-native-reanimated";
import { BlurView } from "expo-blur";
import { GradientBackground, GlassCard, GlassButton, DecorativeSeparator } from "../../src/components/ui";
import { SwipeableMatchItem } from "../../src/components/matches";
import { useAmbientOrbAnimation } from "../../src/hooks";
import { colors, gradients, spacing, typography, radius, shadows } from "../../src/theme";
import { MatchesTutorial } from "../../src/components/tutorials";
import { hasSeenMatchesTutorial, markMatchesTutorialSeen } from "../../src/lib/matchesTutorialSeen";

// Premium color palette
const ACCENT = colors.premium.gold;
const ACCENT_RGBA = 'rgba(212, 175, 55, ';
const ROSE = colors.premium.rose;
const ROSE_RGBA = 'rgba(232, 164, 174, ';

const MAX_CONTENT_WIDTH = 500;
const NAV_BAR_HEIGHT = 44;
const STATUS_BAR_HEIGHT = 60;
const HEADER_SCROLL_DISTANCE = 100;

const AnimatedFlatList = Animated.createAnimatedComponent(FlatList);

export default function MatchesScreen() {
    const {
        matches,
        fetchMatches,
        markAllAsSeen,
        isLoading,
        hasMore,
        isLoadingMore,
        totalCount,
        // Archive state and methods
        archivedMatches,
        showArchived,
        toggleShowArchived,
        archiveMatch,
        unarchiveMatch,
        isLoadingArchived,
        fetchArchivedMatches,
    } = useMatchStore();
    const { user } = useAuthStore();
    const router = useRouter();
    const { width } = useWindowDimensions();
    const isWideScreen = width > MAX_CONTENT_WIDTH;
    const [showTutorial, setShowTutorial] = useState(false);

    const scrollY = useSharedValue(0);

    const scrollHandler = useAnimatedScrollHandler({
        onScroll: (event) => {
            scrollY.value = event.contentOffset.y;
        },
    });

    // Animated styles for collapsing header
    const heroStyle = useAnimatedStyle(() => {
        const opacity = interpolate(
            scrollY.value,
            [0, HEADER_SCROLL_DISTANCE * 0.7],
            [1, 0],
            Extrapolation.CLAMP
        );
        const scale = interpolate(
            scrollY.value,
            [0, HEADER_SCROLL_DISTANCE],
            [1, 0.95],
            Extrapolation.CLAMP
        );
        return { opacity, transform: [{ scale }] };
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

    // Ambient orb breathing animations
    const { orbStyle1, orbStyle2 } = useAmbientOrbAnimation();

    // Check if tutorial should be shown when screen is focused or matches change
    useFocusEffect(
        useCallback(() => {
            const checkTutorial = async () => {
                if (matches.length > 0) {
                    const seen = await hasSeenMatchesTutorial();
                    if (!seen) {
                        setShowTutorial(true);
                    }
                }
            };
            checkTutorial();
        }, [matches.length])
    );

    const handleTutorialComplete = async () => {
        await markMatchesTutorialSeen();
        setShowTutorial(false);
    };

    useFocusEffect(
        useCallback(() => {
            fetchMatches(true);
        }, [])
    );

    const handleLoadMore = useCallback(() => {
        console.log('[Matches] onEndReached called', { isLoading, isLoadingMore, hasMore, matchesCount: matches.length });
        if (!isLoading && !isLoadingMore && hasMore) {
            fetchMatches(false);
        }
    }, [isLoading, isLoadingMore, hasMore, matches.length]);

    useEffect(() => {
        if (matches.length > 0) {
            markAllAsSeen();
        }
    }, [matches.length]);

    const renderItem = ({ item, index }: { item: any; index: number }) => {
        const userResponse = item.responses?.find((r: any) => r.user_id === user?.id);
        const partnerResponse = item.responses?.find((r: any) => r.user_id !== user?.id);

        let userText = item.question.text;
        let partnerText = item.question.partner_text;

        if (item.question.partner_text && userResponse && partnerResponse) {
            const userTime = new Date(userResponse.created_at).getTime();
            const partnerTime = new Date(partnerResponse.created_at).getTime();

            if (userTime > partnerTime) {
                userText = item.question.partner_text;
                partnerText = item.question.text;
            }
        }

        const isYesYes = item.match_type === "yes_yes";

        const handleArchive = async () => {
            if (showArchived) {
                await unarchiveMatch(item.id);
            } else {
                await archiveMatch(item.id);
            }
        };

        return (
            <Animated.View entering={FadeInRight.delay(index * 50).duration(300)}>
                <SwipeableMatchItem
                    onArchive={handleArchive}
                    isArchived={showArchived}
                >
                    <TouchableOpacity
                        onPress={() => router.push(`/chat/${item.id}`)}
                        activeOpacity={0.8}
                    >
                        <View style={styles.matchCardPremium}>
                            {/* Subtle gradient background */}
                            <LinearGradient
                                colors={['rgba(22, 33, 62, 0.6)', 'rgba(13, 13, 26, 0.8)']}
                                style={StyleSheet.absoluteFill}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                            />
                            {/* Top silk highlight */}
                            <LinearGradient
                                colors={[`${ACCENT_RGBA}0.06)`, 'transparent']}
                                style={styles.cardSilkHighlight}
                                start={{ x: 0.5, y: 0 }}
                                end={{ x: 0.5, y: 1 }}
                            />

                            <View style={styles.matchRow}>
                                {/* Premium icon container */}
                                <View style={[
                                    styles.iconContainerPremium,
                                    isYesYes && styles.iconContainerYesYes
                                ]}>
                                    <Ionicons
                                        name={isYesYes ? "heart" : "heart-half"}
                                        size={20}
                                        color={isYesYes ? ACCENT : ROSE}
                                    />
                                </View>

                                <View style={styles.content}>
                                    <Text style={styles.questionTextPremium} numberOfLines={2}>
                                        {userText}
                                    </Text>
                                    {item.question.partner_text && (
                                        <Text style={styles.partnerTextPremium} numberOfLines={1}>
                                            Partner: {partnerText}
                                        </Text>
                                    )}
                                    <View style={styles.metaRow}>
                                        <View style={[
                                            styles.tagPremium,
                                            isYesYes && styles.tagPremiumHighlight
                                        ]}>
                                            <Text style={[
                                                styles.tagTextPremium,
                                                isYesYes && styles.tagTextPremiumHighlight
                                            ]}>
                                                {isYesYes ? "YES + YES" : "YES + MAYBE"}
                                            </Text>
                                        </View>
                                        <Text style={styles.datePremium}>
                                            {new Date(item.created_at).toLocaleDateString()}
                                        </Text>
                                    </View>
                                </View>

                                <View style={styles.rightSection}>
                                    {item.unreadCount > 0 && (
                                        <View style={styles.unreadBadgePremium}>
                                            <Ionicons name="chatbubble" size={10} color={colors.text} />
                                        </View>
                                    )}
                                    <View style={styles.chevronContainerPremium}>
                                        <Ionicons name="chevron-forward" size={16} color={`${ACCENT_RGBA}0.6)`} />
                                    </View>
                                </View>
                            </View>

                            {/* Premium border */}
                            <View style={styles.cardPremiumBorder} pointerEvents="none" />
                        </View>
                    </TouchableOpacity>
                </SwipeableMatchItem>
            </Animated.View>
        );
    };

    const renderFooter = () => {
        if (!isLoadingMore) return null;
        return (
            <View style={styles.footerLoader}>
                <ActivityIndicator color={colors.primary} size="small" />
            </View>
        );
    };

    if (!user) {
        return (
            <GradientBackground>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator color={colors.primary} size="large" />
                </View>
            </GradientBackground>
        );
    }

    return (
        <GradientBackground>
            {/* Ambient Orbs - Premium gold/rose */}
            <Animated.View style={[styles.ambientOrb, styles.orbTopRight, orbStyle1]} pointerEvents="none">
                <LinearGradient
                    colors={[colors.premium.goldGlow, 'transparent']}
                    style={styles.orbGradient}
                    start={{ x: 0.5, y: 0.5 }}
                    end={{ x: 1, y: 1 }}
                />
            </Animated.View>
            <Animated.View style={[styles.ambientOrb, styles.orbBottomLeft, orbStyle2]} pointerEvents="none">
                <LinearGradient
                    colors={[`${ROSE_RGBA}0.2)`, 'transparent']}
                    style={styles.orbGradient}
                    start={{ x: 0.5, y: 0.5 }}
                    end={{ x: 0, y: 0 }}
                />
            </Animated.View>

            <View style={styles.container}>
                {/* Fixed Nav Bar */}
                <View style={styles.navBar}>
                    <Animated.View style={[styles.navBarBackground, navBarBackgroundStyle]}>
                        {Platform.OS === "ios" ? (
                            <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />
                        ) : (
                            <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(13, 13, 26, 0.95)" }]} />
                        )}
                    </Animated.View>
                    
                    <Animated.Text style={[styles.navBarTitle, compactHeaderStyle]} numberOfLines={1}>
                        Matches
                    </Animated.Text>
                    
                    {/* My Answers button moved to Nav Bar */}
                    <TouchableOpacity
                        style={styles.navBarButton}
                        onPress={() => router.push({ pathname: "/(app)/my-answers", params: { returnTo: "/(app)/matches" } })}
                    >
                         <Ionicons name="list-outline" size={20} color={ACCENT} />
                    </TouchableOpacity>
                </View>

                <AnimatedFlatList
                    data={showArchived ? archivedMatches : matches}
                    renderItem={renderItem}
                    keyExtractor={(item: any) => item.id}
                    contentContainerStyle={[styles.list, isWideScreen && styles.listWide]}
                    showsVerticalScrollIndicator={false}
                    onScroll={scrollHandler}
                    scrollEventThrottle={16}
                        refreshControl={
                            <RefreshControl
                                refreshing={isLoading}
                                onRefresh={() => fetchMatches(true)}
                                tintColor={colors.primary}
                                colors={[colors.primary]}
                                progressViewOffset={STATUS_BAR_HEIGHT + NAV_BAR_HEIGHT}
                            />
                        }
                        onEndReached={handleLoadMore}
                        onEndReachedThreshold={2}
                        ListFooterComponent={renderFooter}
                        ListHeaderComponent={
                            <Animated.View
                                entering={FadeIn.duration(400)}
                                style={[styles.header, isWideScreen && styles.headerWide, heroStyle]}
                            >
                            <View style={styles.headerContent}>
                                {/* Premium label */}
                                <Text style={styles.headerLabel}>DISCOVER</Text>
                                <Text style={styles.headerTitle}>Matches</Text>

                                {/* Decorative separator */}
                                <DecorativeSeparator variant="gold" />

                                {/* Filter toggle */}
                                <View style={styles.filterContainer}>
                                    <TouchableOpacity
                                        style={[styles.filterTab, !showArchived && styles.filterTabActive]}
                                        onPress={() => showArchived && toggleShowArchived()}
                                        activeOpacity={0.7}
                                    >
                                        <Ionicons
                                            name="heart"
                                            size={14}
                                            color={!showArchived ? ACCENT : colors.textTertiary}
                                        />
                                        <Text style={[styles.filterTabText, !showArchived && styles.filterTabTextActive]}>
                                            Active
                                        </Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.filterTab, showArchived && styles.filterTabActive]}
                                        onPress={() => {
                                            if (!showArchived) {
                                                toggleShowArchived();
                                            }
                                        }}
                                        activeOpacity={0.7}
                                    >
                                        {isLoadingArchived ? (
                                            <ActivityIndicator size="small" color={ACCENT} />
                                        ) : (
                                            <>
                                                <Ionicons
                                                    name="archive-outline"
                                                    size={14}
                                                    color={showArchived ? ACCENT : colors.textTertiary}
                                                />
                                                <Text style={[styles.filterTabText, showArchived && styles.filterTabTextActive]}>
                                                    Archived
                                                </Text>
                                            </>
                                        )}
                                    </TouchableOpacity>
                                </View>

                                {/* Count badge */}
                                <View style={styles.countBadgePremium}>
                                    <Ionicons name={showArchived ? "archive" : "heart"} size={12} color={ACCENT} />
                                    <Text style={styles.countTextPremium}>
                                        {showArchived
                                            ? `${archivedMatches.length} ARCHIVED`
                                            : `${totalCount ?? matches.length} ${(totalCount ?? matches.length) === 1 ? 'MATCH' : 'MATCHES'}`
                                        }
                                    </Text>
                                </View>
                            </View>
                        </Animated.View>
                    }
                    ListEmptyComponent={
                        showArchived ? (
                            <Animated.View
                                entering={FadeInUp.duration(600).springify()}
                                style={styles.emptyContent}
                            >
                                {/* Archive icon */}
                                <View style={styles.emptyIconContainer}>
                                    <Ionicons name="archive-outline" size={48} color={ACCENT} />
                                </View>

                                {/* Description */}
                                <Text style={styles.emptyTitle}>No Archived Matches</Text>
                                <Text style={styles.emptyDescription}>
                                    Matches you archive will appear here. Swipe left on any match to archive it.
                                </Text>

                                <GlassButton
                                    onPress={() => toggleShowArchived()}
                                    style={{ marginTop: spacing.lg }}
                                >
                                    View Active Matches
                                </GlassButton>
                            </Animated.View>
                        ) : (
                            <Animated.View
                                entering={FadeInUp.duration(600).springify()}
                                style={styles.emptyContent}
                            >
                                {/* Description */}
                                <Text style={styles.emptyDescription}>
                                    Answer questions together to discover what you both enjoy. Matches appear when you agree!
                                </Text>

                                {/* Feature hints */}
                                <View style={styles.emptyFeatures}>
                                    <View style={styles.emptyFeatureItem}>
                                        <Ionicons name="heart" size={16} color={ACCENT} />
                                        <Text style={styles.emptyFeatureText}>Swipe right for yes</Text>
                                    </View>
                                    <View style={styles.emptyFeatureItem}>
                                        <Ionicons name="sparkles" size={16} color={ACCENT} />
                                        <Text style={styles.emptyFeatureText}>Match when you both agree</Text>
                                    </View>
                                    <View style={styles.emptyFeatureItem}>
                                        <Ionicons name="chatbubbles-outline" size={16} color={ACCENT} />
                                        <Text style={styles.emptyFeatureText}>Chat about your matches</Text>
                                    </View>
                                </View>

                                {/* Bottom teaser */}
                                <Text style={styles.emptyTeaser}>Your first match is just a swipe away</Text>

                                <GlassButton
                                    onPress={() => router.push("/(app)/swipe")}
                                    style={{ marginTop: spacing.lg }}
                                >
                                    Start Swiping
                                </GlassButton>
                            </Animated.View>
                        )
                    }
                />
            </View>

            {/* Matches Tutorial Overlay */}
            {showTutorial && (
                <MatchesTutorial onComplete={handleTutorialComplete} />
            )}
        </GradientBackground>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
    },
    // Ambient orbs
    ambientOrb: {
        position: 'absolute',
        width: 300,
        height: 300,
        borderRadius: 150,
    },
    orbTopRight: {
        top: 60,
        right: -40,
    },
    orbBottomLeft: {
        bottom: 180,
        left: -40,
    },
    orbGradient: {
        width: '100%',
        height: '100%',
        borderRadius: 150,
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
        justifyContent: "center",
        paddingTop: STATUS_BAR_HEIGHT - 10,
        paddingHorizontal: spacing.md,
        zIndex: 100,
    },
    navBarBackground: {
        ...StyleSheet.absoluteFillObject,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(212, 175, 55, 0.15)', // Gold tint for matches
        overflow: "hidden",
    },
    navBarTitle: {
        ...typography.headline,
        color: colors.text,
        textAlign: "center",
    },
    navBarButton: {
        position: 'absolute',
        right: spacing.md,
        top: STATUS_BAR_HEIGHT - 5,
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    // Header (Hero)
    header: {
        paddingTop: STATUS_BAR_HEIGHT + spacing.md,
        paddingHorizontal: spacing.lg,
        paddingBottom: spacing.lg,
        alignItems: 'center',
    },
    headerWide: {
        alignSelf: 'center',
        width: '100%',
        maxWidth: MAX_CONTENT_WIDTH,
    },
    headerContent: {
        alignItems: 'center',
    },
    headerLabel: {
        ...typography.caption2,
        fontWeight: '600',
        letterSpacing: 3,
        color: ACCENT,
        marginBottom: spacing.xs,
    },
    headerTitle: {
        ...typography.largeTitle,
        color: colors.text,
        textAlign: 'center',
    },
    // Filter toggle
    filterContainer: {
        flexDirection: 'row',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: radius.lg,
        padding: 4,
        marginBottom: spacing.md,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
    },
    filterTab: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: radius.md,
        gap: spacing.xs,
    },
    filterTabActive: {
        backgroundColor: `${ACCENT_RGBA}0.15)`,
    },
    filterTabText: {
        ...typography.caption1,
        color: colors.textTertiary,
        fontWeight: '500',
    },
    filterTabTextActive: {
        color: ACCENT,
        fontWeight: '600',
    },
    countBadgePremium: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: `${ACCENT_RGBA}0.1)`,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: radius.full,
        borderWidth: 1,
        borderColor: `${ACCENT_RGBA}0.2)`,
        gap: spacing.xs,
    },
    countTextPremium: {
        ...typography.caption2,
        fontWeight: '600',
        letterSpacing: 2,
        color: ACCENT,
    },
    // List
    list: {
        padding: spacing.lg,
        // Remove top padding as header handles it
        paddingTop: 0,
        paddingBottom: Platform.OS === 'ios' ? 120 : 100,
    },
    listWide: {
        alignSelf: 'center',
        width: '100%',
        maxWidth: MAX_CONTENT_WIDTH,
    },
    // Premium Match Card
    matchCardPremium: {
        marginBottom: spacing.sm,
        borderRadius: radius.lg,
        overflow: 'hidden',
        padding: spacing.md,
    },
    cardSilkHighlight: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 60,
    },
    cardPremiumBorder: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: `${ACCENT_RGBA}0.15)`,
    },
    matchRow: {
        flexDirection: "row",
        alignItems: "center",
    },
    iconContainerPremium: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: `${ROSE_RGBA}0.1)`,
        borderWidth: 1,
        borderColor: `${ROSE_RGBA}0.2)`,
        justifyContent: "center",
        alignItems: "center",
        marginRight: spacing.md,
    },
    iconContainerYesYes: {
        backgroundColor: `${ACCENT_RGBA}0.1)`,
        borderColor: `${ACCENT_RGBA}0.2)`,
    },
    content: {
        flex: 1,
    },
    questionTextPremium: {
        ...typography.subhead,
        color: colors.text,
        fontWeight: "600",
        marginBottom: spacing.xs,
        lineHeight: 20,
    },
    partnerTextPremium: {
        ...typography.caption1,
        color: colors.textSecondary,
        fontStyle: "italic",
        marginBottom: spacing.sm,
    },
    metaRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    tagPremium: {
        backgroundColor: `${ROSE_RGBA}0.1)`,
        paddingHorizontal: spacing.sm,
        paddingVertical: 3,
        borderRadius: radius.sm,
        borderWidth: 1,
        borderColor: `${ROSE_RGBA}0.15)`,
    },
    tagPremiumHighlight: {
        backgroundColor: `${ACCENT_RGBA}0.1)`,
        borderColor: `${ACCENT_RGBA}0.2)`,
    },
    tagTextPremium: {
        ...typography.caption2,
        color: ROSE,
        fontWeight: "600",
        letterSpacing: 1,
    },
    tagTextPremiumHighlight: {
        color: ACCENT,
    },
    datePremium: {
        ...typography.caption2,
        color: colors.textTertiary,
        fontStyle: 'italic',
    },
    rightSection: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        marginLeft: spacing.sm,
    },
    unreadBadgePremium: {
        width: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: ACCENT,
        justifyContent: 'center',
        alignItems: 'center',
    },
    chevronContainerPremium: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: `${ACCENT_RGBA}0.08)`,
        borderWidth: 1,
        borderColor: `${ACCENT_RGBA}0.15)`,
        justifyContent: 'center',
        alignItems: 'center',
    },
    // Premium Empty State
    emptyContent: {
        width: '100%',
        alignItems: 'center',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xl,
    },
    emptyIconContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: `${ACCENT_RGBA}0.1)`,
        borderWidth: 1,
        borderColor: `${ACCENT_RGBA}0.2)`,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: spacing.lg,
    },
    emptyTitle: {
        ...typography.title3,
        color: colors.text,
        marginBottom: spacing.sm,
    },
    emptyDescription: {
        ...typography.body,
        color: colors.textSecondary,
        textAlign: 'center',
        marginBottom: spacing.xl,
        paddingHorizontal: spacing.md,
    },
    emptyFeatures: {
        marginBottom: spacing.xl,
    },
    emptyFeatureItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: spacing.sm,
    },
    emptyFeatureText: {
        ...typography.subhead,
        color: colors.text,
        marginLeft: spacing.sm,
    },
    emptyTeaser: {
        ...typography.footnote,
        fontStyle: 'italic',
        color: colors.textTertiary,
        textAlign: 'center',
    },
    footerLoader: {
        paddingVertical: spacing.md,
        alignItems: "center",
        justifyContent: "center",
    },
});
