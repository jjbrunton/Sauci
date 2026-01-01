import { useState, useEffect } from "react";
import { View, Text, StyleSheet, Platform, useWindowDimensions } from "react-native";
import { Gesture, GestureDetector, TouchableOpacity } from "react-native-gesture-handler";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    withRepeat,
    withSequence,
    runOnJS,
    interpolate,
    Extrapolate,
    withTiming,
    interpolateColor,
    Easing,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { colors, gradients, radius, shadows, blur, typography, spacing, animations } from "../../theme";
import { QuestionFeedbackModal } from "../feedback";

// Haptics helper - not supported on web
const triggerHaptic = async (style: 'light' | 'medium' | 'heavy' = 'medium') => {
    if (Platform.OS === 'web') return;
    const Haptics = await import('expo-haptics');
    const feedbackStyle = style === 'light'
        ? Haptics.ImpactFeedbackStyle.Light
        : style === 'heavy'
            ? Haptics.ImpactFeedbackStyle.Heavy
            : Haptics.ImpactFeedbackStyle.Medium;
    await Haptics.impactAsync(feedbackStyle);
};

const MAX_CARD_WIDTH = 400;
const SWIPE_THRESHOLD = 100;

interface Props {
    question: { id: string; text: string; intensity: number; partner_text?: string | null; is_two_part?: boolean };
    onSwipe: (direction: "left" | "right" | "up" | "down") => void;
}

const AnimatedBlurView = Animated.createAnimatedComponent(BlurView);

export default function SwipeCard({ question, onSwipe }: Props) {
    const { width: screenWidth } = useWindowDimensions();
    const cardWidth = Math.min(screenWidth - 48, MAX_CARD_WIDTH);
    const [showFeedbackModal, setShowFeedbackModal] = useState(false);

    const translateX = useSharedValue(0);
    const translateY = useSharedValue(0);
    const rotation = useSharedValue(0);
    const scale = useSharedValue(1);
    const shadowExpand = useSharedValue(0);
    const idleBreathing = useSharedValue(0);
    const isGesturing = useSharedValue(false);

    const context = useSharedValue({ x: 0, y: 0 });

    // Subtle idle breathing animation
    useEffect(() => {
        idleBreathing.value = withRepeat(
            withSequence(
                withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.sin) }),
                withTiming(0, { duration: 2000, easing: Easing.inOut(Easing.sin) })
            ),
            -1,
            true
        );
    }, []);

    const gesture = Gesture.Pan()
        .activeOffsetX([-15, 15])
        .activeOffsetY([-15, 15])
        .onStart(() => {
            context.value = { x: translateX.value, y: translateY.value };
            scale.value = withTiming(1.02, { duration: animations.timing.fast });
            shadowExpand.value = withTiming(1, { duration: animations.timing.fast });
            isGesturing.value = true;
        })
        .onUpdate((event) => {
            translateX.value = event.translationX + context.value.x;
            translateY.value = event.translationY + context.value.y;
            rotation.value = interpolate(
                translateX.value,
                [-cardWidth / 2, cardWidth / 2],
                [-12, 12],
                Extrapolate.CLAMP
            );
        })
        .onEnd(() => {
            scale.value = withTiming(1, { duration: animations.timing.fast });
            shadowExpand.value = withTiming(0, { duration: animations.timing.fast });
            isGesturing.value = false;

            if (Math.abs(translateX.value) > SWIPE_THRESHOLD) {
                const direction = translateX.value > 0 ? "right" : "left";
                runOnJS(triggerHaptic)('medium');
                translateX.value = withSpring(
                    direction === "right" ? screenWidth * 1.5 : -screenWidth * 1.5,
                    animations.springGentle
                );
                runOnJS(onSwipe)(direction);
            } else if (translateY.value < -SWIPE_THRESHOLD) {
                runOnJS(triggerHaptic)('medium');
                translateY.value = withSpring(-screenWidth * 1.5, animations.springGentle);
                runOnJS(onSwipe)("up");
            } else if (translateY.value > SWIPE_THRESHOLD) {
                runOnJS(triggerHaptic)('light');
                translateY.value = withSpring(screenWidth * 1.5, animations.springGentle);
                runOnJS(onSwipe)("down");
            } else {
                translateX.value = withSpring(0, animations.spring);
                translateY.value = withSpring(0, animations.spring);
                rotation.value = withSpring(0, animations.spring);
            }
        });

    const animatedStyle = useAnimatedStyle(() => {
        // Apply idle breathing only when card is at rest
        const idleOffset = isGesturing.value ? 0 : interpolate(idleBreathing.value, [0, 1], [0, -6]);

        return {
            transform: [
                { translateX: translateX.value },
                { translateY: translateY.value + idleOffset },
                { rotate: `${rotation.value}deg` },
                { scale: scale.value },
            ],
        };
    });

    // Dynamic shadow for card lift effect
    const cardShadowStyle = useAnimatedStyle(() => ({
        shadowOpacity: interpolate(shadowExpand.value, [0, 1], [0.3, 0.5]),
        shadowRadius: interpolate(shadowExpand.value, [0, 1], [24, 36]),
        shadowOffset: {
            width: 0,
            height: interpolate(shadowExpand.value, [0, 1], [12, 18]),
        },
    }));

    const overlayStyle = (direction: "left" | "right" | "up" | "down") =>
        useAnimatedStyle(() => {
            let opacity = 0;
            let backgroundColor = 'transparent';

            if (direction === "right") {
                opacity = interpolate(translateX.value, [0, SWIPE_THRESHOLD], [0, 0.9]);
                backgroundColor = interpolateColor(
                    opacity,
                    [0, 0.9],
                    ['transparent', 'rgba(46, 204, 113, 0.4)']
                ) as string;
            } else if (direction === "left") {
                opacity = interpolate(translateX.value, [0, -SWIPE_THRESHOLD], [0, 0.9]);
                backgroundColor = interpolateColor(
                    opacity,
                    [0, 0.9],
                    ['transparent', 'rgba(231, 76, 60, 0.4)']
                ) as string;
            } else if (direction === "up") {
                opacity = interpolate(translateY.value, [0, -SWIPE_THRESHOLD], [0, 0.9]);
                backgroundColor = interpolateColor(
                    opacity,
                    [0, 0.9],
                    ['transparent', 'rgba(243, 156, 18, 0.4)']
                ) as string;
            } else {
                opacity = interpolate(translateY.value, [0, SWIPE_THRESHOLD], [0, 0.9]);
                backgroundColor = interpolateColor(
                    opacity,
                    [0, 0.9],
                    ['transparent', 'rgba(108, 117, 125, 0.4)']
                ) as string;
            }

            return {
                opacity,
                backgroundColor,
            };
        });

    const handleButtonPress = async (direction: "left" | "right" | "up") => {
        await triggerHaptic('light');
        onSwipe(direction);
    };

    const useBlur = Platform.OS === 'ios';

    const handleFeedbackPress = () => {
        setShowFeedbackModal(true);
    };

    return (
        <>
            <View style={[styles.cardWrapper, { width: cardWidth }]}>
                <GestureDetector gesture={gesture}>
                    <Animated.View style={[styles.cardOuter, animatedStyle, cardShadowStyle, { shadowColor: '#000' }]}>
                        {useBlur ? (
                            <BlurView
                                intensity={blur.medium}
                                tint="dark"
                                style={styles.blurContainer}
                            >
                                <CardContent
                                    question={question}
                                    overlayStyle={overlayStyle}
                                    handleButtonPress={handleButtonPress}
                                    onFeedbackPress={handleFeedbackPress}
                                    translateX={translateX}
                                    translateY={translateY}
                                />
                            </BlurView>
                        ) : (
                            <View style={styles.fallbackContainer}>
                                <CardContent
                                    question={question}
                                    overlayStyle={overlayStyle}
                                    handleButtonPress={handleButtonPress}
                                    onFeedbackPress={handleFeedbackPress}
                                    translateX={translateX}
                                    translateY={translateY}
                                />
                            </View>
                        )}
                        {/* Inner border highlight for depth */}
                        <View style={styles.innerBorder} pointerEvents="none" />
                    </Animated.View>
                </GestureDetector>
            </View>

            <QuestionFeedbackModal
                visible={showFeedbackModal}
                onClose={() => setShowFeedbackModal(false)}
                questionId={question.id}
                questionText={question.text}
            />
        </>
    );
}

function CardContent({
    question,
    overlayStyle,
    handleButtonPress,
    onFeedbackPress,
    translateX,
    translateY,
}: {
    question: Props['question'];
    overlayStyle: (direction: "left" | "right" | "up" | "down") => any;
    handleButtonPress: (direction: "left" | "right" | "up") => void;
    onFeedbackPress: () => void;
    translateX: Animated.SharedValue<number>;
    translateY: Animated.SharedValue<number>;
}) {
    const isHighIntensity = question.intensity >= 3;

    // Badge scale animation based on swipe progress
    const badgeScaleStyle = (direction: "left" | "right" | "up" | "down") =>
        useAnimatedStyle(() => {
            let progress = 0;
            if (direction === "right") {
                progress = interpolate(translateX.value, [0, SWIPE_THRESHOLD], [0, 1], Extrapolate.CLAMP);
            } else if (direction === "left") {
                progress = interpolate(translateX.value, [-SWIPE_THRESHOLD, 0], [1, 0], Extrapolate.CLAMP);
            } else if (direction === "up") {
                progress = interpolate(translateY.value, [-SWIPE_THRESHOLD, 0], [1, 0], Extrapolate.CLAMP);
            } else {
                progress = interpolate(translateY.value, [0, SWIPE_THRESHOLD], [0, 1], Extrapolate.CLAMP);
            }
            return {
                transform: [{ scale: interpolate(progress, [0, 0.5, 1], [0.8, 1, 1.1]) }],
            };
        });

    return (
        <>
            {/* Top highlight */}
            <LinearGradient
                colors={[colors.glass.highlight, 'transparent']}
                style={styles.highlight}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                pointerEvents="none"
            />

            {/* Left edge highlight */}
            <LinearGradient
                colors={['rgba(255,255,255,0.08)', 'transparent']}
                style={styles.edgeHighlightLeft}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                pointerEvents="none"
            />

            {/* Right edge highlight */}
            <LinearGradient
                colors={['transparent', 'rgba(255,255,255,0.08)']}
                style={styles.edgeHighlightRight}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                pointerEvents="none"
            />

            {/* Feedback Button */}
            <View style={styles.feedbackButton}>
                <Ionicons
                    name="flag-outline"
                    size={18}
                    color={colors.textTertiary}
                    onPress={onFeedbackPress}
                />
            </View>

            {/* Overlays with gradient badges */}
            <Animated.View style={[styles.overlay, overlayStyle("right")]} pointerEvents="none">
                <Animated.View style={[styles.overlayBadge, badgeScaleStyle("right")]}>
                    <LinearGradient
                        colors={gradients.success as [string, string]}
                        style={StyleSheet.absoluteFill}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                    />
                    <Text style={styles.overlayText}>YES</Text>
                </Animated.View>
            </Animated.View>
            <Animated.View style={[styles.overlay, overlayStyle("left")]} pointerEvents="none">
                <Animated.View style={[styles.overlayBadge, badgeScaleStyle("left")]}>
                    <LinearGradient
                        colors={gradients.error as [string, string]}
                        style={StyleSheet.absoluteFill}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                    />
                    <Text style={styles.overlayText}>NO</Text>
                </Animated.View>
            </Animated.View>
            <Animated.View style={[styles.overlay, overlayStyle("up")]} pointerEvents="none">
                <Animated.View style={[styles.overlayBadge, badgeScaleStyle("up")]}>
                    <LinearGradient
                        colors={gradients.warning as [string, string]}
                        style={StyleSheet.absoluteFill}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                    />
                    <Text style={styles.overlayText}>MAYBE</Text>
                </Animated.View>
            </Animated.View>
            <Animated.View style={[styles.overlay, overlayStyle("down")]} pointerEvents="none">
                <Animated.View style={[styles.overlayBadge, badgeScaleStyle("down")]}>
                    <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.textTertiary }]} />
                    <Text style={styles.overlayText}>SKIP</Text>
                </Animated.View>
            </Animated.View>

            {/* Content */}
            <View style={styles.content}>
                <View style={[
                    styles.intensityContainer,
                    isHighIntensity && styles.intensityContainerHigh
                ]}>
                    {[...Array(question.intensity)].map((_, i) => (
                        <Ionicons key={i} name="flame" size={16} color={colors.primary} />
                    ))}
                </View>
                <Text style={[styles.text, question.is_two_part && styles.twoPartText]}>
                    {question.text}
                </Text>
            </View>

            {/* Action Buttons */}
            <View style={styles.footer}>
                <View style={styles.buttonContainer}>
                    <ActionButton
                        onPress={() => handleButtonPress("left")}
                        colors={gradients.error as [string, string]}
                        icon="close"
                    />
                    <ActionButton
                        onPress={() => handleButtonPress("up")}
                        colors={gradients.warning as [string, string]}
                        icon="help"
                        small
                    />
                    <ActionButton
                        onPress={() => handleButtonPress("right")}
                        colors={gradients.success as [string, string]}
                        icon="heart"
                    />
                </View>
            </View>
        </>
    );
}

function ActionButton({
    onPress,
    colors: buttonColors,
    icon,
    small = false,
}: {
    onPress: () => void;
    colors: [string, string];
    icon: string;
    small?: boolean;
}) {
    const buttonScale = useSharedValue(1);
    const buttonGlow = useSharedValue(0);

    const handlePressIn = () => {
        buttonScale.value = withSpring(0.92, animations.spring);
        buttonGlow.value = withTiming(1, { duration: 150 });
    };

    const handlePressOut = () => {
        buttonScale.value = withSpring(1, animations.spring);
        buttonGlow.value = withTiming(0, { duration: 200 });
    };

    const buttonAnimatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: buttonScale.value }],
        shadowOpacity: interpolate(buttonGlow.value, [0, 1], [0.3, 0.6]),
        shadowRadius: interpolate(buttonGlow.value, [0, 1], [8, 16]),
    }));

    return (
        <TouchableOpacity
            onPress={onPress}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            activeOpacity={1}
        >
            <Animated.View style={[
                styles.actionButton,
                small && styles.actionButtonSmall,
                buttonAnimatedStyle,
                { shadowColor: buttonColors[0] }
            ]}>
                <LinearGradient
                    colors={buttonColors}
                    style={StyleSheet.absoluteFill}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                />
                <LinearGradient
                    colors={['rgba(255,255,255,0.25)', 'rgba(255,255,255,0.05)']}
                    style={styles.buttonHighlight}
                    start={{ x: 0.5, y: 0 }}
                    end={{ x: 0.5, y: 1 }}
                />
                <Ionicons
                    name={icon as any}
                    size={small ? 20 : 28}
                    color={colors.text}
                    style={styles.buttonIcon}
                />
            </Animated.View>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    cardWrapper: {
        position: "absolute",
        maxWidth: MAX_CARD_WIDTH,
        height: 480,
    },
    cardOuter: {
        width: "100%",
        height: "100%",
        borderRadius: radius.xxl,
        overflow: "hidden",
    },
    blurContainer: {
        flex: 1,
        backgroundColor: colors.glass.background,
        borderWidth: 1,
        borderColor: colors.glass.border,
        borderRadius: radius.xxl,
        overflow: "hidden",
    },
    fallbackContainer: {
        flex: 1,
        backgroundColor: colors.glass.backgroundLight,
        borderWidth: 1,
        borderColor: colors.glass.border,
        borderRadius: radius.xxl,
        overflow: "hidden",
    },
    highlight: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 80,
    },
    edgeHighlightLeft: {
        position: 'absolute',
        top: 0,
        left: 0,
        bottom: 0,
        width: 60,
    },
    edgeHighlightRight: {
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        width: 60,
    },
    innerBorder: {
        position: 'absolute',
        top: 2,
        left: 2,
        right: 2,
        bottom: 2,
        borderRadius: radius.xxl - 2,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.06)',
    },
    feedbackButton: {
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
        elevation: 10,
        borderWidth: 1,
        borderColor: colors.glass.border,
    },
    content: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        padding: spacing.xl,
    },
    intensityContainer: {
        flexDirection: "row",
        marginBottom: spacing.lg,
        backgroundColor: colors.primaryLight,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: radius.full,
        gap: 2,
    },
    intensityContainerHigh: {
        borderWidth: 1,
        borderColor: colors.primary,
        ...shadows.glow(colors.primaryGlow),
    },
    text: {
        ...typography.title2,
        color: colors.text,
        textAlign: "center",
        lineHeight: 32,
    },
    twoPartText: {
        ...typography.title3,
        lineHeight: 28,
    },
    footer: {
        paddingBottom: spacing.lg,
        paddingHorizontal: spacing.lg,
    },
    overlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: "center",
        alignItems: "center",
        zIndex: 10,
        borderRadius: radius.xxl,
    },
    overlayBadge: {
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.sm,
        borderRadius: radius.md,
        transform: [{ rotate: "-15deg" }],
        overflow: 'hidden',
    },
    overlayText: {
        fontSize: 36,
        fontWeight: "900",
        color: colors.text,
        letterSpacing: 2,
    },
    buttonContainer: {
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "center",
        gap: spacing.md,
    },
    actionButton: {
        width: 64,
        height: 64,
        borderRadius: 32,
        justifyContent: "center",
        alignItems: "center",
        overflow: "hidden",
    },
    actionButtonSmall: {
        width: 52,
        height: 52,
        borderRadius: 26,
    },
    buttonHighlight: {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        height: "50%",
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
    },
    buttonIcon: {
        zIndex: 1,
    },
});
