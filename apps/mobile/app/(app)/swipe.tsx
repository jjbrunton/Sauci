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
    withSequence,
    withTiming,
    interpolate,
    Easing,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { supabase } from "../../src/lib/supabase";
import { usePacksStore, useAuthStore } from "../../src/store";
import { skipQuestion, getSkippedQuestionIds } from "../../src/lib/skippedQuestions";
import { hasSeenSwipeTutorial, markSwipeTutorialSeen } from "../../src/lib/swipeTutorialSeen";
import { invokeWithAuthRetry } from "../../src/lib/authErrorHandler";
import SwipeCard from "../../src/components/SwipeCard";
import SwipeTutorial from "../../src/components/SwipeTutorial";
import { GradientBackground, GlassCard, GlassButton } from "../../src/components/ui";
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
    const orbBreathing1 = useSharedValue(0);
    const orbBreathing2 = useSharedValue(0);
    const orbDrift = useSharedValue(0);
    const shimmerPosition = useSharedValue(-1);

    useEffect(() => {
        // Primary orb breathing - 6 second cycle
        orbBreathing1.value = withRepeat(
            withSequence(
                withTiming(1, { duration: 3000, easing: Easing.inOut(Easing.sin) }),
                withTiming(0, { duration: 3000, easing: Easing.inOut(Easing.sin) })
            ),
            -1,
            true
        );

        // Secondary orb breathing - offset timing for variation
        orbBreathing2.value = withRepeat(
            withSequence(
                withTiming(0, { duration: 2000, easing: Easing.inOut(Easing.sin) }),
                withTiming(1, { duration: 4000, easing: Easing.inOut(Easing.sin) }),
                withTiming(0, { duration: 2000, easing: Easing.inOut(Easing.sin) })
            ),
            -1,
            true
        );

        // Subtle vertical drift - 8 second cycle
        orbDrift.value = withRepeat(
            withSequence(
                withTiming(1, { duration: 4000, easing: Easing.inOut(Easing.sin) }),
                withTiming(0, { duration: 4000, easing: Easing.inOut(Easing.sin) })
            ),
            -1,
            true
        );

        // Progress bar shimmer sweep - 2.5 second cycle
        shimmerPosition.value = withRepeat(
            withTiming(2, { duration: 2500, easing: Easing.linear }),
            -1,
            false
        );
    }, []);

    const orbStyle1 = useAnimatedStyle(() => ({
        opacity: interpolate(orbBreathing1.value, [0, 1], [0.25, 0.5]),
        transform: [
            { translateY: interpolate(orbDrift.value, [0, 1], [0, -20]) },
            { scale: interpolate(orbBreathing1.value, [0, 1], [1, 1.1]) },
        ],
    }));

    const orbStyle2 = useAnimatedStyle(() => ({
        opacity: interpolate(orbBreathing2.value, [0, 1], [0.2, 0.4]),
        transform: [
            { translateY: interpolate(orbDrift.value, [0, 1], [20, 0]) },
            { scale: interpolate(orbBreathing2.value, [0, 1], [1, 1.1]) },
        ],
    }));

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
                setGapInfo({
                    unanswered: result.unanswered_by_partner,
                    threshold: result.threshold
                });
                return result.is_blocked;
            }
        } catch (error) {
            console.error('Failed to check answer gap:', error);
        }
        return false;
    };

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

            // If no questions returned and user has partner, check if it's due to answer gap
            if (filtered.length === 0 && partner && !packId) {
                await checkAnswerGap();
            } else {
                // Reset blocked state if we have questions
                setIsBlocked(false);
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
        return (
            <GradientBackground showAccent>
                <View style={styles.centerContainer}>
                    <Animated.View
                        entering={FadeInUp.duration(600).springify()}
                        style={styles.emptyContent}
                    >
                        <LinearGradient
                            colors={gradients.primary as [string, string]}
                            style={styles.pairIconContainer}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                        >
                            <Ionicons name="heart" size={48} color={colors.text} />
                        </LinearGradient>
                        <Text style={styles.pairTitle}>
                            {couple ? "Waiting for your partner" : "Pair with your partner"}
                        </Text>
                        <Text style={styles.emptySubtitle}>
                            {couple
                                ? "Share your invite code so they can join you. Once paired, you'll both answer questions and discover what you agree on!"
                                : "Sauci is made for two! Connect with your partner to start answering questions together and discover what you have in common."
                            }
                        </Text>
                        <GlassButton
                            onPress={() => router.push("/pairing")}
                            style={{ marginTop: spacing.xl }}
                            size="lg"
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
        return (
            <GradientBackground showAccent>
                <View style={styles.centerContainer}>
                    <Animated.View
                        entering={FadeInUp.duration(600).springify()}
                        style={styles.emptyContent}
                    >
                        <LinearGradient
                            colors={gradients.warning as [string, string]}
                            style={styles.pairIconContainer}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                        >
                            <Ionicons name="hourglass-outline" size={48} color={colors.text} />
                        </LinearGradient>
                        <Text style={styles.pairTitle}>
                            Waiting for your partner
                        </Text>
                        <Text style={styles.emptySubtitle}>
                            You've answered {gapInfo.unanswered} questions that your partner hasn't seen yet. Give them some time to catch up!
                        </Text>
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
        return (
            <GradientBackground showAccent>
                <View style={styles.centerContainer}>
                    <Animated.View
                        entering={FadeInUp.duration(600).springify()}
                        style={styles.emptyContent}
                    >
                        <View style={styles.noPacksIconContainer}>
                            <Ionicons name="layers-outline" size={64} color={colors.textTertiary} />
                        </View>
                        <Text style={styles.emptyTitle}>No packs enabled</Text>
                        <Text style={styles.emptySubtitle}>
                            Enable at least one question pack to start playing.
                        </Text>
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
        return (
            <GradientBackground showAccent>
                <View style={styles.centerContainer}>
                    <Animated.View
                        entering={FadeInUp.duration(600).springify()}
                        style={styles.emptyContent}
                    >
                        <View style={styles.emptyIconContainer}>
                            <Ionicons name="checkmark-circle" size={64} color={colors.primary} />
                        </View>
                        <Text style={styles.emptyTitle}>All caught up!</Text>
                        <Text style={styles.emptySubtitle}>
                            Check back later for more questions or try a different pack.
                        </Text>
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
            {/* Ambient Orbs */}
            <Animated.View style={[styles.ambientOrb, styles.orbTopRight, orbStyle1]} pointerEvents="none">
                <LinearGradient
                    colors={[colors.primaryGlow, 'transparent']}
                    style={styles.orbGradient}
                    start={{ x: 0.5, y: 0.5 }}
                    end={{ x: 1, y: 1 }}
                />
            </Animated.View>
            <Animated.View style={[styles.ambientOrb, styles.orbBottomLeft, orbStyle2]} pointerEvents="none">
                <LinearGradient
                    colors={[colors.secondaryGlow, 'transparent']}
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
                        <Text style={styles.progressText}>
                            {currentIndex + 1} of {questions.length}
                        </Text>
                        <View style={[styles.progressBar, styles.progressBarEnhanced]}>
                            <Animated.View
                                style={[
                                    styles.progressFill,
                                    { width: `${((currentIndex + 1) / questions.length) * 100}%` }
                                ]}
                            >
                                <LinearGradient
                                    colors={gradients.primary as [string, string]}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 0 }}
                                    style={styles.progressGradient}
                                />
                                {/* Shimmer sweep */}
                                <Animated.View style={[styles.progressShimmer, shimmerStyle]}>
                                    <LinearGradient
                                        colors={['transparent', 'rgba(255,255,255,0.3)', 'transparent']}
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

                {/* Hint */}
                <Animated.View
                    entering={FadeIn.delay(500).duration(400)}
                    style={styles.hintContainer}
                >
                    <Text style={styles.hintText}>Swipe or tap to answer</Text>
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
    progressBarEnhanced: {
        height: 8,
        borderRadius: 4,
        borderWidth: 1,
        borderColor: colors.glass.borderLight,
        ...shadows.glow(colors.primaryGlow),
    },
    progressFill: {
        height: "100%",
        borderRadius: 4,
        overflow: "hidden",
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
    // Card stack
    stackCard: {
        position: "absolute",
        width: "85%",
        height: 480,
        backgroundColor: colors.glass.backgroundLight,
        borderRadius: radius.xxl,
        borderWidth: 1,
        borderColor: colors.glass.border,
    },
    stackCardSecond: {
        transform: [{ scale: 0.95 }, { translateY: 12 }],
        opacity: 0.5,
        ...shadows.md,
    },
    stackCardThird: {
        transform: [{ scale: 0.90 }, { translateY: 24 }],
        opacity: 0.25,
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
    emptyContent: {
        alignItems: "center",
        paddingHorizontal: spacing.xl,
    },
    emptyIconContainer: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: colors.primaryLight,
        justifyContent: "center",
        alignItems: "center",
        marginBottom: spacing.lg,
    },
    pairIconContainer: {
        width: 120,
        height: 120,
        borderRadius: 60,
        justifyContent: "center",
        alignItems: "center",
        marginBottom: spacing.xl,
        ...shadows.lg,
    },
    pairTitle: {
        ...typography.title1,
        color: colors.text,
        marginBottom: spacing.md,
        textAlign: "center",
    },
    noPacksIconContainer: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: colors.glass.background,
        justifyContent: "center",
        alignItems: "center",
        marginBottom: spacing.lg,
    },
    emptyTitle: {
        ...typography.title2,
        color: colors.text,
        marginBottom: spacing.sm,
    },
    emptySubtitle: {
        ...typography.body,
        color: colors.textSecondary,
        textAlign: "center",
    },
    bottomSpacer: {
        height: Platform.OS === 'ios' ? 100 : 80,
    },
});
