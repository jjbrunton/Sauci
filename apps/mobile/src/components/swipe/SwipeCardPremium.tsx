/**
 * SwipeCardPremium - PoC of premium/boutique styling for the swipe experience
 *
 * Inspired by the "Coming Soon" Ann Summers aesthetic
 */
import { useState, useEffect } from "react";
import { View, Text, StyleSheet, Platform, useWindowDimensions, Pressable } from "react-native";
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
    FadeIn,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { colors, gradients, featureColors, radius, shadows, blur, typography, spacing, animations } from "../../theme";

// Use feature colors for consistency
const { accent: ACCENT } = featureColors.dares;
const { accent: ROSE } = featureColors.quiz;

// RGBA helpers for custom opacity levels (derived from theme colors)
// Gold: #D4AF37 = rgb(212, 175, 55)
// Rose: #E8A4AE = rgb(232, 164, 174)
const rgba = {
    gold: (opacity: number) => `rgba(212, 175, 55, ${opacity})`,
    rose: (opacity: number) => `rgba(232, 164, 174, ${opacity})`,
};

// Haptics helper
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

export default function SwipeCardPremium({ question, onSwipe }: Props) {
    const { width: screenWidth } = useWindowDimensions();
    const cardWidth = Math.min(screenWidth - 48, MAX_CARD_WIDTH);

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
                withTiming(1, { duration: 3000, easing: Easing.inOut(Easing.sin) }),
                withTiming(0, { duration: 3000, easing: Easing.inOut(Easing.sin) })
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
                [-8, 8], // Reduced rotation for elegance
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
        const idleOffset = isGesturing.value ? 0 : interpolate(idleBreathing.value, [0, 1], [0, -4]);
        return {
            transform: [
                { translateX: translateX.value },
                { translateY: translateY.value + idleOffset },
                { rotate: `${rotation.value}deg` },
                { scale: scale.value },
            ],
        };
    });

    const cardShadowStyle = useAnimatedStyle(() => ({
        shadowOpacity: interpolate(shadowExpand.value, [0, 1], [0.2, 0.4]),
        shadowRadius: interpolate(shadowExpand.value, [0, 1], [20, 32]),
        shadowOffset: {
            width: 0,
            height: interpolate(shadowExpand.value, [0, 1], [10, 16]),
        },
    }));

    const overlayStyle = (direction: "left" | "right" | "up" | "down") =>
        useAnimatedStyle(() => {
            let opacity = 0;
            if (direction === "right") {
                opacity = interpolate(translateX.value, [0, SWIPE_THRESHOLD], [0, 1]);
            } else if (direction === "left") {
                opacity = interpolate(translateX.value, [0, -SWIPE_THRESHOLD], [0, 1]);
            } else if (direction === "up") {
                opacity = interpolate(translateY.value, [0, -SWIPE_THRESHOLD], [0, 1]);
            } else {
                opacity = interpolate(translateY.value, [0, SWIPE_THRESHOLD], [0, 1]);
            }
            return { opacity };
        });

    const handleButtonPress = async (direction: "left" | "right" | "up") => {
        await triggerHaptic('light');
        onSwipe(direction);
    };

    return (
        <View style={[styles.cardWrapper, { width: cardWidth }]}>
            <GestureDetector gesture={gesture}>
                <Animated.View style={[styles.cardOuter, animatedStyle, cardShadowStyle, { shadowColor: ACCENT }]}>
                    {/* Premium dark background */}
                    <View style={styles.cardBackground}>
                        {/* Subtle gradient overlay */}
                        <LinearGradient
                            colors={['rgba(22, 33, 62, 0.95)', 'rgba(13, 13, 26, 0.98)']}
                            style={StyleSheet.absoluteFill}
                            start={{ x: 0.5, y: 0 }}
                            end={{ x: 0.5, y: 1 }}
                        />

                        {/* Top silk highlight */}
                        <LinearGradient
                            colors={[rgba.gold(0.08), 'transparent']}
                            style={styles.silkHighlight}
                            start={{ x: 0.5, y: 0 }}
                            end={{ x: 0.5, y: 1 }}
                        />

                        {/* Swipe Overlays - Premium style */}
                        <Animated.View style={[styles.overlay, styles.overlayYes, overlayStyle("right")]} pointerEvents="none">
                            <View style={styles.overlayBadgePremium}>
                                <Text style={styles.overlayTextPremium}>YES</Text>
                            </View>
                        </Animated.View>
                        <Animated.View style={[styles.overlay, styles.overlayNo, overlayStyle("left")]} pointerEvents="none">
                            <View style={[styles.overlayBadgePremium, styles.overlayBadgeNo]}>
                                <Text style={[styles.overlayTextPremium, styles.overlayTextNo]}>NO</Text>
                            </View>
                        </Animated.View>
                        <Animated.View style={[styles.overlay, styles.overlayMaybe, overlayStyle("up")]} pointerEvents="none">
                            <View style={[styles.overlayBadgePremium, styles.overlayBadgeMaybe]}>
                                <Text style={[styles.overlayTextPremium, styles.overlayTextMaybe]}>MAYBE</Text>
                            </View>
                        </Animated.View>
                        <Animated.View style={[styles.overlay, styles.overlaySkip, overlayStyle("down")]} pointerEvents="none">
                            <View style={[styles.overlayBadgePremium, styles.overlayBadgeSkip]}>
                                <Text style={[styles.overlayTextPremium, styles.overlayTextSkip]}>SKIP</Text>
                            </View>
                        </Animated.View>

                        {/* Content */}
                        <View style={styles.content}>
                            {/* Intensity badge - more prominent */}
                            <View style={styles.intensityBadge}>
                                <Text style={styles.intensityLabel}>INTENSITY</Text>
                                <View style={styles.intensityRow}>
                                    {[...Array(5)].map((_, i) => (
                                        <Ionicons
                                            key={i}
                                            name={i < question.intensity ? "flame" : "flame-outline"}
                                            size={18}
                                            color={i < question.intensity ? ACCENT : 'rgba(255, 255, 255, 0.2)'}
                                        />
                                    ))}
                                </View>
                            </View>

                            {/* Decorative separator */}
                            <View style={styles.separator}>
                                <View style={styles.separatorLine} />
                                <View style={styles.separatorDiamond} />
                                <View style={styles.separatorLine} />
                            </View>

                            {/* Question text */}
                            <Text style={styles.questionText}>
                                {question.text}
                            </Text>

                            {/* Bottom separator */}
                            <View style={styles.separator}>
                                <View style={styles.separatorLine} />
                                <View style={styles.separatorDiamond} />
                                <View style={styles.separatorLine} />
                            </View>
                        </View>

                        {/* Premium Action Buttons */}
                        <View style={styles.footer}>
                            <View style={styles.buttonContainer}>
                                <PremiumButton
                                    onPress={() => handleButtonPress("left")}
                                    icon="close"
                                    variant="no"
                                />
                                <PremiumButton
                                    onPress={() => handleButtonPress("up")}
                                    icon="help"
                                    variant="maybe"
                                    small
                                />
                                <PremiumButton
                                    onPress={() => handleButtonPress("right")}
                                    icon="heart"
                                    variant="yes"
                                />
                            </View>
                        </View>
                    </View>

                    {/* Premium border */}
                    <View style={styles.premiumBorder} pointerEvents="none" />
                </Animated.View>
            </GestureDetector>
        </View>
    );
}

function PremiumButton({
    onPress,
    icon,
    variant,
    small = false,
}: {
    onPress: () => void;
    icon: string;
    variant: 'yes' | 'no' | 'maybe';
    small?: boolean;
}) {
    const buttonScale = useSharedValue(1);

    const handlePressIn = () => {
        buttonScale.value = withSpring(0.92, animations.spring);
    };

    const handlePressOut = () => {
        buttonScale.value = withSpring(1, animations.spring);
    };

    const buttonAnimatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: buttonScale.value }],
    }));

    const getColors = () => {
        switch (variant) {
            case 'yes': return { bg: rgba.gold(0.15), border: rgba.gold(0.3), icon: ACCENT };
            case 'no': return { bg: rgba.rose(0.15), border: rgba.rose(0.3), icon: ROSE };
            case 'maybe': return { bg: 'rgba(255, 255, 255, 0.08)', border: 'rgba(255, 255, 255, 0.15)', icon: colors.textSecondary };
        }
    };

    const c = getColors();

    return (
        <TouchableOpacity
            onPress={onPress}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            activeOpacity={1}
        >
            <Animated.View style={[
                styles.premiumButton,
                small && styles.premiumButtonSmall,
                { backgroundColor: c.bg, borderColor: c.border },
                buttonAnimatedStyle,
            ]}>
                <Ionicons
                    name={icon as any}
                    size={small ? 18 : 24}
                    color={c.icon}
                />
            </Animated.View>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    cardWrapper: {
        position: "absolute",
        maxWidth: MAX_CARD_WIDTH,
        height: 500,
    },
    cardOuter: {
        width: "100%",
        height: "100%",
        borderRadius: radius.xl,
        overflow: "hidden",
    },
    cardBackground: {
        flex: 1,
        backgroundColor: '#0d0d1a',
        borderRadius: radius.xl,
        overflow: "hidden",
    },
    silkHighlight: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 120,
    },
    premiumBorder: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        borderRadius: radius.xl,
        borderWidth: 1,
        borderColor: 'rgba(212, 175, 55, 0.2)', // gold @ 0.2
    },
    content: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        paddingHorizontal: spacing.xl,
    },
    intensityBadge: {
        alignItems: 'center',
        backgroundColor: 'rgba(212, 175, 55, 0.08)', // gold @ 0.08
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.sm,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: 'rgba(212, 175, 55, 0.15)', // gold @ 0.15
        marginBottom: spacing.md,
    },
    intensityLabel: {
        ...typography.caption2,
        fontWeight: '600',
        letterSpacing: 2,
        color: 'rgba(212, 175, 55, 0.7)', // gold @ 0.7
        marginBottom: spacing.xs,
    },
    intensityRow: {
        flexDirection: 'row',
        gap: 4,
    },
    separator: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginVertical: spacing.lg,
        width: 120,
    },
    separatorLine: {
        flex: 1,
        height: 1,
        backgroundColor: 'rgba(212, 175, 55, 0.2)', // gold @ 0.2
    },
    separatorDiamond: {
        width: 6,
        height: 6,
        backgroundColor: ACCENT,
        transform: [{ rotate: '45deg' }],
        marginHorizontal: spacing.md,
        opacity: 0.5,
    },
    questionText: {
        ...typography.title2,
        color: colors.text,
        textAlign: "center",
        lineHeight: 32,
        paddingHorizontal: spacing.sm,
    },
    footer: {
        paddingBottom: spacing.xl,
        paddingHorizontal: spacing.lg,
    },
    buttonContainer: {
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "center",
        gap: spacing.lg,
    },
    premiumButton: {
        width: 60,
        height: 60,
        borderRadius: 30,
        justifyContent: "center",
        alignItems: "center",
        borderWidth: 1,
    },
    premiumButtonSmall: {
        width: 48,
        height: 48,
        borderRadius: 24,
    },
    // Overlays
    overlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: "center",
        alignItems: "center",
        zIndex: 10,
        borderRadius: radius.xl,
    },
    overlayYes: {
        backgroundColor: 'rgba(212, 175, 55, 0.15)', // gold @ 0.15
    },
    overlayNo: {
        backgroundColor: 'rgba(232, 164, 174, 0.15)', // rose @ 0.15
    },
    overlayMaybe: {
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
    },
    overlaySkip: {
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
    },
    overlayBadgePremium: {
        paddingHorizontal: spacing.xl,
        paddingVertical: spacing.md,
        borderRadius: radius.full,
        backgroundColor: 'rgba(212, 175, 55, 0.2)', // gold @ 0.2
        borderWidth: 1,
        borderColor: 'rgba(212, 175, 55, 0.4)', // gold @ 0.4
        transform: [{ rotate: "-12deg" }],
    },
    overlayBadgeNo: {
        backgroundColor: 'rgba(232, 164, 174, 0.2)', // rose @ 0.2
        borderColor: 'rgba(232, 164, 174, 0.4)', // rose @ 0.4
    },
    overlayBadgeMaybe: {
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderColor: 'rgba(255, 255, 255, 0.2)',
    },
    overlayBadgeSkip: {
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderColor: 'rgba(255, 255, 255, 0.15)',
    },
    overlayTextPremium: {
        fontSize: 28,
        fontWeight: "600",
        letterSpacing: 4,
        color: ACCENT,
    },
    overlayTextNo: {
        color: ROSE,
    },
    overlayTextMaybe: {
        color: colors.textSecondary,
    },
    overlayTextSkip: {
        color: colors.textTertiary,
        fontSize: 24,
    },
});
