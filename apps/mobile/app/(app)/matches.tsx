import { View, Text, StyleSheet, RefreshControl, TouchableOpacity, ActivityIndicator, Platform, useWindowDimensions, ScrollView } from "react-native";
import { BlurView } from "expo-blur";
import { useMatchStore, useAuthStore, type PendingQuestion } from "../../src/store";
import { useEffect, useCallback, useState, useRef } from "react";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import Animated, {
    FadeIn,
    FadeInRight,
    FadeInUp,
    useSharedValue,
    useAnimatedScrollHandler,
    useAnimatedStyle,
    interpolate,
    Extrapolation,
} from "react-native-reanimated";
import { GradientBackground, GlassButton, DecorativeSeparator } from "../../src/components/ui";
import { CompactHeader } from "../../src/components/discovery";
import { SwipeableMatchItem } from "../../src/components/matches";
import { colors, spacing, typography, radius } from "../../src/theme";
import { MatchesTutorial } from "../../src/components/tutorials";
import { hasSeenMatchesTutorial, markMatchesTutorialSeen } from "../../src/lib/matchesTutorialSeen";

// Feature colors - Matches uses Primary per DESIGN.md
const PRIMARY = colors.primary;
const PRIMARY_RGBA = 'rgba(225, 48, 108, ';
const SECONDARY = colors.secondary;
const SECONDARY_RGBA = 'rgba(155, 89, 182, ';

const MAX_CONTENT_WIDTH = 500;
const HEADER_SCROLL_DISTANCE = 100;

const AnimatedFlatList = Animated.FlatList;

export default function MatchesScreen() {
    const {
        matches,
        fetchMatches,
        markAllAsSeen,
        isLoading,
        hasMore,
        isLoadingMore,
        totalCount,
        newMatchesCount,
        // Archive state and methods
        archivedMatches,
        showArchived,
        archiveMatch,
        unarchiveMatch,
        isLoadingArchived,
        // Pending state and methods
        pendingQuestions,
        isLoadingPending,
        // Their Turn state and methods
        theirTurnQuestions,
        isLoadingTheirTurn,
        fetchTheirTurnQuestions,
        currentView,
        setCurrentView,
        fetchPendingQuestions,
        // Nudge state and methods
        nudgeCooldownUntil,
        isNudging,
        sendNudge,
        checkNudgeCooldown,
    } = useMatchStore();
    const { user, couple, partner } = useAuthStore();
    const router = useRouter();
    const { width } = useWindowDimensions();
    const isWideScreen = width > MAX_CONTENT_WIDTH;
    const [showTutorial, setShowTutorial] = useState(false);
    const [nudgeFeedback, setNudgeFeedback] = useState<string | null>(null);
    const [headerHeight, setHeaderHeight] = useState(130);

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
            // Also refresh pending questions when focused
            fetchPendingQuestions();
            fetchTheirTurnQuestions();
            // Check nudge cooldown
            checkNudgeCooldown();

            // Cleanup: mark matches as seen when leaving the screen (if on Complete tab)
            return () => {
                const state = useMatchStore.getState();
                if (state.currentView === 'active' && state.matches.length > 0 && state.newMatchesCount > 0) {
                    state.markAllAsSeen();
                }
            };
        }, [])
    );

    // Format cooldown remaining time
    const formatCooldownTime = (cooldownUntil: Date): string => {
        const now = new Date();
        const diffMs = cooldownUntil.getTime() - now.getTime();
        if (diffMs <= 0) return '';

        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

        if (diffHours > 0) {
            return `${diffHours}h ${diffMins}m`;
        }
        return `${diffMins}m`;
    };

    // Check if nudge is on cooldown
    const isNudgeOnCooldown = !!(nudgeCooldownUntil && new Date() < nudgeCooldownUntil);

    // Handle nudge button press
    const handleNudge = async () => {
        if (isNudging || isNudgeOnCooldown) return;

        const result = await sendNudge();
        if (result.success) {
            setNudgeFeedback(result.notificationSent ? 'Nudge sent!' : 'Nudge recorded');
            setTimeout(() => setNudgeFeedback(null), 3000);
        }
    };

    const handleLoadMore = useCallback(() => {
        console.log('[Matches] onEndReached called', { isLoading, isLoadingMore, hasMore, matchesCount: matches.length });
        if (!isLoading && !isLoadingMore && hasMore) {
            fetchMatches(false);
        }
    }, [isLoading, isLoadingMore, hasMore, matches.length]);

    // Track previous view to detect when leaving Complete tab
    const prevViewRef = useRef<string>(currentView);

    // Mark matches as seen when navigating AWAY from the Complete tab
    useEffect(() => {
        const prevView = prevViewRef.current;
        prevViewRef.current = currentView;

        // If we were on 'active' and now switching to a different view, mark as seen
        if (prevView === 'active' && currentView !== 'active' && matches.length > 0) {
            markAllAsSeen();
        }
    }, [currentView, matches.length, markAllAsSeen]);

    const renderItem = ({ item, index }: { item: any; index: number }) => {
        // Skip rendering if question was deleted
        if (!item.question) {
            return null;
        }

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
        const isBothAnswered = item.match_type === "both_answered";

        // Get the appropriate label for the match type
        const getMatchLabel = () => {
            if (isYesYes) return "YES + YES";
            if (isBothAnswered) return "MATCHED";
            return "YES + MAYBE";
        };

        // Get the appropriate icon for the match type
        const getMatchIcon = () => {
            if (isYesYes || isBothAnswered) return "heart";
            return "heart-half";
        };

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
                        <View style={[styles.matchCardPremium, item.is_new && styles.matchCardNew]}>
                        {/* Subtle gradient background - removed for flat style
                        <LinearGradient
                            colors={['rgba(22, 33, 62, 0.6)', 'rgba(13, 13, 26, 0.8)']}
                            style={StyleSheet.absoluteFill}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                        />
                        */}
                        {/* Top silk highlight - removed for flat style
                        <LinearGradient
                            colors={[`${ACCENT_RGBA}0.06)`, 'transparent']}
                            style={styles.cardSilkHighlight}
                            start={{ x: 0.5, y: 0 }}
                            end={{ x: 0.5, y: 1 }}
                        />
                        */}

                            <View style={styles.matchRow}>
                                {/* Premium icon container */}
                                <View style={[
                                    styles.iconContainerPremium,
                                    (isYesYes || isBothAnswered) && styles.iconContainerYesYes
                                ]}>
                                    <Ionicons
                                        name={getMatchIcon()}
                                        size={20}
                                        color={(isYesYes || isBothAnswered) ? PRIMARY : SECONDARY}
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
                                        <View style={styles.metaLeft}>
                                            <View style={[
                                                styles.tagPremium,
                                                (isYesYes || isBothAnswered) && styles.tagPremiumHighlight
                                            ]}>
                                                <Text style={[
                                                    styles.tagTextPremium,
                                                    (isYesYes || isBothAnswered) && styles.tagTextPremiumHighlight
                                                ]}>
                                                    {getMatchLabel()}
                                                </Text>
                                            </View>
                                            {item.is_new && (
                                                <View style={styles.newBadge}>
                                                    <Text style={styles.newBadgeText}>NEW</Text>
                                                </View>
                                            )}
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
                                        <Ionicons name="chevron-forward" size={16} color={`${PRIMARY_RGBA}0.6)`} />
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

    const renderPendingItem = ({ item, index }: { item: PendingQuestion; index: number }) => {
        if (!item.question) {
            return null;
        }

        const packName = item.question.pack?.name ?? 'Unknown Pack';
        const timeSince = getTimeSince(item.partnerAnsweredAt);

        return (
            <Animated.View entering={FadeInRight.delay(index * 50).duration(300)}>
                <TouchableOpacity
                    onPress={() => router.push({
                        pathname: "/(app)/swipe",
                        params: { mode: 'pending', startQuestionId: item.question.id }
                    })}
                    activeOpacity={0.8}
                >
                    <View style={styles.matchCardPremium}>
                        <View style={styles.matchRow}>
                            {/* Pending icon container - hourglass */}
                            <View style={[styles.iconContainerPremium, styles.iconContainerPending]}>
                                <Ionicons
                                    name="hourglass-outline"
                                    size={20}
                                    color={PRIMARY}
                                />
                            </View>

                            <View style={styles.content}>
                                <Text style={styles.questionTextPremium} numberOfLines={2}>
                                    {item.question.text}
                                </Text>
                                <View style={styles.metaRow}>
                                    <View style={styles.tagPremium}>
                                        <Text style={styles.tagTextPremium}>
                                            {packName}
                                        </Text>
                                    </View>
                                    <Text style={styles.datePremium}>
                                        {timeSince}
                                    </Text>
                                </View>
                            </View>

                            <View style={styles.rightSection}>
                                <View style={styles.chevronContainerPremium}>
                                    <Ionicons name="chevron-forward" size={16} color={`${PRIMARY_RGBA}0.6)`} />
                                </View>
                            </View>
                        </View>

                        {/* Premium border */}
                        <View style={[styles.cardPremiumBorder, styles.cardPendingBorder]} pointerEvents="none" />
                    </View>
                </TouchableOpacity>
            </Animated.View>
        );
    };

    const renderTheirTurnItem = ({ item, index }: { item: PendingQuestion; index: number }) => {
        if (!item.question) {
            return null;
        }

        const packName = item.question.pack?.name ?? 'Unknown Pack';
        const timeSince = getTimeSince(item.partnerAnsweredAt);

        return (
            <Animated.View entering={FadeInRight.delay(index * 50).duration(300)}>
                <View style={styles.matchCardPremium}>
                    <View style={styles.matchRow}>
                        {/* Their turn icon container - clock */}
                        <View style={[styles.iconContainerPremium, styles.iconContainerTheirTurn]}>
                            <Ionicons
                                name="time-outline"
                                size={20}
                                color={SECONDARY}
                            />
                        </View>

                        <View style={styles.content}>
                            <Text style={styles.questionTextPremium} numberOfLines={2}>
                                {item.question.text}
                            </Text>
                            <View style={styles.metaRow}>
                                <View style={[styles.tagPremium, styles.tagTheirTurn]}>
                                    <Text style={[styles.tagTextPremium, styles.tagTextTheirTurn]}>
                                        {packName}
                                    </Text>
                                </View>
                                <Text style={styles.datePremium}>
                                    {timeSince}
                                </Text>
                            </View>
                        </View>

                        <View style={styles.rightSection}>
                            <View style={[styles.chevronContainerPremium, styles.chevronTheirTurn]}>
                                <Ionicons name="checkmark" size={16} color={SECONDARY} />
                            </View>
                        </View>
                    </View>

                    {/* Premium border */}
                    <View style={[styles.cardPremiumBorder, styles.cardTheirTurnBorder]} pointerEvents="none" />
                </View>
            </Animated.View>
        );
    };

    // Helper to get time since partner answered
    const getTimeSince = (dateString: string): string => {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString();
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

    // Gate matches behind pairing - user must have a partner to view matches
    if (!partner) {
        return (
            <GradientBackground>
            {/* Ambient Orbs - Commented out for flat look
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
            */}

                <View style={styles.pairingGateContainer}>
                    <Animated.View
                        entering={FadeInUp.duration(600).springify()}
                        style={styles.pairingGateContent}
                    >
                        {/* Icon */}
                        <View style={styles.pairingGateIconContainer}>
                            <Ionicons name="heart" size={36} color={PRIMARY} />
                        </View>

                        {/* Title section */}
                        <Text style={styles.pairingGateLabel}>{couple ? "ALMOST THERE" : "CONNECT"}</Text>
                        <Text style={styles.pairingGateTitle}>{couple ? "Waiting" : "Pair Up"}</Text>

                        <DecorativeSeparator variant="primary" />

                        {/* Status badge */}
                        <Animated.View
                            entering={FadeIn.delay(300).duration(400)}
                            style={styles.pairingGateBadge}
                        >
                            <Text style={styles.pairingGateBadgeText}>{couple ? "INVITE SENT" : "MADE FOR TWO"}</Text>
                        </Animated.View>

                        {/* Description */}
                        <Text style={styles.pairingGateDescription}>
                            {couple
                                ? "Share your invite code so they can join you. Once paired, you'll discover your matches here!"
                                : "Sauci is made for two! Connect with your partner to start discovering what you agree on."
                            }
                        </Text>

                        {/* Feature hints */}
                        <View style={styles.pairingGateFeatures}>
                            <View style={styles.pairingGateFeatureItem}>
                                <Ionicons name="heart" size={16} color={PRIMARY} />
                                <Text style={styles.pairingGateFeatureText}>See when you both agree</Text>
                            </View>
                            <View style={styles.pairingGateFeatureItem}>
                                <Ionicons name="sparkles" size={16} color={PRIMARY} />
                                <Text style={styles.pairingGateFeatureText}>Unlock hidden connections</Text>
                            </View>
                            <View style={styles.pairingGateFeatureItem}>
                                <Ionicons name="chatbubbles-outline" size={16} color={PRIMARY} />
                                <Text style={styles.pairingGateFeatureText}>Chat about your matches</Text>
                            </View>
                        </View>

                        {/* Bottom teaser */}
                        <Text style={styles.pairingGateTeaser}>{couple ? "Your partner is just a code away" : "Begin your journey together"}</Text>

                        <GlassButton
                            onPress={() => router.push("/pairing")}
                            style={{ marginTop: spacing.lg }}
                        >
                            {couple ? "View Invite Code" : "Pair Now"}
                        </GlassButton>
                    </Animated.View>
                </View>
            </GradientBackground>
        );
    }

    return (
        <GradientBackground>
            {/* Ambient Orbs - Commented out for flat look
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
            */}

            <View
                style={[styles.stickyHeader, isWideScreen && styles.stickyHeaderWide]}
                onLayout={(e) => setHeaderHeight(e.nativeEvent.layout.height)}
            >
                <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />
                <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(14, 14, 17, 0.85)" }]} />
                <CompactHeader
                    user={user}
                    partner={partner}
                    couple={couple}
                    label="Matches"
                    showGreeting={false}
                    showPartnerBadge={false}
                    accessory={
                        <TouchableOpacity
                            style={styles.headerActionButton}
                            onPress={() => router.push({ pathname: "/(app)/my-answers", params: { returnTo: "/(app)/matches" } })}
                        >
                            <Ionicons name="list-outline" size={18} color={colors.text} />
                        </TouchableOpacity>
                    }
                />
            </View>

            <View style={styles.container}>

                <AnimatedFlatList
                    data={
                        currentView === 'archived' ? archivedMatches :
                        currentView === 'pending' ? pendingQuestions :
                        currentView === 'their_turn' ? theirTurnQuestions :
                        matches
                    }
                    renderItem={
                        currentView === 'pending' ? renderPendingItem as any :
                        currentView === 'their_turn' ? renderTheirTurnItem as any :
                        renderItem
                    }
                    keyExtractor={(item: any) => item.id}
                    contentContainerStyle={[
                        styles.list,
                        isWideScreen && styles.listWide,
                        { paddingTop: headerHeight },
                    ]}
                    showsVerticalScrollIndicator={false}
                    onScroll={scrollHandler}
                    scrollEventThrottle={16}
                        refreshControl={
                            <RefreshControl
                                refreshing={
                                    currentView === 'pending' ? isLoadingPending :
                                    currentView === 'their_turn' ? isLoadingTheirTurn :
                                    isLoading
                                }
                                onRefresh={() => {
                                    if (currentView === 'pending') {
                                        fetchPendingQuestions();
                                    } else if (currentView === 'their_turn') {
                                        fetchTheirTurnQuestions();
                                    } else {
                                        fetchMatches(true);
                                    }
                                }}
                                tintColor={colors.primary}
                                colors={[colors.primary]}
                                progressViewOffset={headerHeight}
                            />
                        }
                        onEndReached={(currentView === 'pending' || currentView === 'their_turn') ? undefined : handleLoadMore}
                        onEndReachedThreshold={2}
                        ListFooterComponent={(currentView === 'pending' || currentView === 'their_turn') ? null : renderFooter}
                        ListHeaderComponent={
                            <Animated.View
                                entering={FadeIn.duration(400)}
                                style={[styles.header, isWideScreen && styles.headerWide, heroStyle]}
                            >
                            <View style={styles.headerContent}>

                                {/* Filter toggle - horizontal scrollable */}
                                <ScrollView
                                    horizontal
                                    showsHorizontalScrollIndicator={false}
                                    contentContainerStyle={styles.filterContainer}
                                    style={styles.filterScrollContainer}
                                >
                                    <TouchableOpacity
                                        style={[styles.filterTab, currentView === 'active' && styles.filterTabActive]}
                                        onPress={() => currentView !== 'active' && setCurrentView('active')}
                                        activeOpacity={0.7}
                                    >
                                        <Ionicons
                                            name="heart"
                                            size={16}
                                            color={currentView === 'active' ? PRIMARY : colors.textTertiary}
                                        />
                                        <Text style={[styles.filterTabText, currentView === 'active' && styles.filterTabTextActive]}>
                                            Complete
                                        </Text>
                                        {newMatchesCount > 0 && currentView !== 'active' && (
                                            <View style={styles.pendingBadge}>
                                                <Text style={styles.pendingBadgeText}>{newMatchesCount}</Text>
                                            </View>
                                        )}
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.filterTab, currentView === 'pending' && styles.filterTabActive]}
                                        onPress={() => currentView !== 'pending' && setCurrentView('pending')}
                                        activeOpacity={0.7}
                                    >
                                        {isLoadingPending ? (
                                            <ActivityIndicator size="small" color={PRIMARY} />
                                        ) : (
                                            <>
                                                <Ionicons
                                                    name="hourglass-outline"
                                                    size={16}
                                                    color={currentView === 'pending' ? PRIMARY : colors.textTertiary}
                                                />
                                                <Text style={[styles.filterTabText, currentView === 'pending' && styles.filterTabTextActive]}>
                                                    Your Turn
                                                </Text>
                                                {pendingQuestions.length > 0 && currentView !== 'pending' && (
                                                    <View style={styles.pendingBadge}>
                                                        <Text style={styles.pendingBadgeText}>{pendingQuestions.length}</Text>
                                                    </View>
                                                )}
                                            </>
                                        )}
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.filterTab, currentView === 'their_turn' && styles.filterTabActiveSecondary]}
                                        onPress={() => currentView !== 'their_turn' && setCurrentView('their_turn')}
                                        activeOpacity={0.7}
                                    >
                                        {isLoadingTheirTurn ? (
                                            <ActivityIndicator size="small" color={PRIMARY} />
                                        ) : (
                                            <>
                                                <Ionicons
                                                    name="time-outline"
                                                    size={16}
                                                    color={currentView === 'their_turn' ? SECONDARY : colors.textTertiary}
                                                />
                                                <Text style={[styles.filterTabText, currentView === 'their_turn' && styles.filterTabTextActive]}>
                                                    Their Turn
                                                </Text>
                                                {theirTurnQuestions.length > 0 && currentView !== 'their_turn' && (
                                                    <View style={[styles.pendingBadge, styles.theirTurnBadge]}>
                                                        <Text style={styles.pendingBadgeText}>{theirTurnQuestions.length}</Text>
                                                    </View>
                                                )}
                                            </>
                                        )}
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.filterTab, currentView === 'archived' && styles.filterTabActive]}
                                        onPress={() => currentView !== 'archived' && setCurrentView('archived')}
                                        activeOpacity={0.7}
                                    >
                                        {isLoadingArchived ? (
                                            <ActivityIndicator size="small" color={PRIMARY} />
                                        ) : (
                                            <>
                                                <Ionicons
                                                    name="archive-outline"
                                                    size={16}
                                                    color={currentView === 'archived' ? PRIMARY : colors.textTertiary}
                                                />
                                                <Text style={[styles.filterTabText, currentView === 'archived' && styles.filterTabTextActive]}>
                                                    Archived
                                                </Text>
                                            </>
                                        )}
                                    </TouchableOpacity>
                                </ScrollView>

                                {/* Count badge */}
                                <View style={styles.countBadgePremium}>
                                    <Ionicons
                                        name={
                                            currentView === 'archived' ? "archive" :
                                            currentView === 'pending' ? "hourglass" :
                                            currentView === 'their_turn' ? "time" :
                                            "heart"
                                        }
                                        size={12}
                                        color={PRIMARY}
                                    />
                                    <Text style={styles.countTextPremium}>
                                        {currentView === 'archived'
                                            ? `${archivedMatches.length} ARCHIVED`
                                            : currentView === 'pending'
                                            ? `${pendingQuestions.length} WAITING`
                                            : currentView === 'their_turn'
                                            ? `${theirTurnQuestions.length} SENT`
                                            : `${totalCount ?? matches.length} COMPLETE`
                                        }
                                    </Text>
                                </View>

                                {/* Nudge button - only show in Their Turn view with questions */}
                                {currentView === 'their_turn' && theirTurnQuestions.length > 0 && (
                                    <View style={styles.nudgeContainer}>
                                        {nudgeFeedback ? (
                                            <Animated.View
                                                entering={FadeIn.duration(200)}
                                                style={styles.nudgeFeedback}
                                            >
                                                <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                                                <Text style={styles.nudgeFeedbackText}>{nudgeFeedback}</Text>
                                            </Animated.View>
                                        ) : (
                                            <TouchableOpacity
                                                style={[
                                                    styles.nudgeButton,
                                                    (isNudging || isNudgeOnCooldown) && styles.nudgeButtonDisabled
                                                ]}
                                                onPress={handleNudge}
                                                disabled={isNudging || isNudgeOnCooldown}
                                                activeOpacity={0.7}
                                            >
                                                {isNudging ? (
                                                    <ActivityIndicator size="small" color={SECONDARY} />
                                                ) : (
                                                    <>
                                                        <Ionicons
                                                            name="hand-left-outline"
                                                            size={16}
                                                            color={isNudgeOnCooldown ? colors.textTertiary : SECONDARY}
                                                        />
                                                        <Text style={[
                                                            styles.nudgeButtonText,
                                                            isNudgeOnCooldown && styles.nudgeButtonTextDisabled
                                                        ]}>
                                                            {isNudgeOnCooldown && nudgeCooldownUntil
                                                                ? `Nudge in ${formatCooldownTime(nudgeCooldownUntil)}`
                                                                : 'Nudge partner'
                                                            }
                                                        </Text>
                                                    </>
                                                )}
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                )}
                            </View>
                        </Animated.View>
                    }
                    ListEmptyComponent={
                        currentView === 'archived' ? (
                            <Animated.View
                                entering={FadeInUp.duration(600).springify()}
                                style={styles.emptyContent}
                            >
                                {/* Archive icon */}
                                <View style={styles.emptyIconContainer}>
                                    <Ionicons name="archive-outline" size={48} color={PRIMARY} />
                                </View>

                                {/* Description */}
                                <Text style={styles.emptyTitle}>No Archived Matches</Text>
                                <Text style={styles.emptyDescription}>
                                    Matches you archive will appear here. Swipe left on any match to archive it.
                                </Text>

                                <GlassButton
                                    onPress={() => setCurrentView('active')}
                                    style={{ marginTop: spacing.lg }}
                                >
                                    View Active Matches
                                </GlassButton>
                            </Animated.View>
                        ) : currentView === 'pending' ? (
                            <Animated.View
                                entering={FadeInUp.duration(600).springify()}
                                style={styles.emptyContent}
                            >
                                {/* Pending icon */}
                                <View style={[styles.emptyIconContainer, { backgroundColor: `${PRIMARY_RGBA}0.1)`, borderColor: `${PRIMARY_RGBA}0.2)` }]}>
                                    <Ionicons name="checkmark-circle-outline" size={48} color={PRIMARY} />
                                </View>

                                {/* Description */}
                                <Text style={styles.emptyTitle}>All Caught Up!</Text>
                                <Text style={styles.emptyDescription}>
                                    You've answered all the questions your partner has swiped on. Keep swiping to discover more together!
                                </Text>

                                <GlassButton
                                    onPress={() => router.push("/")}
                                    style={{ marginTop: spacing.lg }}
                                >
                                    Keep Swiping
                                </GlassButton>
                            </Animated.View>
                        ) : currentView === 'their_turn' ? (
                            <Animated.View
                                entering={FadeInUp.duration(600).springify()}
                                style={styles.emptyContent}
                            >
                                {/* Their Turn icon */}
                                <View style={[styles.emptyIconContainer, { backgroundColor: `${SECONDARY_RGBA}0.1)`, borderColor: `${SECONDARY_RGBA}0.2)` }]}>
                                    <Ionicons name="time-outline" size={48} color={SECONDARY} />
                                </View>

                                {/* Description */}
                                <Text style={styles.emptyTitle}>Waiting for Partner</Text>
                                <Text style={styles.emptyDescription}>
                                    All questions you've answered have been matched! Keep swiping to give your partner more to respond to.
                                </Text>

                                <GlassButton
                                    onPress={() => router.push("/")}
                                    style={{ marginTop: spacing.lg }}
                                >
                                    Keep Swiping
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
                                        <Ionicons name="heart" size={16} color={PRIMARY} />
                                        <Text style={styles.emptyFeatureText}>Swipe right for yes</Text>
                                    </View>
                                    <View style={styles.emptyFeatureItem}>
                                        <Ionicons name="sparkles" size={16} color={PRIMARY} />
                                        <Text style={styles.emptyFeatureText}>Match when you both agree</Text>
                                    </View>
                                    <View style={styles.emptyFeatureItem}>
                                        <Ionicons name="chatbubbles-outline" size={16} color={PRIMARY} />
                                        <Text style={styles.emptyFeatureText}>Chat about your matches</Text>
                                    </View>
                                </View>

                                {/* Bottom teaser */}
                                <Text style={styles.emptyTeaser}>Your first match is just a swipe away</Text>

                                <GlassButton
                                    onPress={() => router.push("/")}
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
    stickyHeader: {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 10,
        overflow: "hidden",
    },
    stickyHeaderWide: {
        left: "50%",
        right: "auto",
        width: MAX_CONTENT_WIDTH,
        transform: [{ translateX: -MAX_CONTENT_WIDTH / 2 }],
    },
    headerActionButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: colors.backgroundLight,
        justifyContent: "center",
        alignItems: "center",
        borderWidth: 1,
        borderColor: colors.border,
    },
    // Header (Hero)
    header: {
        paddingTop: spacing.lg,
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
        width: '100%',
    },
    headerLabel: {
        ...typography.caption2,
        fontWeight: '600',
        letterSpacing: 3,
        color: PRIMARY,
        marginBottom: spacing.xs,
    },
    headerTitle: {
        ...typography.largeTitle,
        color: colors.text,
        textAlign: 'center',
    },
    // Filter toggle - scrollable carousel
    filterScrollContainer: {
        flexGrow: 0,
        marginBottom: spacing.md,
        alignSelf: 'stretch',
        marginHorizontal: -(spacing.lg * 2),
    },
    filterContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        paddingHorizontal: spacing.lg * 2,
    },
    filterTab: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.sm + 2,
        borderRadius: radius.full,
        gap: spacing.xs,
        height: 40,
        backgroundColor: colors.backgroundLight,
        borderWidth: 1,
        borderColor: colors.border,
    },
    filterTabActive: {
        backgroundColor: `${PRIMARY_RGBA}0.15)`,
        borderColor: `${PRIMARY_RGBA}0.3)`,
    },
    filterTabActiveSecondary: {
        backgroundColor: `${SECONDARY_RGBA}0.15)`,
        borderColor: `${SECONDARY_RGBA}0.3)`,
    },
    filterTabText: {
        ...typography.caption1,
        color: colors.textTertiary,
        fontWeight: '500',
    },
    filterTabTextActive: {
        color: PRIMARY,
        fontWeight: '600',
    },
    pendingBadge: {
        backgroundColor: PRIMARY,
        borderRadius: 10,
        minWidth: 18,
        height: 18,
        paddingHorizontal: 5,
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 2,
    },
    theirTurnBadge: {
        backgroundColor: SECONDARY,
    },
    pendingBadgeText: {
        ...typography.caption2,
        color: colors.text,
        fontWeight: '700',
        fontSize: 10,
    },
    countBadgePremium: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.backgroundLight,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: radius.full,
        borderWidth: 1,
        borderColor: colors.border,
        gap: spacing.xs,
    },
    countTextPremium: {
        ...typography.caption2,
        fontWeight: '600',
        letterSpacing: 2,
        color: PRIMARY,
    },
    // List
    list: {
        padding: spacing.lg,
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
        backgroundColor: colors.backgroundLight,
        borderWidth: 1,
        borderColor: colors.border,
    },
    matchCardNew: {
        backgroundColor: `${PRIMARY_RGBA}0.08)`,
        borderColor: `${PRIMARY_RGBA}0.4)`,
        borderLeftWidth: 3,
        borderLeftColor: PRIMARY,
    },
    cardSilkHighlight: {
        display: 'none',
    },
    cardPremiumBorder: {
        display: 'none',
    },
    cardPendingBorder: {
        display: 'none',
    },
    cardTheirTurnBorder: {
        display: 'none',
    },
    matchRow: {
        flexDirection: "row",
        alignItems: "center",
    },
    iconContainerPremium: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: colors.background,
        borderWidth: 1,
        borderColor: colors.border,
        justifyContent: "center",
        alignItems: "center",
        marginRight: spacing.md,
    },
    iconContainerYesYes: {
        backgroundColor: `${PRIMARY_RGBA}0.1)`,
        borderColor: `${PRIMARY_RGBA}0.2)`,
    },
    iconContainerPending: {
        backgroundColor: `${PRIMARY_RGBA}0.15)`,
        borderColor: `${PRIMARY_RGBA}0.25)`,
    },
    iconContainerTheirTurn: {
        backgroundColor: `${SECONDARY_RGBA}0.15)`,
        borderColor: `${SECONDARY_RGBA}0.25)`,
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
    metaLeft: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.xs,
    },
    newBadge: {
        backgroundColor: PRIMARY,
        paddingHorizontal: spacing.xs + 2,
        paddingVertical: 2,
        borderRadius: radius.xs,
    },
    newBadgeText: {
        ...typography.caption2,
        color: colors.text,
        fontWeight: "700",
        fontSize: 9,
        letterSpacing: 0.5,
    },
    tagPremium: {
        backgroundColor: colors.background,
        paddingHorizontal: spacing.sm,
        paddingVertical: 3,
        borderRadius: radius.sm,
        borderWidth: 1,
        borderColor: colors.border,
    },
    tagPremiumHighlight: {
        backgroundColor: `${PRIMARY_RGBA}0.1)`,
        borderColor: `${PRIMARY_RGBA}0.2)`,
    },
    tagTextPremium: {
        ...typography.caption2,
        color: SECONDARY,
        fontWeight: "600",
        letterSpacing: 1,
    },
    tagTextPremiumHighlight: {
        color: PRIMARY,
    },
    tagTheirTurn: {
        backgroundColor: `${SECONDARY_RGBA}0.1)`,
        borderColor: `${SECONDARY_RGBA}0.2)`,
    },
    tagTextTheirTurn: {
        color: SECONDARY,
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
        backgroundColor: PRIMARY,
        justifyContent: 'center',
        alignItems: 'center',
    },
    chevronContainerPremium: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: colors.background,
        borderWidth: 1,
        borderColor: colors.border,
        justifyContent: 'center',
        alignItems: 'center',
    },
    chevronTheirTurn: {
        backgroundColor: `${SECONDARY_RGBA}0.1)`,
        borderColor: `${SECONDARY_RGBA}0.2)`,
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
        backgroundColor: colors.backgroundLight,
        borderWidth: 1,
        borderColor: colors.border,
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
    pairingGateContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing.lg,
    },
    pairingGateContent: {
        width: '100%',
        maxWidth: MAX_CONTENT_WIDTH,
        alignItems: 'center',
        paddingHorizontal: spacing.md,
    },
    pairingGateIconContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: `${PRIMARY_RGBA}0.1)`,
        borderWidth: 1,
        borderColor: `${PRIMARY_RGBA}0.2)`,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: spacing.lg,
    },
    pairingGateLabel: {
        ...typography.caption2,
        fontWeight: '600',
        letterSpacing: 3,
        color: PRIMARY,
        marginBottom: spacing.xs,
    },
    pairingGateTitle: {
        ...typography.largeTitle,
        color: colors.text,
        textAlign: 'center',
        marginBottom: spacing.sm,
    },
    pairingGateBadge: {
        backgroundColor: `${PRIMARY_RGBA}0.1)`,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: radius.full,
        borderWidth: 1,
        borderColor: `${PRIMARY_RGBA}0.2)`,
        marginBottom: spacing.lg,
    },
    pairingGateBadgeText: {
        ...typography.caption2,
        fontWeight: '600',
        letterSpacing: 2,
        color: PRIMARY,
    },
    pairingGateDescription: {
        ...typography.body,
        color: colors.textSecondary,
        textAlign: 'center',
        marginBottom: spacing.xl,
        paddingHorizontal: spacing.md,
    },
    pairingGateFeatures: {
        marginBottom: spacing.xl,
    },
    pairingGateFeatureItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: spacing.sm,
    },
    pairingGateFeatureText: {
        ...typography.subhead,
        color: colors.text,
        marginLeft: spacing.sm,
    },
    pairingGateTeaser: {
        ...typography.footnote,
        fontStyle: 'italic',
        color: colors.textTertiary,
        textAlign: 'center',
    },
    // Nudge button styles
    nudgeContainer: {
        marginTop: spacing.md,
        alignItems: 'center',
    },
    nudgeButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.sm + 2,
        borderRadius: radius.full,
        gap: spacing.xs,
        backgroundColor: `${SECONDARY_RGBA}0.15)`,
        borderWidth: 1,
        borderColor: `${SECONDARY_RGBA}0.3)`,
        minWidth: 140,
    },
    nudgeButtonDisabled: {
        backgroundColor: colors.backgroundLight,
        borderColor: colors.border,
    },
    nudgeButtonText: {
        ...typography.caption1,
        color: SECONDARY,
        fontWeight: '600',
    },
    nudgeButtonTextDisabled: {
        color: colors.textTertiary,
    },
    nudgeFeedback: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
    },
    nudgeFeedbackText: {
        ...typography.caption1,
        color: colors.success,
        fontWeight: '500',
    },
});
