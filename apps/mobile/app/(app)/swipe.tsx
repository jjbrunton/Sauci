import { useState, useEffect, useRef } from "react";
import { View, StyleSheet, Text, ActivityIndicator, Platform } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
    FadeIn,
    FadeInUp,
    useSharedValue,
    useAnimatedStyle,
    withRepeat,
    withTiming,
    interpolate,
    Easing,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { supabase } from "../../src/lib/supabase";
import { usePacksStore, useAuthStore } from "../../src/store";
import { useAmbientOrbAnimation } from "../../src/hooks";
import { skipQuestion, getSkippedQuestionIds } from "../../src/lib/skippedQuestions";
import { hasSeenSwipeTutorial, markSwipeTutorialSeen } from "../../src/lib/swipeTutorialSeen";
import { invokeWithAuthRetry } from "../../src/lib/authErrorHandler";
// import SwipeCard from "../../src/components/SwipeCard";
import { SwipeCardPremium as SwipeCard } from "../../src/components/swipe"; // PoC: Premium styling
import { SwipeTutorial } from "../../src/components/tutorials";
import { GradientBackground, GlassCard, GlassButton, DecorativeSeparator } from "../../src/components/ui";
import { Events } from "../../src/lib/analytics";
import { colors, gradients, spacing, typography, radius, shadows } from "../../src/theme";

export default function SwipeScreen() {
    const { packId } = useLocalSearchParams();
    const [questions, setQuestions] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [showTutorial, setShowTutorial] = useState(false);
    const [isBlocked, setIsBlocked] = useState(false);
    const [gapInfo, setGapInfo] = useState<{ unanswered: number; threshold: number } | null>(null);
    const { enabledPackIds, fetchPacks } = usePacksStore();
    const { partner, couple } = useAuthStore();
    const hasTrackedExhausted = useRef(false);

    // Ambient orb breathing animations
    const { orbStyle1, orbStyle2 } = useAmbientOrbAnimation();

    // Progress bar shimmer animation
    const shimmerPosition = useSharedValue(-1);

    useEffect(() => {
        // Progress bar shimmer sweep - 2.5 second cycle
        shimmerPosition.value = withRepeat(
            withTiming(2, { duration: 2500, easing: Easing.linear }),
            -1,
            false
        );
    }, []);

    const shimmerStyle = useAnimatedStyle(() => ({
        transform: [
            { translateX: interpolate(shimmerPosition.value, [-1, 2], [-60, 220]) },
        ],
    }));

    useEffect(() => {
        fetchPacks().then(() => fetchQuestions());
        checkTutorial();
        hasTrackedExhausted.current = false; // Reset when pack changes
    }, [packId]);

    // Check if user is too far ahead of partner (called when questions empty or after swipe)
    const checkAnswerGap = async (): Promise<boolean> => {
        if (!couple || !partner) {
            setIsBlocked(false);
            setGapInfo(null);
            return false;
        }

        try {
            const { data, error } = await supabase.rpc('get_answer_gap_status');

            if (error) {
                console.error('Error checking answer gap:', error);
                return false;
            }

            if (data && data.length > 0) {
                const result = data[0];
                setIsBlocked(result.is_blocked);
                // Only set gap info if threshold is enabled (> 0)
                if (result.threshold > 0) {
                    setGapInfo({
                        unanswered: result.unanswered_by_partner,
                        threshold: result.threshold
                    });
                } else {
                    setGapInfo(null);
                }
                return result.is_blocked;
            }
        } catch (error) {
            console.error('Failed to check answer gap:', error);
        }
        return false;
    };

    // Calculate effective total questions (accounting for gap limit)
    const effectiveTotal = (() => {
        if (!gapInfo || gapInfo.threshold === 0) {
            // No gap limit active, show all questions
            return questions.length;
        }
        // remaining = how many more questions until blocked
        const remaining = gapInfo.threshold - gapInfo.unanswered;
        // effective total = current position + remaining (capped by actual questions)
        return Math.min(questions.length, currentIndex + Math.max(0, remaining));
    })();

    // Track when all questions are exhausted
    useEffect(() => {
        if (questions.length > 0 && currentIndex >= questions.length && !hasTrackedExhausted.current) {
            hasTrackedExhausted.current = true;
            Events.allQuestionsExhausted();
        }
    }, [currentIndex, questions.length]);

    const checkTutorial = async () => {
        const seen = await hasSeenSwipeTutorial();
        if (!seen) {
            setShowTutorial(true);
        }
    };

    const handleTutorialComplete = async () => {
        await markSwipeTutorialSeen();
        setShowTutorial(false);
    };

    // Filter out questions from disabled packs immediately when enabledPackIds changes
    useEffect(() => {
        if (!packId && enabledPackIds.length > 0 && questions.length > 0) {
            const enabledSet = new Set(enabledPackIds);
            setQuestions(prev => {
                const filtered = prev.filter(q => enabledSet.has(q.pack_id));
                // Adjust currentIndex if it's now beyond the filtered list
                if (currentIndex >= filtered.length && filtered.length > 0) {
                    setCurrentIndex(filtered.length - 1);
                }
                return filtered;
            });
        }
    }, [enabledPackIds]);

    const fetchQuestions = async () => {
        try {
            const [{ data, error }, skippedIds] = await Promise.all([
                supabase.rpc("get_recommended_questions", {
                    target_pack_id: packId || null
                }),
                getSkippedQuestionIds()
            ]);

            if (error) {
                console.error("Error fetching recommended questions:", error);
                throw error;
            }

            // Filter out recently skipped questions
            const filtered = (data || []).filter((q: any) => !skippedIds.has(q.id));

            // Always check answer gap when user has partner and not viewing specific pack
            // This gives us the gap info for accurate counter display
            if (partner && !packId) {
                await checkAnswerGap();
            } else {
                // Reset blocked state if no partner or viewing specific pack
                setIsBlocked(false);
                setGapInfo(null);
            }

            const sorted = filtered.sort((a: any, b: any) => {
                let scoreA = Math.random();
                let scoreB = Math.random();

                if (a.partner_answered && a.is_two_part) scoreA += 1.5;
                else if (a.partner_answered) scoreA += 0.7;
                else if (a.is_two_part) scoreA += 0.4;

                if (b.partner_answered && b.is_two_part) scoreB += 1.5;
                else if (b.partner_answered) scoreB += 0.7;
                else if (b.is_two_part) scoreB += 0.4;

                return scoreB - scoreA;
            });

            setQuestions(sorted);
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSwipe = async (direction: "left" | "right" | "up" | "down") => {
        const question = questions[currentIndex];

        setCurrentIndex(prev => prev + 1);

        // Handle skip - don't submit a response, just store it for later
        if (direction === "down") {
            await skipQuestion(question.id);
            Events.questionSkipped();
            return;
        }

        const answer = direction === "right" ? "yes" : direction === "left" ? "no" : "maybe";

        try {
            const { error } = await invokeWithAuthRetry("submit-response", {
                body: {
                    question_id: question.id,
                    answer,
                },
            });

            if (error) {
                console.error("Submit response error:", error);
            } else {
                Events.questionAnswered(answer, question.pack_id);
                // Check if we've hit the answer gap threshold
                await checkAnswerGap();
            }
        } catch (error) {
            console.error("Failed to submit response", error);
        }
    };

    if (isLoading) {
        return (
            <GradientBackground>
                <View style={styles.centerContainer}>
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>
            </GradientBackground>
        );
    }

    // Show "pair with partner" prompt when user doesn't have a partner yet
    if (!partner) {
        const PAIR_ACCENT = colors.premium.rose;
        return (
            <GradientBackground>
                <View style={styles.centerContainer}>
                    <Animated.View
                        entering={FadeInUp.duration(600).springify()}
                        style={styles.waitingContent}
                    >
                        {/* Icon */}
                        <View style={styles.waitingIconContainer}>
                            <Ionicons name="heart" size={36} color={PAIR_ACCENT} />
                        </View>

                        {/* Title section */}
                        <Text style={styles.waitingLabel}>{couple ? "ALMOST THERE" : "CONNECT"}</Text>
                        <Text style={styles.waitingTitle}>{couple ? "Waiting" : "Pair Up"}</Text>

                        <DecorativeSeparator variant="rose" />

                        {/* Status badge */}
                        <Animated.View
                            entering={FadeIn.delay(300).duration(400)}
                            style={styles.waitingBadge}
                        >
                            <Text style={styles.waitingBadgeText}>{couple ? "INVITE SENT" : "MADE FOR TWO"}</Text>
                        </Animated.View>

                        {/* Description */}
                        <Text style={styles.waitingDescription}>
                            {couple
                                ? "Share your invite code so they can join you. Once paired, you'll both answer questions and discover what you agree on!"
                                : "Sauci is made for two! Connect with your partner to start answering questions together and discover what you have in common."
                            }
                        </Text>

                        {/* Feature hints */}
                        <View style={styles.waitingFeatures}>
                            <View style={styles.waitingFeatureItem}>
                                <Ionicons name="lock-closed-outline" size={16} color={PAIR_ACCENT} />
                                <Text style={styles.waitingFeatureText}>Private and secure</Text>
                            </View>
                            <View style={styles.waitingFeatureItem}>
                                <Ionicons name="sparkles" size={16} color={PAIR_ACCENT} />
                                <Text style={styles.waitingFeatureText}>Discover hidden desires</Text>
                            </View>
                            <View style={styles.waitingFeatureItem}>
                                <Ionicons name="chatbubble-ellipses-outline" size={16} color={PAIR_ACCENT} />
                                <Text style={styles.waitingFeatureText}>Chat about your matches</Text>
                            </View>
                        </View>

                        {/* Bottom teaser */}
                        <Text style={styles.waitingTeaser}>{couple ? "Your partner is just a code away" : "Begin your intimate journey together"}</Text>

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

    // Show "waiting for partner" message when user is too far ahead
    if (isBlocked && gapInfo) {
        const WAITING_ACCENT = colors.premium.rose;
        return (
            <GradientBackground>
                <View style={styles.centerContainer}>
                    <Animated.View
                        entering={FadeInUp.duration(600).springify()}
                        style={styles.waitingContent}
                    >
                        {/* Icon */}
                        <View style={styles.waitingIconContainer}>
                            <Ionicons name="hourglass-outline" size={36} color={WAITING_ACCENT} />
                        </View>

                        {/* Title section */}
                        <Text style={styles.waitingLabel}>PATIENCE</Text>
                        <Text style={styles.waitingTitle}>Waiting</Text>

                        <DecorativeSeparator variant="rose" />

                        {/* Status badge */}
                        <Animated.View
                            entering={FadeIn.delay(300).duration(400)}
                            style={styles.waitingBadge}
                        >
                            <Text style={styles.waitingBadgeText}>{gapInfo.unanswered} UNANSWERED</Text>
                        </Animated.View>

                        {/* Description */}
                        <Text style={styles.waitingDescription}>
                            You're ahead by {gapInfo.unanswered} questions. Give your partner some time to catch up so you can discover matches together.
                        </Text>

                        {/* Feature hints */}
                        <View style={styles.waitingFeatures}>
                            <View style={styles.waitingFeatureItem}>
                                <Ionicons name="heart-outline" size={16} color={WAITING_ACCENT} />
                                <Text style={styles.waitingFeatureText}>Matches happen together</Text>
                            </View>
                            <View style={styles.waitingFeatureItem}>
                                <Ionicons name="notifications-outline" size={16} color={WAITING_ACCENT} />
                                <Text style={styles.waitingFeatureText}>We'll notify your partner</Text>
                            </View>
                            <View style={styles.waitingFeatureItem}>
                                <Ionicons name="refresh-outline" size={16} color={WAITING_ACCENT} />
                                <Text style={styles.waitingFeatureText}>Check back anytime</Text>
                            </View>
                        </View>

                        {/* Bottom teaser */}
                        <Text style={styles.waitingTeaser}>Good things come to those who wait</Text>

                        <GlassButton
                            variant="secondary"
                            onPress={checkAnswerGap}
                            style={{ marginTop: spacing.lg }}
                        >
                            Check Again
                        </GlassButton>
                    </Animated.View>
                </View>
            </GradientBackground>
        );
    }

    // Show "no packs enabled" message when not viewing a specific pack and no packs are enabled
    if (!packId && enabledPackIds.length === 0) {
        const NO_PACKS_ACCENT = colors.premium.rose;
        return (
            <GradientBackground>
                <View style={styles.centerContainer}>
                    <Animated.View
                        entering={FadeInUp.duration(600).springify()}
                        style={styles.waitingContent}
                    >
                        {/* Icon */}
                        <View style={styles.waitingIconContainer}>
                            <Ionicons name="layers-outline" size={36} color={NO_PACKS_ACCENT} />
                        </View>

                        {/* Title section */}
                        <Text style={styles.waitingLabel}>GET STARTED</Text>
                        <Text style={styles.waitingTitle}>Choose Packs</Text>

                        <DecorativeSeparator variant="rose" />

                        {/* Status badge */}
                        <Animated.View
                            entering={FadeIn.delay(300).duration(400)}
                            style={styles.waitingBadge}
                        >
                            <Text style={styles.waitingBadgeText}>NO PACKS ENABLED</Text>
                        </Animated.View>

                        {/* Description */}
                        <Text style={styles.waitingDescription}>
                            Select the question packs that interest you and your partner. Each pack explores different aspects of your relationship.
                        </Text>

                        {/* Feature hints */}
                        <View style={styles.waitingFeatures}>
                            <View style={styles.waitingFeatureItem}>
                                <Ionicons name="flame-outline" size={16} color={NO_PACKS_ACCENT} />
                                <Text style={styles.waitingFeatureText}>From playful to passionate</Text>
                            </View>
                            <View style={styles.waitingFeatureItem}>
                                <Ionicons name="shield-checkmark-outline" size={16} color={NO_PACKS_ACCENT} />
                                <Text style={styles.waitingFeatureText}>Safe space to explore</Text>
                            </View>
                            <View style={styles.waitingFeatureItem}>
                                <Ionicons name="infinite-outline" size={16} color={NO_PACKS_ACCENT} />
                                <Text style={styles.waitingFeatureText}>New packs added regularly</Text>
                            </View>
                        </View>

                        {/* Bottom teaser */}
                        <Text style={styles.waitingTeaser}>Your journey of discovery awaits</Text>

                        <GlassButton
                            onPress={() => router.push("/packs")}
                            style={{ marginTop: spacing.lg }}
                        >
                            Choose Packs
                        </GlassButton>
                    </Animated.View>
                </View>
            </GradientBackground>
        );
    }

    if (currentIndex >= questions.length) {
        const CAUGHT_UP_ACCENT = colors.premium.rose;
        return (
            <GradientBackground>
                <View style={styles.centerContainer}>
                    <Animated.View
                        entering={FadeInUp.duration(600).springify()}
                        style={styles.waitingContent}
                    >
                        {/* Icon */}
                        <View style={styles.caughtUpIconContainer}>
                            <Ionicons name="checkmark" size={36} color={CAUGHT_UP_ACCENT} />
                        </View>

                        {/* Title section */}
                        <Text style={styles.caughtUpLabel}>COMPLETE</Text>
                        <Text style={styles.waitingTitle}>All Caught Up</Text>

                        <DecorativeSeparator variant="rose" />

                        {/* Status badge */}
                        <Animated.View
                            entering={FadeIn.delay(300).duration(400)}
                            style={styles.waitingBadge}
                        >
                            <Text style={styles.waitingBadgeText}>YOU'RE AHEAD</Text>
                        </Animated.View>

                        {/* Description */}
                        <Text style={styles.waitingDescription}>
                            You've answered all available questions. New questions are added regularly, or explore different packs.
                        </Text>

                        {/* Feature hints */}
                        <View style={styles.waitingFeatures}>
                            <View style={styles.waitingFeatureItem}>
                                <Ionicons name="sparkles" size={16} color={CAUGHT_UP_ACCENT} />
                                <Text style={styles.waitingFeatureText}>New questions weekly</Text>
                            </View>
                            <View style={styles.waitingFeatureItem}>
                                <Ionicons name="layers-outline" size={16} color={CAUGHT_UP_ACCENT} />
                                <Text style={styles.waitingFeatureText}>Try different packs</Text>
                            </View>
                            <View style={styles.waitingFeatureItem}>
                                <Ionicons name="chatbubbles-outline" size={16} color={CAUGHT_UP_ACCENT} />
                                <Text style={styles.waitingFeatureText}>Chat about your matches</Text>
                            </View>
                        </View>

                        {/* Bottom teaser */}
                        <Text style={styles.waitingTeaser}>More ways to connect are on the way</Text>

                        <GlassButton
                            variant="secondary"
                            onPress={fetchQuestions}
                            style={{ marginTop: spacing.lg }}
                        >
                            Refresh Questions
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
                    colors={['rgba(232, 164, 174, 0.2)', 'transparent']}
                    style={styles.orbGradient}
                    start={{ x: 0.5, y: 0.5 }}
                    end={{ x: 0, y: 0 }}
                />
            </Animated.View>

            <View style={styles.container}>
                {/* Header */}
                <Animated.View
                    entering={FadeIn.duration(400)}
                    style={styles.header}
                >
                    <View style={styles.progressContainer}>
                        {/* Premium label */}
                        <Text style={styles.progressLabel}>EXPLORE</Text>
                        <Text style={styles.progressText}>
                            {currentIndex + 1} of {effectiveTotal || questions.length}
                        </Text>
                        <View style={[styles.progressBar, styles.progressBarPremium]}>
                            <Animated.View
                                style={[
                                    styles.progressFill,
                                    styles.progressFillPremium,
                                    { width: `${((currentIndex + 1) / (effectiveTotal || questions.length || 1)) * 100}%` }
                                ]}
                            >
                                {/* Shimmer sweep */}
                                <Animated.View style={[styles.progressShimmer, shimmerStyle]}>
                                    <LinearGradient
                                        colors={['transparent', 'rgba(212, 175, 55, 0.5)', 'transparent']}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 0 }}
                                        style={StyleSheet.absoluteFill}
                                    />
                                </Animated.View>
                            </Animated.View>
                        </View>
                    </View>
                </Animated.View>

                {/* Card Stack */}
                <View style={styles.cardContainer}>
                    {/* Third card (deepest) */}
                    {questions[currentIndex + 2] && (
                        <View style={[styles.stackCard, styles.stackCardThird]} />
                    )}

                    {/* Second card */}
                    {questions[currentIndex + 1] && (
                        <View style={[styles.stackCard, styles.stackCardSecond]} />
                    )}

                    {/* Active card */}
                    <SwipeCard
                        key={questions[currentIndex].id}
                        question={questions[currentIndex]}
                        onSwipe={handleSwipe}
                    />
                </View>

                {/* Hint - Premium styling */}
                <Animated.View
                    entering={FadeIn.delay(500).duration(400)}
                    style={styles.hintContainer}
                >
                    <Text style={styles.hintTextPremium}>Swipe or tap to answer</Text>
                </Animated.View>

                {/* Bottom spacing for tab bar */}
                <View style={styles.bottomSpacer} />
            </View>

            {/* Tutorial Overlay */}
            {showTutorial && (
                <SwipeTutorial onComplete={handleTutorialComplete} />
            )}
        </GradientBackground>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    centerContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
    },
    // Ambient orbs - more visible
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
    header: {
        paddingTop: 60,
        paddingHorizontal: spacing.lg,
        paddingBottom: spacing.md,
    },
    progressContainer: {
        alignItems: "center",
    },
    progressLabel: {
        ...typography.caption2,
        fontWeight: '600',
        letterSpacing: 3,
        color: colors.premium.gold,
        marginBottom: spacing.xs,
    },
    progressText: {
        ...typography.subhead,
        color: colors.textSecondary,
        marginBottom: spacing.sm,
    },
    progressBar: {
        width: 160,
        height: 6,
        backgroundColor: colors.glass.background,
        borderRadius: 3,
        overflow: "hidden",
    },
    progressBarPremium: {
        width: 140,
        height: 4,
        borderRadius: 2,
        backgroundColor: 'rgba(212, 175, 55, 0.1)',
        borderWidth: 1,
        borderColor: 'rgba(212, 175, 55, 0.15)',
    },
    progressFill: {
        height: "100%",
        borderRadius: 4,
        overflow: "hidden",
    },
    progressFillPremium: {
        backgroundColor: 'rgba(212, 175, 55, 0.5)',
        borderRadius: 2,
    },
    progressGradient: {
        flex: 1,
        borderRadius: 4,
    },
    progressShimmer: {
        position: 'absolute',
        width: 60,
        height: '100%',
        top: 0,
    },
    cardContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
    },
    // Card stack - Premium styling
    stackCard: {
        position: "absolute",
        width: "85%",
        height: 500,
        backgroundColor: '#0d0d1a',
        borderRadius: radius.xl,
        borderWidth: 1,
        borderColor: 'rgba(212, 175, 55, 0.15)',
    },
    stackCardSecond: {
        transform: [{ scale: 0.95 }, { translateY: 12 }],
        opacity: 0.4,
        ...shadows.md,
    },
    stackCardThird: {
        transform: [{ scale: 0.90 }, { translateY: 24 }],
        opacity: 0.2,
        ...shadows.sm,
    },
    hintContainer: {
        alignItems: "center",
        paddingBottom: spacing.md,
    },
    hintText: {
        ...typography.caption1,
        color: colors.textTertiary,
    },
    hintTextPremium: {
        ...typography.caption1,
        fontStyle: 'italic',
        color: colors.textTertiary,
        letterSpacing: 0.5,
    },
    bottomSpacer: {
        height: Platform.OS === 'ios' ? 100 : 80,
    },
    // Premium "waiting for partner" styles
    waitingContent: {
        width: '100%',
        alignItems: 'center',
        paddingHorizontal: spacing.md,
    },
    waitingIconContainer: {
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: 'rgba(232, 164, 174, 0.1)',
        borderWidth: 1,
        borderColor: 'rgba(232, 164, 174, 0.2)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: spacing.xl,
    },
    waitingLabel: {
        ...typography.caption1,
        fontWeight: '600',
        letterSpacing: 3,
        color: colors.premium.rose,
        textAlign: 'center',
        marginBottom: spacing.xs,
    },
    waitingTitle: {
        ...typography.largeTitle,
        color: colors.text,
        textAlign: 'center',
    },
    waitingBadge: {
        backgroundColor: 'rgba(232, 164, 174, 0.1)',
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.sm,
        borderRadius: radius.full,
        borderWidth: 1,
        borderColor: 'rgba(232, 164, 174, 0.2)',
        marginBottom: spacing.xl,
    },
    waitingBadgeText: {
        ...typography.caption2,
        fontWeight: '600',
        letterSpacing: 2,
        color: colors.premium.rose,
    },
    waitingDescription: {
        ...typography.body,
        color: colors.textSecondary,
        textAlign: 'center',
        marginBottom: spacing.xl,
        paddingHorizontal: spacing.md,
    },
    waitingFeatures: {
        marginBottom: spacing.xl,
    },
    waitingFeatureItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: spacing.sm,
    },
    waitingFeatureText: {
        ...typography.subhead,
        color: colors.text,
        marginLeft: spacing.sm,
    },
    waitingTeaser: {
        ...typography.footnote,
        fontStyle: 'italic',
        color: colors.textTertiary,
        textAlign: 'center',
    },
    // Caught up specific styles
    caughtUpIconContainer: {
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: 'rgba(232, 164, 174, 0.1)',
        borderWidth: 1,
        borderColor: 'rgba(232, 164, 174, 0.2)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: spacing.xl,
    },
    caughtUpLabel: {
        ...typography.caption1,
        fontWeight: '600',
        letterSpacing: 3,
        color: colors.premium.rose,
        textAlign: 'center',
        marginBottom: spacing.xs,
    },
});
