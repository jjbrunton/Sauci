import { View, Text, StyleSheet, FlatList, RefreshControl, TouchableOpacity, ActivityIndicator, Platform, useWindowDimensions } from "react-native";
import { useMatchStore, useAuthStore, type PendingQuestion } from "../../src/store";
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
        archiveMatch,
        unarchiveMatch,
        isLoadingArchived,
        // Pending state and methods
        pendingQuestions,
        isLoadingPending,
        currentView,
        setCurrentView,
        fetchPendingQuestions,
    } = useMatchStore();
    const { user, couple, partner } = useAuthStore();
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
            // Also refresh pending questions when focused
            fetchPendingQuestions();
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
                        {/* Subtle gradient background - slightly different hue for pending */}
                        <LinearGradient
                            colors={['rgba(33, 33, 62, 0.6)', 'rgba(13, 13, 26, 0.8)']}
                            style={StyleSheet.absoluteFill}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                        />
                        {/* Top silk highlight */}
                        <LinearGradient
                            colors={[`${ROSE_RGBA}0.06)`, 'transparent']}
                            style={styles.cardSilkHighlight}
                            start={{ x: 0.5, y: 0 }}
                            end={{ x: 0.5, y: 1 }}
                        />

                        <View style={styles.matchRow}>
                            {/* Pending icon container - hourglass */}
                            <View style={[styles.iconContainerPremium, styles.iconContainerPending]}>
                                <Ionicons
                                    name="hourglass-outline"
                                    size={20}
                                    color={ROSE}
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
                                    <Ionicons name="chevron-forward" size={16} color={`${ROSE_RGBA}0.6)`} />
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
                {/* Ambient Orbs */}
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

                <View style={styles.pairingGateContainer}>
                    <Animated.View
                        entering={FadeInUp.duration(600).springify()}
                        style={styles.pairingGateContent}
                    >
                        {/* Icon */}
                        <View style={styles.pairingGateIconContainer}>
                            <Ionicons name="heart" size={36} color={ROSE} />
                        </View>

                        {/* Title section */}
                        <Text style={styles.pairingGateLabel}>{couple ? "ALMOST THERE" : "CONNECT"}</Text>
                        <Text style={styles.pairingGateTitle}>{couple ? "Waiting" : "Pair Up"}</Text>

                        <DecorativeSeparator variant="rose" />

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
                                <Ionicons name="heart" size={16} color={ACCENT} />
                                <Text style={styles.pairingGateFeatureText}>See when you both agree</Text>
                            </View>
                            <View style={styles.pairingGateFeatureItem}>
                                <Ionicons name="sparkles" size={16} color={ACCENT} />
                                <Text style={styles.pairingGateFeatureText}>Unlock hidden connections</Text>
                            </View>
                            <View style={styles.pairingGateFeatureItem}>
                                <Ionicons name="chatbubbles-outline" size={16} color={ACCENT} />
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
                    data={currentView === 'archived' ? archivedMatches : currentView === 'pending' ? pendingQuestions : matches}
                    renderItem={currentView === 'pending' ? renderPendingItem as any : renderItem}
                    keyExtractor={(item: any) => item.id}
                    contentContainerStyle={[styles.list, isWideScreen && styles.listWide]}
                    showsVerticalScrollIndicator={false}
                    onScroll={scrollHandler}
                    scrollEventThrottle={16}
                        refreshControl={
                            <RefreshControl
                                refreshing={currentView === 'pending' ? isLoadingPending : isLoading}
                                onRefresh={() => {
                                    if (currentView === 'pending') {
                                        fetchPendingQuestions();
                                    } else {
                                        fetchMatches(true);
                                    }
                                }}
                                tintColor={colors.primary}
                                colors={[colors.primary]}
                                progressViewOffset={STATUS_BAR_HEIGHT + NAV_BAR_HEIGHT}
                            />
                        }
                        onEndReached={currentView === 'pending' ? undefined : handleLoadMore}
                        onEndReachedThreshold={2}
                        ListFooterComponent={currentView === 'pending' ? null : renderFooter}
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
                                        style={[styles.filterTab, currentView === 'pending' && styles.filterTabActive]}
                                        onPress={() => currentView !== 'pending' && setCurrentView('pending')}
                                        activeOpacity={0.7}
                                    >
                                        {isLoadingPending ? (
                                            <ActivityIndicator size="small" color={ACCENT} />
                                        ) : (
                                            <>
                                                <Ionicons
                                                    name="hourglass-outline"
                                                    size={14}
                                                    color={currentView === 'pending' ? ACCENT : colors.textTertiary}
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
                                        style={[styles.filterTab, currentView === 'active' && styles.filterTabActive]}
                                        onPress={() => currentView !== 'active' && setCurrentView('active')}
                                        activeOpacity={0.7}
                                    >
                                        <Ionicons
                                            name="heart"
                                            size={14}
                                            color={currentView === 'active' ? ACCENT : colors.textTertiary}
                                        />
                                        <Text style={[styles.filterTabText, currentView === 'active' && styles.filterTabTextActive]}>
                                            Complete
                                        </Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.filterTab, currentView === 'archived' && styles.filterTabActive]}
                                        onPress={() => currentView !== 'archived' && setCurrentView('archived')}
                                        activeOpacity={0.7}
                                    >
                                        {isLoadingArchived ? (
                                            <ActivityIndicator size="small" color={ACCENT} />
                                        ) : (
                                            <>
                                                <Ionicons
                                                    name="archive-outline"
                                                    size={14}
                                                    color={currentView === 'archived' ? ACCENT : colors.textTertiary}
                                                />
                                                <Text style={[styles.filterTabText, currentView === 'archived' && styles.filterTabTextActive]}>
                                                    Archived
                                                </Text>
                                            </>
                                        )}
                                    </TouchableOpacity>
                                </View>

                                {/* Count badge */}
                                <View style={styles.countBadgePremium}>
                                    <Ionicons
                                        name={currentView === 'archived' ? "archive" : currentView === 'pending' ? "hourglass" : "heart"}
                                        size={12}
                                        color={ACCENT}
                                    />
                                    <Text style={styles.countTextPremium}>
                                        {currentView === 'archived'
                                            ? `${archivedMatches.length} ARCHIVED`
                                            : currentView === 'pending'
                                            ? `${pendingQuestions.length} WAITING`
                                            : `${totalCount ?? matches.length} COMPLETE`
                                        }
                                    </Text>
                                </View>
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
                                    <Ionicons name="archive-outline" size={48} color={ACCENT} />
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
                                <View style={[styles.emptyIconContainer, { backgroundColor: `${ROSE_RGBA}0.1)`, borderColor: `${ROSE_RGBA}0.2)` }]}>
                                    <Ionicons name="checkmark-circle-outline" size={48} color={ROSE} />
                                </View>

                                {/* Description */}
                                <Text style={styles.emptyTitle}>All Caught Up!</Text>
                                <Text style={styles.emptyDescription}>
                                    You've answered all the questions your partner has swiped on. Keep swiping to discover more together!
                                </Text>

                                <GlassButton
                                    onPress={() => router.push("/(app)/swipe")}
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
    pendingBadge: {
        backgroundColor: ROSE,
        borderRadius: 10,
        minWidth: 18,
        height: 18,
        paddingHorizontal: 5,
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 2,
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
    cardPendingBorder: {
        borderColor: `${ROSE_RGBA}0.2)`,
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
    iconContainerPending: {
        backgroundColor: `${ROSE_RGBA}0.15)`,
        borderColor: `${ROSE_RGBA}0.25)`,
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
    // Pairing gate styles
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
        backgroundColor: `${ROSE_RGBA}0.1)`,
        borderWidth: 1,
        borderColor: `${ROSE_RGBA}0.2)`,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: spacing.lg,
    },
    pairingGateLabel: {
        ...typography.caption2,
        fontWeight: '600',
        letterSpacing: 3,
        color: ROSE,
        marginBottom: spacing.xs,
    },
    pairingGateTitle: {
        ...typography.largeTitle,
        color: colors.text,
        textAlign: 'center',
        marginBottom: spacing.sm,
    },
    pairingGateBadge: {
        backgroundColor: `${ROSE_RGBA}0.1)`,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: radius.full,
        borderWidth: 1,
        borderColor: `${ROSE_RGBA}0.2)`,
        marginBottom: spacing.lg,
    },
    pairingGateBadgeText: {
        ...typography.caption2,
        fontWeight: '600',
        letterSpacing: 2,
        color: ROSE,
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
});
