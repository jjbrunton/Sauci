import { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, useWindowDimensions, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withTiming,
    withRepeat,
    withSequence,
    withDelay,
    withSpring,
    FadeIn,
    FadeOut,
    interpolate,
    Easing,
    runOnJS,
} from "react-native-reanimated";
import { colors, gradients, radius, shadows, blur, typography, spacing, animations } from "../theme";

interface Props {
    onComplete: () => void;
}

interface TutorialStep {
    key: string;
    label: string;
    description: string;
    icon: string;
    color: string;
    gradient: [string, string];
    translateX: number;
    translateY: number;
    isSwipe: boolean;
}

const STEPS: TutorialStep[] = [
    {
        key: "right",
        label: "YES",
        description: "Swipe right if you're interested",
        icon: "heart",
        color: colors.success,
        gradient: gradients.success as [string, string],
        translateX: 80,
        translateY: 0,
        isSwipe: true,
    },
    {
        key: "left",
        label: "NO",
        description: "Swipe left if you're not interested",
        icon: "close",
        color: colors.error,
        gradient: gradients.error as [string, string],
        translateX: -80,
        translateY: 0,
        isSwipe: true,
    },
    {
        key: "up",
        label: "MAYBE",
        description: "Swipe up if you're unsure",
        icon: "help",
        color: colors.warning,
        gradient: gradients.warning as [string, string],
        translateX: 0,
        translateY: -80,
        isSwipe: true,
    },
    {
        key: "down",
        label: "SKIP",
        description: "Swipe down to skip for now",
        icon: "arrow-down",
        color: colors.textTertiary,
        gradient: ["#6c757d", "#495057"],
        translateX: 0,
        translateY: 80,
        isSwipe: true,
    },
    {
        key: "feedback",
        label: "FEEDBACK",
        description: "Tap the flag to report issues with a question",
        icon: "flag-outline",
        color: colors.primary,
        gradient: gradients.primary as [string, string],
        translateX: 0,
        translateY: 0,
        isSwipe: false,
    },
];

export default function SwipeTutorial({ onComplete }: Props) {
    const { width: screenWidth, height: screenHeight } = useWindowDimensions();
    const insets = useSafeAreaInsets();
    const [currentStep, setCurrentStep] = useState(0);

    const cardTranslateX = useSharedValue(0);
    const cardTranslateY = useSharedValue(0);
    const cardRotation = useSharedValue(0);
    const cardScale = useSharedValue(1);
    const overlayOpacity = useSharedValue(0);
    const pulseScale = useSharedValue(1);
    const handOffset = useSharedValue(0);

    const currentStep_ = STEPS[currentStep];
    const isSwipeStep = currentStep_.isSwipe;

    useEffect(() => {
        // Reset animations for current step
        cardTranslateX.value = 0;
        cardTranslateY.value = 0;
        cardRotation.value = 0;
        overlayOpacity.value = 0;
        handOffset.value = 0;

        // Start the swipe demonstration animation
        const animateSwipe = () => {
            if (!isSwipeStep) {
                // For non-swipe steps (feedback), just pulse the card
                cardScale.value = withRepeat(
                    withSequence(
                        withTiming(1.02, { duration: 600 }),
                        withTiming(1, { duration: 600 })
                    ),
                    -1,
                    true
                );
                return;
            }

            // Pulse the card first
            cardScale.value = withSequence(
                withTiming(1.02, { duration: 200 }),
                withTiming(1, { duration: 200 })
            );

            // Animate hand movement
            handOffset.value = withRepeat(
                withSequence(
                    withTiming(1, { duration: 800, easing: Easing.out(Easing.cubic) }),
                    withDelay(300, withTiming(0, { duration: 400 }))
                ),
                -1,
                false
            );

            // Animate card swipe
            cardTranslateX.value = withRepeat(
                withSequence(
                    withDelay(200, withTiming(currentStep_.translateX * 0.7, {
                        duration: 600,
                        easing: Easing.out(Easing.cubic)
                    })),
                    withDelay(400, withSpring(0, animations.spring))
                ),
                -1,
                false
            );

            cardTranslateY.value = withRepeat(
                withSequence(
                    withDelay(200, withTiming(currentStep_.translateY * 0.7, {
                        duration: 600,
                        easing: Easing.out(Easing.cubic)
                    })),
                    withDelay(400, withSpring(0, animations.spring))
                ),
                -1,
                false
            );

            // Rotate card for horizontal swipes
            if (currentStep_.translateX !== 0) {
                cardRotation.value = withRepeat(
                    withSequence(
                        withDelay(200, withTiming(currentStep_.translateX > 0 ? 8 : -8, {
                            duration: 600
                        })),
                        withDelay(400, withSpring(0, animations.spring))
                    ),
                    -1,
                    false
                );
            }

            // Show overlay during swipe
            overlayOpacity.value = withRepeat(
                withSequence(
                    withDelay(400, withTiming(0.8, { duration: 400 })),
                    withDelay(200, withTiming(0, { duration: 400 }))
                ),
                -1,
                false
            );
        };

        // Pulse animation for the indicator
        pulseScale.value = withRepeat(
            withSequence(
                withTiming(1.2, { duration: 800 }),
                withTiming(1, { duration: 800 })
            ),
            -1,
            true
        );

        const timeout = setTimeout(animateSwipe, 300);
        return () => clearTimeout(timeout);
    }, [currentStep]);

    const handleNext = () => {
        if (currentStep < STEPS.length - 1) {
            setCurrentStep(currentStep + 1);
        } else {
            onComplete();
        }
    };

    const handleSkip = () => {
        onComplete();
    };

    const cardAnimatedStyle = useAnimatedStyle(() => ({
        transform: [
            { translateX: cardTranslateX.value },
            { translateY: cardTranslateY.value },
            { rotate: `${cardRotation.value}deg` },
            { scale: cardScale.value },
        ],
    }));

    const overlayAnimatedStyle = useAnimatedStyle(() => ({
        opacity: overlayOpacity.value,
    }));

    const pulseAnimatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: pulseScale.value }],
        opacity: interpolate(pulseScale.value, [1, 1.2], [0.6, 0.2]),
    }));

    const handAnimatedStyle = useAnimatedStyle(() => {
        const progress = handOffset.value;
        return {
            transform: [
                { translateX: currentStep_.translateX * progress * 0.5 },
                { translateY: currentStep_.translateY * progress * 0.5 },
            ],
            opacity: interpolate(progress, [0, 0.2, 0.8, 1], [0, 1, 1, 0]),
        };
    });

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

                    {/* Title */}
                    <Animated.View entering={FadeIn.delay(100).duration(400)}>
                        <Text style={styles.title}>How to Play</Text>
                        <Text style={styles.subtitle}>
                            Swipe to answer questions and find your matches
                        </Text>
                    </Animated.View>

                    {/* Demo Card Area */}
                    <View style={styles.demoArea}>
                        {/* Direction indicators around the card - only for swipe steps */}
                        {isSwipeStep && (
                            <View style={styles.indicatorsContainer}>
                                {STEPS.filter(s => s.isSwipe).map((dir, index) => (
                                    <View
                                        key={dir.key}
                                        style={[
                                            styles.directionIndicator,
                                            dir.key === "right" && styles.indicatorRight,
                                            dir.key === "left" && styles.indicatorLeft,
                                            dir.key === "up" && styles.indicatorUp,
                                            dir.key === "down" && styles.indicatorDown,
                                        ]}
                                    >
                                        {index === currentStep && (
                                            <Animated.View style={[styles.pulseRing, pulseAnimatedStyle]}>
                                                <View style={[styles.pulseInner, { backgroundColor: dir.color }]} />
                                            </Animated.View>
                                        )}
                                        <LinearGradient
                                            colors={index === currentStep ? dir.gradient : ['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.05)'] as [string, string]}
                                            style={[
                                                styles.indicatorBadge,
                                                index === currentStep && styles.indicatorActive,
                                            ]}
                                        >
                                            <Ionicons
                                                name={dir.icon as any}
                                                size={20}
                                                color={index === currentStep ? colors.text : colors.textTertiary}
                                            />
                                        </LinearGradient>
                                    </View>
                                ))}
                            </View>
                        )}

                        {/* Demo Card */}
                        <Animated.View style={[styles.demoCard, cardAnimatedStyle, shadows.xl]}>
                            <LinearGradient
                                colors={[colors.glass.backgroundLight, colors.glass.background]}
                                style={styles.demoCardInner}
                            >
                                {/* Feedback button indicator */}
                                <View style={[
                                    styles.feedbackButtonDemo,
                                    !isSwipeStep && styles.feedbackButtonHighlight
                                ]}>
                                    {!isSwipeStep && (
                                        <Animated.View style={[styles.feedbackPulse, pulseAnimatedStyle]}>
                                            <View style={[styles.pulseInner, { backgroundColor: currentStep_.color }]} />
                                        </Animated.View>
                                    )}
                                    <Ionicons name="flag-outline" size={18} color={!isSwipeStep ? colors.text : colors.textTertiary} />
                                </View>

                                {/* Overlay - only for swipe steps */}
                                {isSwipeStep && (
                                    <Animated.View
                                        style={[
                                            styles.demoOverlay,
                                            overlayAnimatedStyle,
                                            { backgroundColor: `${currentStep_.color}40` }
                                        ]}
                                    >
                                        <View style={[styles.overlayBadge, { backgroundColor: currentStep_.color }]}>
                                            <Text style={styles.overlayText}>{currentStep_.label}</Text>
                                        </View>
                                    </Animated.View>
                                )}

                                {/* Card content */}
                                <View style={styles.demoCardContent}>
                                    <View style={styles.intensityDemo}>
                                        <Ionicons name="flame" size={14} color={colors.primary} />
                                        <Ionicons name="flame" size={14} color={colors.primary} />
                                    </View>
                                    <Text style={styles.demoQuestion}>
                                        Would you try a new restaurant together?
                                    </Text>
                                </View>
                            </LinearGradient>

                            {/* Hand gesture indicator - only for swipe steps */}
                            {isSwipeStep && (
                                <Animated.View style={[styles.handIndicator, handAnimatedStyle]}>
                                    <View style={styles.handCircle}>
                                        <Ionicons name="hand-left" size={24} color={colors.text} />
                                    </View>
                                </Animated.View>
                            )}
                        </Animated.View>
                    </View>

                    {/* Current instruction */}
                    <Animated.View
                        key={currentStep}
                        entering={FadeIn.duration(300)}
                        style={styles.instructionContainer}
                    >
                        <LinearGradient
                            colors={currentStep_.gradient}
                            style={styles.instructionBadge}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                        >
                            <Ionicons name={currentStep_.icon as any} size={24} color={colors.text} />
                            <Text style={styles.instructionLabel}>{currentStep_.label}</Text>
                        </LinearGradient>
                        <Text style={styles.instructionText}>{currentStep_.description}</Text>
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
    title: {
        ...typography.title1,
        color: colors.text,
        textAlign: "center",
        marginBottom: spacing.sm,
    },
    subtitle: {
        ...typography.body,
        color: colors.textSecondary,
        textAlign: "center",
        marginBottom: spacing.xl,
    },
    demoArea: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        width: "100%",
        maxHeight: 350,
    },
    indicatorsContainer: {
        position: "absolute",
        width: 280,
        height: 280,
    },
    directionIndicator: {
        position: "absolute",
        alignItems: "center",
        justifyContent: "center",
    },
    indicatorRight: {
        right: -20,
        top: "50%",
        marginTop: -24,
    },
    indicatorLeft: {
        left: -20,
        top: "50%",
        marginTop: -24,
    },
    indicatorUp: {
        top: -20,
        left: "50%",
        marginLeft: -24,
    },
    indicatorDown: {
        bottom: -20,
        left: "50%",
        marginLeft: -24,
    },
    pulseRing: {
        position: "absolute",
        width: 64,
        height: 64,
        borderRadius: 32,
        justifyContent: "center",
        alignItems: "center",
    },
    pulseInner: {
        width: "100%",
        height: "100%",
        borderRadius: 32,
    },
    indicatorBadge: {
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: "center",
        alignItems: "center",
        borderWidth: 1,
        borderColor: colors.glass.border,
    },
    indicatorActive: {
        borderColor: "transparent",
    },
    demoCard: {
        width: 220,
        height: 280,
        borderRadius: radius.xl,
        overflow: "visible",
    },
    demoCardInner: {
        flex: 1,
        borderRadius: radius.xl,
        borderWidth: 1,
        borderColor: colors.glass.border,
        overflow: "hidden",
    },
    feedbackButtonDemo: {
        position: 'absolute',
        top: spacing.md,
        right: spacing.md,
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: colors.glass.background,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 100,
        borderWidth: 1,
        borderColor: colors.glass.border,
    },
    feedbackButtonHighlight: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    feedbackPulse: {
        position: "absolute",
        width: 56,
        height: 56,
        borderRadius: 28,
        justifyContent: "center",
        alignItems: "center",
    },
    demoOverlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: "center",
        alignItems: "center",
        zIndex: 10,
        borderRadius: radius.xl,
    },
    overlayBadge: {
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
        borderRadius: radius.sm,
        transform: [{ rotate: "-15deg" }],
    },
    overlayText: {
        fontSize: 24,
        fontWeight: "900",
        color: colors.text,
        letterSpacing: 2,
    },
    demoCardContent: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        padding: spacing.lg,
    },
    intensityDemo: {
        flexDirection: "row",
        backgroundColor: colors.primaryLight,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
        borderRadius: radius.full,
        gap: 2,
        marginBottom: spacing.md,
    },
    demoQuestion: {
        ...typography.headline,
        color: colors.text,
        textAlign: "center",
    },
    handIndicator: {
        position: "absolute",
        bottom: 40,
        left: "50%",
        marginLeft: -20,
    },
    handCircle: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: colors.primary,
        justifyContent: "center",
        alignItems: "center",
        ...shadows.md,
    },
    instructionContainer: {
        alignItems: "center",
        marginTop: spacing.xl,
        marginBottom: spacing.lg,
    },
    instructionBadge: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.sm,
        borderRadius: radius.full,
        gap: spacing.sm,
        marginBottom: spacing.md,
    },
    instructionLabel: {
        ...typography.headline,
        color: colors.text,
        fontWeight: "700",
    },
    instructionText: {
        ...typography.body,
        color: colors.textSecondary,
        textAlign: "center",
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
