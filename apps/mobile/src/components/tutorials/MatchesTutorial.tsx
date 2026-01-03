import { useState, useEffect } from "react";
import { View, Text, StyleSheet, Pressable, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withRepeat,
    withSequence,
    withTiming,
    withDelay,
    FadeIn,
    FadeOut,
    interpolate,
} from "react-native-reanimated";
import { colors, gradients, radius, shadows, blur, typography, spacing } from "../../theme";
import { Events } from "../../lib/analytics";

interface Props {
    onComplete: () => void;
}

interface TutorialStep {
    key: string;
    title: string;
    description: string;
    icon: keyof typeof Ionicons.glyphMap;
    gradient: [string, string];
}

const STEPS: TutorialStep[] = [
    {
        key: "match",
        title: "You've Got a Match!",
        description: "When both you and your partner swipe YES or MAYBE on the same question, it creates a match. This means you're both interested!",
        icon: "heart",
        gradient: gradients.primary as [string, string],
    },
    {
        key: "chat",
        title: "Start a Private Chat",
        description: "Tap any match to open a private conversation. Discuss, plan, and explore your shared interests together.",
        icon: "chatbubbles",
        gradient: gradients.success as [string, string],
    },
    {
        key: "photos",
        title: "Share Pictures Privately",
        description: "Send photos that only your partner can see. Your intimate moments stay between the two of you, safe and private.",
        icon: "images",
        gradient: gradients.premiumRose as [string, string],
    },
    {
        key: "edit",
        title: "Change Your Mind?",
        description: "Go to My Answers to review and edit any of your responses. Changed your mind? No problem — update your answer anytime.",
        icon: "create-outline",
        gradient: gradients.premiumGold as [string, string],
    },
];

export default function MatchesTutorial({ onComplete }: Props) {
    const insets = useSafeAreaInsets();
    const [currentStep, setCurrentStep] = useState(0);

    const pulseScale = useSharedValue(1);
    const iconBounce = useSharedValue(0);

    const currentStepData = STEPS[currentStep];

    // Track tutorial started on mount
    useEffect(() => {
        Events.tutorialStarted("matches");
        Events.tutorialStepViewed("matches", 0, STEPS[0].key);
    }, []);

    // Track step changes
    useEffect(() => {
        if (currentStep > 0) {
            Events.tutorialStepViewed("matches", currentStep, STEPS[currentStep].key);
        }
    }, [currentStep]);

    // Start animations
    pulseScale.value = withRepeat(
        withSequence(
            withTiming(1.15, { duration: 800 }),
            withTiming(1, { duration: 800 })
        ),
        -1,
        true
    );

    iconBounce.value = withRepeat(
        withSequence(
            withDelay(200, withTiming(-8, { duration: 400 })),
            withTiming(0, { duration: 400 })
        ),
        -1,
        false
    );

    const handleNext = () => {
        if (currentStep < STEPS.length - 1) {
            setCurrentStep(currentStep + 1);
        } else {
            Events.tutorialCompleted("matches");
            onComplete();
        }
    };

    const handleSkip = () => {
        Events.tutorialSkipped("matches", currentStep);
        onComplete();
    };

    const pulseAnimatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: pulseScale.value }],
        opacity: interpolate(pulseScale.value, [1, 1.15], [0.6, 0.2]),
    }));

    const iconAnimatedStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: iconBounce.value }],
    }));

    return (
        <Animated.View
            entering={FadeIn.duration(300)}
            exiting={FadeOut.duration(200)}
            style={styles.container}
        >
            <BlurView intensity={blur.heavy} tint="dark" style={styles.blur}>
                <View style={[styles.content, { paddingBottom: Math.max(40, insets.bottom + (Platform.OS === 'ios' ? 100 : 80)) }]}>
                    {/* Skip button */}
                    <Pressable style={styles.skipButton} onPress={handleSkip}>
                        <Text style={styles.skipText}>Skip</Text>
                    </Pressable>

                    {/* Central illustration area */}
                    <View style={styles.illustrationArea}>
                        <Animated.View
                            key={currentStep}
                            entering={FadeIn.duration(400)}
                        >
                            {/* Pulse ring behind icon */}
                            <View style={styles.iconWrapper}>
                                <Animated.View style={[styles.pulseRing, pulseAnimatedStyle]}>
                                    <LinearGradient
                                        colors={currentStepData.gradient}
                                        style={styles.pulseGradient}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 1 }}
                                    />
                                </Animated.View>

                                {/* Main icon container */}
                                <Animated.View style={iconAnimatedStyle}>
                                    <LinearGradient
                                        colors={currentStepData.gradient}
                                        style={styles.iconContainer}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 1 }}
                                    >
                                        <Ionicons
                                            name={currentStepData.icon}
                                            size={56}
                                            color={colors.text}
                                        />
                                    </LinearGradient>
                                </Animated.View>
                            </View>

                            {/* Match type badges - show on first step */}
                            {currentStep === 0 && (
                                <View style={styles.badgesContainer}>
                                    <View style={styles.badgeRow}>
                                        <LinearGradient
                                            colors={gradients.primary as [string, string]}
                                            style={styles.matchBadge}
                                            start={{ x: 0, y: 0 }}
                                            end={{ x: 1, y: 0 }}
                                        >
                                            <Ionicons name="heart" size={16} color={colors.text} />
                                            <Text style={styles.badgeText}>YES + YES</Text>
                                        </LinearGradient>
                                        <View style={styles.badgeConnector} />
                                        <View style={[styles.matchBadge, styles.maybeBadge]}>
                                            <Ionicons name="heart-half" size={16} color={colors.primary} />
                                            <Text style={[styles.badgeText, styles.maybeBadgeText]}>YES + MAYBE</Text>
                                        </View>
                                    </View>
                                </View>
                            )}

                            {/* Chat demo - show on second step */}
                            {currentStep === 1 && (
                                <View style={styles.chatDemo}>
                                    <View style={styles.chatBubbleLeft}>
                                        <Text style={styles.chatBubbleText}>I'd love to try this!</Text>
                                    </View>
                                    <View style={styles.chatBubbleRight}>
                                        <Text style={styles.chatBubbleText}>Me too! When?</Text>
                                    </View>
                                </View>
                            )}

                            {/* Photos demo - show on third step */}
                            {currentStep === 2 && (
                                <View style={styles.photosDemo}>
                                    <View style={styles.photoRow}>
                                        <View style={styles.photoPlaceholder}>
                                            <Ionicons name="image" size={24} color={colors.textSecondary} />
                                        </View>
                                        <View style={styles.photoPlaceholder}>
                                            <Ionicons name="image" size={24} color={colors.textSecondary} />
                                        </View>
                                    </View>
                                    <View style={styles.privacyBadge}>
                                        <Ionicons name="lock-closed" size={14} color={colors.success} />
                                        <Text style={styles.privacyBadgeText}>Private & Secure</Text>
                                    </View>
                                </View>
                            )}

                            {/* Edit answers demo - show on fourth step */}
                            {currentStep === 3 && (
                                <View style={styles.editDemo}>
                                    <View style={styles.answerCard}>
                                        <View style={styles.answerCardContent}>
                                            <Text style={styles.answerCardQuestion} numberOfLines={1}>
                                                "Try something new together"
                                            </Text>
                                            <View style={styles.answerCardBadge}>
                                                <Ionicons name="checkmark" size={12} color={colors.text} />
                                                <Text style={styles.answerCardBadgeText}>YES</Text>
                                            </View>
                                        </View>
                                        <View style={styles.answerCardEdit}>
                                            <Ionicons name="create-outline" size={18} color={colors.premium.gold} />
                                        </View>
                                    </View>
                                    <View style={styles.answerArrow}>
                                        <Ionicons name="arrow-down" size={20} color={colors.textTertiary} />
                                    </View>
                                    <View style={[styles.answerCard, styles.answerCardUpdated]}>
                                        <View style={styles.answerCardContent}>
                                            <Text style={styles.answerCardQuestion} numberOfLines={1}>
                                                "Try something new together"
                                            </Text>
                                            <View style={[styles.answerCardBadge, styles.answerCardBadgeMaybe]}>
                                                <Ionicons name="help" size={12} color={colors.warning} />
                                                <Text style={[styles.answerCardBadgeText, styles.answerCardBadgeTextMaybe]}>MAYBE</Text>
                                            </View>
                                        </View>
                                    </View>
                                </View>
                            )}
                        </Animated.View>
                    </View>

                    {/* Text content */}
                    <Animated.View
                        key={`text-${currentStep}`}
                        entering={FadeIn.delay(100).duration(300)}
                        style={styles.textContainer}
                    >
                        <Text style={styles.title}>{currentStepData.title}</Text>
                        <Text style={styles.description}>{currentStepData.description}</Text>
                    </Animated.View>

                    {/* Progress dots */}
                    <View style={styles.dotsContainer}>
                        {STEPS.map((_, index) => (
                            <View
                                key={index}
                                style={[
                                    styles.dot,
                                    index === currentStep && styles.dotActive,
                                    index < currentStep && styles.dotCompleted,
                                ]}
                            />
                        ))}
                    </View>

                    {/* Next button */}
                    <Pressable onPress={handleNext} style={({ pressed }) => [
                        styles.nextButton,
                        pressed && styles.nextButtonPressed
                    ]}>
                        <LinearGradient
                            colors={gradients.primary as [string, string]}
                            style={styles.nextButtonGradient}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                        >
                            <Text style={styles.nextButtonText}>
                                {currentStep < STEPS.length - 1 ? "Next" : "Got it!"}
                            </Text>
                            <Ionicons
                                name={currentStep < STEPS.length - 1 ? "arrow-forward" : "checkmark"}
                                size={20}
                                color={colors.text}
                            />
                        </LinearGradient>
                    </Pressable>
                </View>
            </BlurView>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 1000,
    },
    blur: {
        flex: 1,
        backgroundColor: 'rgba(13, 13, 26, 0.85)',
    },
    content: {
        flex: 1,
        paddingHorizontal: spacing.lg,
        paddingTop: 80,
        alignItems: "center",
    },
    skipButton: {
        position: "absolute",
        top: 60,
        right: spacing.lg,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
    },
    skipText: {
        ...typography.callout,
        color: colors.textSecondary,
    },
    illustrationArea: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        width: "100%",
        maxHeight: 350,
    },
    iconWrapper: {
        alignItems: "center",
        justifyContent: "center",
        marginBottom: spacing.xl,
    },
    pulseRing: {
        position: "absolute",
        width: 160,
        height: 160,
        borderRadius: 80,
        overflow: "hidden",
    },
    pulseGradient: {
        width: "100%",
        height: "100%",
    },
    iconContainer: {
        width: 120,
        height: 120,
        borderRadius: 60,
        justifyContent: "center",
        alignItems: "center",
        ...shadows.xl,
    },
    badgesContainer: {
        marginTop: spacing.lg,
    },
    badgeRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
    },
    matchBadge: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: radius.full,
        gap: spacing.xs,
    },
    maybeBadge: {
        backgroundColor: colors.glass.background,
        borderWidth: 1,
        borderColor: colors.glass.border,
    },
    badgeText: {
        ...typography.caption1,
        color: colors.text,
        fontWeight: "700",
        letterSpacing: 0.5,
    },
    maybeBadgeText: {
        color: colors.primary,
    },
    badgeConnector: {
        width: 20,
        height: 2,
        backgroundColor: colors.glass.border,
    },
    chatDemo: {
        marginTop: spacing.lg,
        gap: spacing.sm,
        width: "100%",
        maxWidth: 280,
    },
    chatBubbleLeft: {
        alignSelf: "flex-start",
        backgroundColor: colors.glass.background,
        borderWidth: 1,
        borderColor: colors.glass.border,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: radius.lg,
        borderBottomLeftRadius: radius.xs,
    },
    chatBubbleRight: {
        alignSelf: "flex-end",
        backgroundColor: colors.primaryLight,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: radius.lg,
        borderBottomRightRadius: radius.xs,
    },
    chatBubbleText: {
        ...typography.callout,
        color: colors.text,
    },
    photosDemo: {
        marginTop: spacing.lg,
        alignItems: "center",
        gap: spacing.md,
    },
    photoRow: {
        flexDirection: "row",
        gap: spacing.sm,
    },
    photoPlaceholder: {
        width: 80,
        height: 80,
        borderRadius: radius.md,
        backgroundColor: colors.glass.background,
        borderWidth: 1,
        borderColor: colors.glass.border,
        justifyContent: "center",
        alignItems: "center",
    },
    privacyBadge: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.xs,
        backgroundColor: colors.glass.background,
        borderWidth: 1,
        borderColor: colors.success,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: radius.full,
    },
    privacyBadgeText: {
        ...typography.caption1,
        color: colors.success,
        fontWeight: "600",
    },
    editDemo: {
        marginTop: spacing.lg,
        alignItems: "center",
        gap: spacing.xs,
    },
    answerCard: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: colors.glass.background,
        borderWidth: 1,
        borderColor: colors.glass.border,
        borderRadius: radius.md,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        width: 260,
    },
    answerCardUpdated: {
        borderColor: colors.premium.gold,
        backgroundColor: "rgba(212, 175, 55, 0.08)",
    },
    answerCardContent: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: spacing.sm,
    },
    answerCardQuestion: {
        ...typography.footnote,
        color: colors.text,
        fontStyle: "italic",
        flex: 1,
    },
    answerCardBadge: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: colors.success,
        paddingHorizontal: spacing.sm,
        paddingVertical: 2,
        borderRadius: radius.full,
        gap: 2,
    },
    answerCardBadgeMaybe: {
        backgroundColor: "rgba(243, 156, 18, 0.2)",
        borderWidth: 1,
        borderColor: colors.warning,
    },
    answerCardBadgeText: {
        ...typography.caption2,
        fontWeight: "700",
        color: colors.text,
    },
    answerCardBadgeTextMaybe: {
        color: colors.warning,
    },
    answerCardEdit: {
        marginLeft: spacing.sm,
        padding: spacing.xs,
    },
    answerArrow: {
        padding: spacing.xs,
    },
    textContainer: {
        alignItems: "center",
        marginBottom: spacing.xl,
        paddingHorizontal: spacing.md,
    },
    title: {
        ...typography.title1,
        color: colors.text,
        textAlign: "center",
        marginBottom: spacing.sm,
    },
    description: {
        ...typography.body,
        color: colors.textSecondary,
        textAlign: "center",
        lineHeight: 24,
    },
    dotsContainer: {
        flexDirection: "row",
        gap: spacing.sm,
        marginBottom: spacing.xl,
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: colors.glass.border,
    },
    dotActive: {
        backgroundColor: colors.primary,
        width: 24,
    },
    dotCompleted: {
        backgroundColor: colors.primary,
    },
    nextButton: {
        width: "100%",
        maxWidth: 280,
        borderRadius: radius.lg,
        overflow: "hidden",
    },
    nextButtonPressed: {
        opacity: 0.9,
        transform: [{ scale: 0.98 }],
    },
    nextButtonGradient: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: spacing.md,
        gap: spacing.sm,
    },
    nextButtonText: {
        ...typography.headline,
        color: colors.text,
    },
});
