import { useState } from "react";
import { View, Text, StyleSheet, Platform, useWindowDimensions } from "react-native";
import { Gesture, GestureDetector, TouchableOpacity } from "react-native-gesture-handler";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    runOnJS,
    interpolate,
    Extrapolate,
    withTiming,
    interpolateColor,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { colors, gradients, radius, shadows, blur, typography, spacing, animations } from "../theme";
import { QuestionFeedbackModal } from "./QuestionFeedbackModal";

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
    onSwipe: (direction: "left" | "right" | "up") => void;
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

    const context = useSharedValue({ x: 0, y: 0 });

    const gesture = Gesture.Pan()
        .activeOffsetX([-15, 15])
        .activeOffsetY([-15, 15])
        .onStart(() => {
            context.value = { x: translateX.value, y: translateY.value };
            scale.value = withTiming(1.02, { duration: animations.timing.fast });
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
            } else {
                translateX.value = withSpring(0, animations.spring);
                translateY.value = withSpring(0, animations.spring);
                rotation.value = withSpring(0, animations.spring);
            }
        });

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [
            { translateX: translateX.value },
            { translateY: translateY.value },
            { rotate: `${rotation.value}deg` },
            { scale: scale.value },
        ],
    }));

    const overlayStyle = (direction: "left" | "right" | "up") =>
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
            } else {
                opacity = interpolate(translateY.value, [0, -SWIPE_THRESHOLD], [0, 0.9]);
                backgroundColor = interpolateColor(
                    opacity,
                    [0, 0.9],
                    ['transparent', 'rgba(243, 156, 18, 0.4)']
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
                    <Animated.View style={[styles.cardOuter, animatedStyle, shadows.xl]}>
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
                                />
                            </BlurView>
                        ) : (
                            <View style={styles.fallbackContainer}>
                                <CardContent
                                    question={question}
                                    overlayStyle={overlayStyle}
                                    handleButtonPress={handleButtonPress}
                                    onFeedbackPress={handleFeedbackPress}
                                />
                            </View>
                        )}
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
}: {
    question: Props['question'];
    overlayStyle: (direction: "left" | "right" | "up") => any;
    handleButtonPress: (direction: "left" | "right" | "up") => void;
    onFeedbackPress: () => void;
}) {
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

            {/* Feedback Button */}
            <View style={styles.feedbackButton}>
                <Ionicons
                    name="flag-outline"
                    size={18}
                    color={colors.textTertiary}
                    onPress={onFeedbackPress}
                />
            </View>

            {/* Overlays */}
            <Animated.View style={[styles.overlay, overlayStyle("right")]} pointerEvents="none">
                <View style={[styles.overlayBadge, { backgroundColor: colors.success }]}>
                    <Text style={styles.overlayText}>YES</Text>
                </View>
            </Animated.View>
            <Animated.View style={[styles.overlay, overlayStyle("left")]} pointerEvents="none">
                <View style={[styles.overlayBadge, { backgroundColor: colors.error }]}>
                    <Text style={styles.overlayText}>NO</Text>
                </View>
            </Animated.View>
            <Animated.View style={[styles.overlay, overlayStyle("up")]} pointerEvents="none">
                <View style={[styles.overlayBadge, { backgroundColor: colors.warning }]}>
                    <Text style={styles.overlayText}>MAYBE</Text>
                </View>
            </Animated.View>

            {/* Content */}
            <View style={styles.content}>
                <View style={styles.intensityContainer}>
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
    return (
        <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
            <LinearGradient
                colors={buttonColors}
                style={[
                    styles.actionButton,
                    small && styles.actionButtonSmall,
                    shadows.md,
                ]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
            >
                <View style={styles.buttonHighlight} />
                <Ionicons
                    name={icon as any}
                    size={small ? 20 : 28}
                    color={colors.text}
                    style={styles.buttonIcon}
                />
            </LinearGradient>
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
        backgroundColor: "rgba(255, 255, 255, 0.15)",
    },
    buttonIcon: {
        zIndex: 1,
    },
});
