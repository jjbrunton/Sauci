import React from "react";
import { View, Text, StyleSheet, Platform } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    runOnJS,
    interpolate,
    Extrapolation,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, radius, typography } from "../../theme";

const SWIPE_THRESHOLD = 80;
const ACCENT = colors.premium.gold;

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

interface SwipeableMatchItemProps {
    children: React.ReactNode;
    onArchive: () => void;
    isArchived?: boolean;
    enabled?: boolean;
}

export function SwipeableMatchItem({
    children,
    onArchive,
    isArchived = false,
    enabled = true,
}: SwipeableMatchItemProps) {
    const translateX = useSharedValue(0);
    const hasTriggeredHaptic = useSharedValue(false);

    const panGesture = Gesture.Pan()
        .enabled(enabled)
        .activeOffsetX([-20, 20])
        .onUpdate((event) => {
            // Only allow left swipe (negative X) for archive
            translateX.value = Math.min(0, event.translationX);

            // Trigger haptic when crossing threshold
            if (translateX.value < -SWIPE_THRESHOLD && !hasTriggeredHaptic.value) {
                hasTriggeredHaptic.value = true;
                runOnJS(triggerHaptic)('medium');
            } else if (translateX.value >= -SWIPE_THRESHOLD) {
                hasTriggeredHaptic.value = false;
            }
        })
        .onEnd(() => {
            if (translateX.value < -SWIPE_THRESHOLD) {
                // Animate out then trigger archive
                translateX.value = withSpring(-200, { damping: 15 }, (finished) => {
                    if (finished) {
                        runOnJS(onArchive)();
                    }
                });
            } else {
                // Spring back to center
                translateX.value = withSpring(0, { damping: 15 });
            }
            hasTriggeredHaptic.value = false;
        });

    const containerStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: translateX.value }],
    }));

    const actionStyle = useAnimatedStyle(() => ({
        opacity: interpolate(
            translateX.value,
            [-SWIPE_THRESHOLD, -20, 0],
            [1, 0.5, 0],
            Extrapolation.CLAMP
        ),
        transform: [
            {
                scale: interpolate(
                    translateX.value,
                    [-SWIPE_THRESHOLD, 0],
                    [1, 0.8],
                    Extrapolation.CLAMP
                ),
            },
        ],
    }));

    const actionIconStyle = useAnimatedStyle(() => ({
        transform: [
            {
                translateX: interpolate(
                    translateX.value,
                    [-SWIPE_THRESHOLD * 1.5, -SWIPE_THRESHOLD, 0],
                    [0, 10, 30],
                    Extrapolation.CLAMP
                ),
            },
        ],
    }));

    return (
        <View style={styles.container}>
            {/* Archive action revealed on swipe */}
            <Animated.View style={[styles.actionContainer, actionStyle]}>
                <Animated.View style={[styles.actionContent, actionIconStyle]}>
                    <View style={styles.iconContainer}>
                        <Ionicons
                            name={isArchived ? "arrow-undo" : "archive"}
                            size={22}
                            color={ACCENT}
                        />
                    </View>
                    <Text style={styles.actionText}>
                        {isArchived ? "Restore" : "Archive"}
                    </Text>
                </Animated.View>
            </Animated.View>

            <GestureDetector gesture={panGesture}>
                <Animated.View style={containerStyle}>
                    {children}
                </Animated.View>
            </GestureDetector>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: "relative",
        overflow: "hidden",
    },
    actionContainer: {
        position: "absolute",
        right: spacing.md,
        top: 0,
        bottom: 0,
        justifyContent: "center",
        alignItems: "flex-end",
        paddingRight: spacing.sm,
    },
    actionContent: {
        alignItems: "center",
        gap: spacing.xs,
    },
    iconContainer: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: `rgba(212, 175, 55, 0.15)`,
        borderWidth: 1,
        borderColor: `rgba(212, 175, 55, 0.3)`,
        justifyContent: "center",
        alignItems: "center",
    },
    actionText: {
        ...typography.caption2,
        color: ACCENT,
        fontWeight: "600",
        letterSpacing: 0.5,
    },
});
