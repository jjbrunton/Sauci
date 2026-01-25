import { useState, useEffect, useRef, useCallback } from "react";
import { View, StyleSheet, Text, ActivityIndicator, Platform, TouchableOpacity } from "react-native";
import { useLocalSearchParams, router, useFocusEffect } from "expo-router";
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
import { QuestionFeedbackModal } from "../../src/components/feedback";
import { GradientBackground, GlassCard, GlassButton, DecorativeSeparator } from "../../src/components/ui";
import { Paywall } from "../../src/components/paywall";
import { Events } from "../../src/lib/analytics";
import { colors, gradients, spacing, typography, radius, shadows } from "../../src/theme";

interface DailyLimitInfo {
    responses_today: number;
    limit_value: number;
    remaining: number;
    reset_at: string;
    is_blocked: boolean;
}

export default function SwipeScreen() {
    const params = useLocalSearchParams();
    // Normalize packId - useLocalSearchParams can return string | string[]
    const packId = Array.isArray(params.packId) ? params.packId[0] : params.packId;
    // Mode can be 'pending' to show only questions partner has answered
    const mode = Array.isArray(params.mode) ? params.mode[0] : params.mode;
    // Start question ID - when user taps a specific pending question, start there
    const startQuestionId = Array.isArray(params.startQuestionId) ? params.startQuestionId[0] : params.startQuestionId;
    const [questions, setQuestions] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [showTutorial, setShowTutorial] = useState(false);
    const [feedbackQuestion, setFeedbackQuestion] = useState<{id: string, text: string} | null>(null);
    const [isBlocked, setIsBlocked] = useState(false);
    const [gapInfo, setGapInfo] = useState<{ unanswered: number; threshold: number } | null>(null);
    const [dailyLimitInfo, setDailyLimitInfo] = useState<DailyLimitInfo | null>(null);
    const [showPaywall, setShowPaywall] = useState(false);
    const [packContext, setPackContext] = useState<{ name: string; icon: string } | null>(null);
    const { enabledPackIds, ensureEnabledPacksLoaded } = usePacksStore();
    const { partner, couple } = useAuthStore();
    const hasTrackedExhausted = useRef(false);
    const fetchRequestId = useRef(0);
    const lastFetchedMode = useRef<string | undefined>(undefined);

    // Ambient orb breathing animations
    const { orbStyle1, orbStyle2 } = useAmbientOrbAnimation();

    // Progress bar shimmer animation
    const shimmerPosition = useSharedValue(-1);

    // Countdown for daily limit reset
    const [countdown, setCountdown] = useState<string>("");

    useEffect(() => {
        if (!dailyLimitInfo?.is_blocked || !dailyLimitInfo.reset_at) {
            setCountdown("");
            return;
        }

        const updateCountdown = () => {
            const now = new Date();
            const reset = new Date(dailyLimitInfo.reset_at);
            const diff = reset.getTime() - now.getTime();

            if (diff <= 0) {
                setCountdown("00:00:00");
                // Refresh questions when timer expires
                fetchQuestions();
                return;
            }

            const hours = Math.floor(diff / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((diff % (1000 * 60)) / 1000);

            setCountdown(`${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
        };

        updateCountdown();
        const interval = setInterval(updateCountdown, 1000);

        return () => clearInterval(interval);
    }, [dailyLimitInfo?.is_blocked, dailyLimitInfo?.reset_at]);

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

    const isFirstMount = useRef(true);

    useEffect(() => {
        // Reset state when pack or mode changes
        setCurrentIndex(0);
        setIsLoading(true);
        setIsBlocked(false);
        setGapInfo(null);
        hasTrackedExhausted.current = false;
        lastFetchedMode.current = mode;

        // Use lightweight ensureEnabledPacksLoaded instead of full fetchPacks
        ensureEnabledPacksLoaded().then(() => {
            if (mode === 'pending') {
                fetchPendingQuestions();
            } else {
                fetchQuestions();
            }
        });
        checkTutorial();
    }, [packId, mode]);

    // Fetch pack context when packId is provided
    useEffect(() => {
        if (packId) {
            const fetchPackContext = async () => {
                const { data } = await supabase
                    .from('question_packs')
                    .select('name, icon')
                    .eq('id', packId)
                    .single();
                if (data) {
                    setPackContext({ name: data.name, icon: data.icon || 'layers' });
                }
            };
            fetchPackContext();
        } else {
            setPackContext(null);
        }
    }, [packId]);

    // Refresh questions when screen gains focus (handles partner answering while away)
    useFocusEffect(
        useCallback(() => {
            // Skip on first mount since useEffect already fetches
            if (isFirstMount.current) {
                isFirstMount.current = false;
                return;
            }
            // Skip if mode just changed (useEffect handles that)
            if (lastFetchedMode.current !== mode) {
                return;
            }
            // Silently refetch to get updated status
            if (mode === 'pending') {
                fetchPendingQuestions();
            } else {
                fetchQuestions();
            }
        }, [packId, mode])
    );

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
                // Clear blocked state on error so user isn't stuck
                setIsBlocked(false);
                setGapInfo(null);
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

            // No data returned - clear blocked state
            setIsBlocked(false);
            setGapInfo(null);
            return false;
        } catch (error) {
            console.error('Failed to check answer gap:', error);
            // Clear blocked state on error so user isn't stuck
            setIsBlocked(false);
            setGapInfo(null);
            return false;
        }
    };

    // Check if user has reached daily response limit
    const checkDailyLimit = async (): Promise<boolean> => {
        try {
            const { data, error } = await supabase.rpc('get_daily_response_limit_status');

            if (error) {
                console.error('Error checking daily limit:', error);
                setDailyLimitInfo(null);
                return false;
            }

            if (data && data.length > 0) {
                const result = data[0];
                setDailyLimitInfo(result);
                return result.is_blocked;
            }

            setDailyLimitInfo(null);
            return false;
        } catch (error) {
            console.error('Failed to check daily limit:', error);
            setDailyLimitInfo(null);
            return false;
        }
    };

    // Calculate effective total questions (accounting for gap limit AND daily limit)
    const effectiveTotal = (() => {
        let total = questions.length;

        // Apply gap limit if active
        if (gapInfo && gapInfo.threshold > 0) {
            const remaining = gapInfo.threshold - gapInfo.unanswered;
            total = Math.min(total, currentIndex + Math.max(0, remaining));
        }

        // Apply daily limit if active
        if (dailyLimitInfo && dailyLimitInfo.limit_value > 0 && !dailyLimitInfo.is_blocked) {
            total = Math.min(total, currentIndex + dailyLimitInfo.remaining);
        }

        return total;
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
    // Skip this filter in pending mode - user should answer ALL questions partner swiped on
    useEffect(() => {
        if (!packId && mode !== 'pending' && enabledPackIds.length > 0 && questions.length > 0) {
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
    }, [enabledPackIds, mode]);


    const fetchQuestions = async () => {
        // Race protection: increment request ID and track current request
        const currentRequestId = ++fetchRequestId.current;

        try {
            const [{ data, error }, skippedIds] = await Promise.all([
                supabase.rpc("get_recommended_questions", {
                    target_pack_id: packId || null
                }),
                getSkippedQuestionIds()
            ]);

            // Race guard: if a newer request started, discard this result
            if (currentRequestId !== fetchRequestId.current) {
                return;
            }

            if (error) {
                console.error("Error fetching recommended questions:", error);
                throw error;
            }

            // Filter out recently skipped questions
            const filtered = (data || []).filter((q: any) => !skippedIds.has(q.id));

            // Always check answer gap and daily limit when user has partner and not viewing specific pack
            if (partner && !packId) {
                await Promise.all([checkAnswerGap(), checkDailyLimit()]);
            } else {
                // Reset blocked state if no partner or viewing specific pack
                setIsBlocked(false);
                setGapInfo(null);
                setDailyLimitInfo(null);
            }

            // Server provides ordering (daily seeded random with priority)
            // Only update state if still the current request
            if (currentRequestId === fetchRequestId.current) {
                setQuestions(filtered);
            }
        } catch (error) {
            if (currentRequestId === fetchRequestId.current) {
                console.error(error);
            }
        } finally {
            if (currentRequestId === fetchRequestId.current) {
                setIsLoading(false);
            }
        }
    };

    // Fetch pending questions (partner answered, user hasn't) for "Your Turn" mode
    const fetchPendingQuestions = async () => {
        const currentRequestId = ++fetchRequestId.current;
        const userId = useAuthStore.getState().user?.id;
        const coupleId = useAuthStore.getState().user?.couple_id;

        if (!coupleId || !userId) {
            if (currentRequestId === fetchRequestId.current) {
                setQuestions([]);
                setIsLoading(false);
            }
            return;
        }

        try {
            // Get partner's user_id
            const { data: coupleProfiles } = await supabase
                .from("profiles")
                .select("id")
                .eq("couple_id", coupleId)
                .neq("id", userId);

            const partnerId = coupleProfiles?.[0]?.id;
            if (!partnerId) {
                if (currentRequestId === fetchRequestId.current) {
                    setQuestions([]);
                    setIsLoading(false);
                }
                return;
            }

            // Get questions the current user has already answered
            const { data: userResponses } = await supabase
                .from("responses")
                .select("question_id")
                .eq("user_id", userId)
                .eq("couple_id", coupleId);

            const answeredQuestionIds = new Set(userResponses?.map(r => r.question_id) ?? []);

            // Get partner's responses (questions they answered that user hasn't)
            // Order by oldest first so user burns down the backlog
            const { data: partnerResponses, error } = await supabase
                .from("responses")
                .select(`
                    id,
                    question_id,
                    created_at,
                    question:questions(
                        *,
                        pack:question_packs(id, name, icon)
                    )
                `)
                .eq("user_id", partnerId)
                .eq("couple_id", coupleId)
                .order("created_at", { ascending: true }); // Oldest first

            if (currentRequestId !== fetchRequestId.current) return;

            if (error) {
                console.error("Error fetching pending questions:", error);
                throw error;
            }

            // Filter to only questions user hasn't answered, excluding deleted questions
            const pendingQuestions = (partnerResponses ?? [])
                .filter(r => {
                    const question = r.question as any;
                    return !answeredQuestionIds.has(r.question_id) && question && !question.deleted_at;
                })
                .map(r => {
                    const question = r.question as any;
                    return {
                        ...question,
                        pack_id: question.pack?.id,
                        pack_name: question.pack?.name,
                        pack_icon: question.pack?.icon,
                    };
                });

            if (currentRequestId === fetchRequestId.current) {
                // If user tapped a specific question, reorder so it's first
                let orderedQuestions = pendingQuestions;
                if (startQuestionId && pendingQuestions.length > 0) {
                    const startIndex = pendingQuestions.findIndex(q => q.id === startQuestionId);
                    if (startIndex !== -1) {
                        // Put tapped question first, then the rest in original order
                        const tappedQuestion = pendingQuestions[startIndex];
                        const rest = pendingQuestions.filter((_, i) => i !== startIndex);
                        orderedQuestions = [tappedQuestion, ...rest];
                    }
                }

                setQuestions(orderedQuestions);
                setCurrentIndex(0); // Always start at 0 now since we reordered

                // Don't check gap/daily limits in pending mode - user is just catching up
                setIsBlocked(false);
                setGapInfo(null);
                setDailyLimitInfo(null);
            }
        } catch (error) {
            if (currentRequestId === fetchRequestId.current) {
                console.error("Failed to fetch pending questions:", error);
                setQuestions([]);
            }
        } finally {
            if (currentRequestId === fetchRequestId.current) {
                setIsLoading(false);
            }
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
                
                // Skip limit checks in pending mode - user is just catching up
                if (mode !== 'pending') {
                    // Increment local daily count if we have limit info
                    if (dailyLimitInfo && dailyLimitInfo.limit_value > 0) {
                        setDailyLimitInfo(prev => prev ? {
                            ...prev,
                            responses_today: prev.responses_today + 1,
                            remaining: Math.max(0, prev.remaining - 1),
                            is_blocked: prev.responses_today + 1 >= prev.limit_value
                        } : null);
                    }

                    // Check both gap and daily limit
                    await Promise.all([checkAnswerGap(), checkDailyLimit()]);
                }
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

    // Show "daily limit reached" screen when user has exhausted their daily quota
    if (dailyLimitInfo?.is_blocked) {
        const LIMIT_ACCENT = colors.premium.gold;
        return (
            <GradientBackground>
                {/* Ambient Orbs - Gold/warm glow */}
                <Animated.View style={[styles.ambientOrb, styles.dailyLimitOrbTop, orbStyle1]} pointerEvents="none">
                    <LinearGradient
                        colors={[colors.premium.goldGlow, 'transparent']}
                        style={styles.orbGradient}
                        start={{ x: 0.5, y: 0.5 }}
                        end={{ x: 1, y: 1 }}
                    />
                </Animated.View>
                <Animated.View style={[styles.ambientOrb, styles.dailyLimitOrbBottom, orbStyle2]} pointerEvents="none">
                    <LinearGradient
                        colors={['rgba(212, 175, 55, 0.15)', 'transparent']}
                        style={styles.orbGradient}
                        start={{ x: 0.5, y: 0.5 }}
                        end={{ x: 0, y: 0 }}
                    />
                </Animated.View>

                <View style={styles.centerContainer}>
                    <Animated.View
                        entering={FadeInUp.duration(600).springify()}
                        style={styles.waitingContent}
                    >
                        {/* Icon with glow effect */}
                        <View style={styles.dailyLimitIconWrapper}>
                            <View style={styles.dailyLimitIconGlow} />
                            <View style={styles.dailyLimitIconContainer}>
                                <Ionicons name="hourglass-outline" size={36} color={LIMIT_ACCENT} />
                            </View>
                        </View>

                        {/* Title section */}
                        <Text style={styles.dailyLimitLabel}>DAILY LIMIT REACHED</Text>
                        <Text style={styles.dailyLimitTitle}>Take a Breather</Text>

                        <DecorativeSeparator variant="gold" />

                        {/* Countdown timer - prominent display */}
                        <Animated.View
                            entering={FadeIn.delay(300).duration(400)}
                            style={styles.countdownContainer}
                        >
                            <Text style={styles.countdownLabel}>REFRESHES IN</Text>
                            <View style={styles.countdownBadge}>
                                <Ionicons name="timer-outline" size={20} color={LIMIT_ACCENT} />
                                <Text style={styles.countdownText}>{countdown}</Text>
                            </View>
                        </Animated.View>

                        {/* Description */}
                        <Text style={styles.dailyLimitDescription}>
                            You've answered {dailyLimitInfo.limit_value} questions today!{'\n'}
                            Let the anticipation build while you wait.
                        </Text>

                        {/* Feature hints - vertical list */}
                        <View style={styles.waitingFeatures}>
                            <View style={styles.waitingFeatureItem}>
                                <Ionicons name="chatbubbles-outline" size={16} color={colors.premium.gold} />
                                <Text style={styles.waitingFeatureText}>Chat about your matches</Text>
                            </View>
                            <View style={styles.waitingFeatureItem}>
                                <Ionicons name="sparkles" size={16} color={colors.premium.gold} />
                                <Text style={styles.waitingFeatureText}>Fresh questions tomorrow</Text>
                            </View>
                            <View style={styles.waitingFeatureItem}>
                                <Ionicons name="infinite-outline" size={16} color={colors.premium.gold} />
                                <Text style={styles.waitingFeatureText}>Go unlimited with Premium</Text>
                            </View>
                        </View>

                        {/* Premium upsell button */}
                        <Text style={styles.premiumUpsellText}>Want to keep exploring?</Text>
                        <TouchableOpacity
                            onPress={() => setShowPaywall(true)}
                            style={styles.premiumButton}
                            activeOpacity={0.85}
                        >
                            <LinearGradient
                                colors={[colors.premium.gold, colors.premium.goldDark]}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={styles.premiumButtonGradient}
                            />
                            <View style={styles.premiumButtonContent}>
                                <Ionicons name="infinite" size={18} color="#000" />
                                <Text style={styles.premiumButtonText}>Unlock Unlimited</Text>
                            </View>
                        </TouchableOpacity>
                    </Animated.View>
                </View>

                {/* Paywall Modal */}
                <Paywall
                    visible={showPaywall}
                    onClose={() => setShowPaywall(false)}
                    onSuccess={() => {
                        setShowPaywall(false);
                        // Refresh to clear limit status
                        fetchQuestions();
                    }}
                />
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
        const isPackMode = !!packId;
        const isPendingMode = mode === 'pending';
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
                        <Text style={styles.caughtUpLabel}>
                            {isPendingMode ? 'QUEUE COMPLETE' : isPackMode ? 'PACK COMPLETE' : 'COMPLETE'}
                        </Text>
                        <Text style={styles.waitingTitle}>
                            {isPendingMode ? 'All Caught Up!' : isPackMode ? packContext?.name || 'Pack Complete' : 'All Caught Up'}
                        </Text>

                        <DecorativeSeparator variant="rose" />

                        {/* Status badge */}
                        <Animated.View
                            entering={FadeIn.delay(300).duration(400)}
                            style={styles.waitingBadge}
                        >
                            <Text style={styles.waitingBadgeText}>
                                {isPendingMode ? 'YOUR TURN COMPLETE' : isPackMode ? 'ALL QUESTIONS ANSWERED' : "YOU'RE AHEAD"}
                            </Text>
                        </Animated.View>

                        {/* Description */}
                        <Text style={styles.waitingDescription}>
                            {isPendingMode
                                ? "You've answered all the questions your partner swiped on. Nice work! Check back later for more."
                                : isPackMode
                                ? "You've answered all questions in this pack. Explore other packs to discover more!"
                                : "You've answered all available questions. New questions are added regularly, or explore different packs."
                            }
                        </Text>

                        {/* Feature hints */}
                        <View style={styles.waitingFeatures}>
                            {isPendingMode ? (
                                <>
                                    <View style={styles.waitingFeatureItem}>
                                        <Ionicons name="heart" size={16} color={CAUGHT_UP_ACCENT} />
                                        <Text style={styles.waitingFeatureText}>Check your matches</Text>
                                    </View>
                                    <View style={styles.waitingFeatureItem}>
                                        <Ionicons name="chatbubbles-outline" size={16} color={CAUGHT_UP_ACCENT} />
                                        <Text style={styles.waitingFeatureText}>Chat about discoveries</Text>
                                    </View>
                                    <View style={styles.waitingFeatureItem}>
                                        <Ionicons name="sparkles" size={16} color={CAUGHT_UP_ACCENT} />
                                        <Text style={styles.waitingFeatureText}>Keep exploring together</Text>
                                    </View>
                                </>
                            ) : (
                                <>
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
                                </>
                            )}
                        </View>

                        {/* Bottom teaser */}
                        <Text style={styles.waitingTeaser}>
                            {isPendingMode
                                ? 'Your partner will love that you caught up'
                                : isPackMode
                                ? 'Discover more ways to connect'
                                : 'More ways to connect are on the way'}
                        </Text>

                        {isPendingMode ? (
                            <GlassButton
                                onPress={() => router.push("/(app)/matches")}
                                style={{ marginTop: spacing.lg }}
                            >
                                View Matches
                            </GlassButton>
                        ) : isPackMode ? (
                            <GlassButton
                                onPress={() => router.back()}
                                style={{ marginTop: spacing.lg }}
                            >
                                Explore More Packs
                            </GlassButton>
                        ) : (
                            <GlassButton
                                variant="secondary"
                                onPress={fetchQuestions}
                                style={{ marginTop: spacing.lg }}
                            >
                                Refresh Questions
                            </GlassButton>
                        )}
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
                    <View style={styles.headerRow}>
                        {/* Back button when playing specific pack or pending mode */}
                        {(packId || mode === 'pending') && (
                            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                                <Ionicons name="chevron-back" size={24} color={colors.text} />
                            </TouchableOpacity>
                        )}
                        <View style={styles.progressContainer}>
                            {/* Premium label */}
                            <Text style={styles.progressLabel}>
                                {mode === 'pending' ? 'YOUR TURN' : packContext ? packContext.name.toUpperCase() : 'EXPLORE'}
                            </Text>
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
                        {/* Spacer to balance header when back button is shown */}
                        {(packId || mode === 'pending') && <View style={styles.headerSpacer} />}
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
                        onReport={() => setFeedbackQuestion({
                            id: questions[currentIndex].id,
                            text: questions[currentIndex].text
                        })}
                    />
                </View>

                {/* Hint - Premium styling */}
                <Animated.View
                    entering={FadeIn.delay(500).duration(400)}
                    style={styles.hintContainer}
                >
                    <Text style={styles.hintTextPremium}>Swipe or tap to answer</Text>
                    
                    <TouchableOpacity
                        onPress={() => router.push({ pathname: "/my-answers", params: { returnTo: "/(app)/swipe" } })}
                        style={styles.editLinkButton}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <Text style={styles.editLinkText}>Edit previous answers</Text>
                    </TouchableOpacity>
                </Animated.View>

                {/* Bottom spacing for tab bar */}
                <View style={styles.bottomSpacer} />
            </View>

            {/* Tutorial Overlay */}
            {showTutorial && (
                <SwipeTutorial onComplete={handleTutorialComplete} />
            )}

            {/* Question Feedback Modal */}
            <QuestionFeedbackModal
                visible={!!feedbackQuestion}
                onClose={() => setFeedbackQuestion(null)}
                questionId={feedbackQuestion?.id || ''}
                questionText={feedbackQuestion?.text || ''}
            />

            {/* Paywall Modal */}
            <Paywall
                visible={showPaywall}
                onClose={() => setShowPaywall(false)}
                onSuccess={() => {
                    setShowPaywall(false);
                    // Refresh to clear limit status
                    fetchQuestions();
                }}
            />
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
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    backButton: {
        padding: spacing.sm,
        marginRight: spacing.sm,
    },
    headerSpacer: {
        width: 40, // Match back button width for centering
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
    editLinkButton: {
        marginTop: spacing.md,
        paddingVertical: spacing.xs,
        paddingHorizontal: spacing.sm,
    },
    editLinkText: {
        ...typography.caption2,
        color: colors.premium.gold,
        textDecorationLine: 'underline',
        opacity: 0.8,
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
    // Daily limit screen styles
    dailyLimitOrbTop: {
        top: 80,
        right: -60,
    },
    dailyLimitOrbBottom: {
        bottom: 200,
        left: -80,
    },
    dailyLimitIconWrapper: {
        position: 'relative',
        marginBottom: spacing.xl,
    },
    dailyLimitIconGlow: {
        position: 'absolute',
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: 'rgba(212, 175, 55, 0.15)',
        top: -24,
        left: -24,
    },
    dailyLimitIconContainer: {
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: 'rgba(212, 175, 55, 0.1)',
        borderWidth: 1.5,
        borderColor: 'rgba(212, 175, 55, 0.3)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    dailyLimitLabel: {
        ...typography.caption2,
        fontWeight: '600',
        letterSpacing: 2,
        color: colors.premium.gold,
        textAlign: 'center',
        marginBottom: spacing.xs,
    },
    dailyLimitTitle: {
        ...typography.largeTitle,
        color: colors.text,
        textAlign: 'center',
    },
    countdownContainer: {
        alignItems: 'center',
        marginBottom: spacing.xl,
    },
    countdownLabel: {
        ...typography.caption2,
        letterSpacing: 1.5,
        color: colors.textTertiary,
        marginBottom: spacing.sm,
    },
    countdownBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(212, 175, 55, 0.1)',
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: 'rgba(212, 175, 55, 0.25)',
        gap: spacing.sm,
    },
    countdownText: {
        ...typography.title2,
        fontWeight: '700',
        color: colors.premium.gold,
        fontVariant: ['tabular-nums'],
        letterSpacing: 2,
    },
    dailyLimitDescription: {
        ...typography.body,
        color: colors.textSecondary,
        textAlign: 'center',
        marginBottom: spacing.lg,
        lineHeight: 24,
        paddingHorizontal: spacing.md,
    },
    premiumUpsellText: {
        ...typography.footnote,
        fontStyle: 'italic',
        color: colors.textTertiary,
        textAlign: 'center',
        marginBottom: spacing.md,
    },
    premiumButton: {
        position: 'relative',
        borderRadius: radius.lg,
        overflow: 'hidden',
        ...shadows.md,
    },
    premiumButtonGradient: {
        ...StyleSheet.absoluteFillObject,
    },
    premiumButtonContent: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.xl,
        gap: spacing.sm,
    },
    premiumButtonText: {
        ...typography.body,
        fontWeight: '600',
        color: '#000',
    },
});
