import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withRepeat,
    withSequence,
    withTiming,
    FadeIn,
} from 'react-native-reanimated';
import { gradients, colors, radius, spacing } from '../../../theme';

interface TypingDotProps {
    delay: number;
}

const TypingDot = React.memo(function TypingDot({ delay }: TypingDotProps) {
    const opacity = useSharedValue(0.4);

    useEffect(() => {
        opacity.value = withRepeat(
            withSequence(
                withTiming(1, { duration: 300 }),
                withTiming(0.4, { duration: 300 })
            ),
            -1,
            true
        );
    }, []);

    const animatedStyle = useAnimatedStyle(() => ({
        opacity: opacity.value,
    }));

    return (
        <Animated.View style={[styles.typingDot, animatedStyle, { marginLeft: delay > 0 ? 4 : 0 }]}>
            <LinearGradient
                colors={gradients.premiumGold as [string, string]}
                style={styles.typingDotGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
            />
        </Animated.View>
    );
});

/**
 * Typing indicator component showing three animated dots
 * when partner is typing.
 */
const TypingIndicatorComponent: React.FC = () => {
    return (
        <Animated.View
            entering={FadeIn.duration(200)}
            style={styles.container}
        >
            <View style={styles.bubble}>
                {/* Subtle gradient */}
                <LinearGradient
                    colors={['rgba(22, 33, 62, 0.6)', 'rgba(13, 13, 26, 0.8)']}
                    style={StyleSheet.absoluteFill}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                />
                <View style={styles.dots}>
                    <TypingDot delay={0} />
                    <TypingDot delay={150} />
                    <TypingDot delay={300} />
                </View>
            </View>
        </Animated.View>
    );
};

// Wrap with React.memo for performance
export const TypingIndicator = React.memo(TypingIndicatorComponent);

const styles = StyleSheet.create({
    container: {
        alignItems: 'flex-start',
        marginBottom: spacing.sm,
    },
    bubble: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: radius.xl,
        borderWidth: 1,
        borderColor: 'rgba(212, 175, 55, 0.15)',
        backgroundColor: 'rgba(22, 33, 62, 0.6)',
        overflow: 'hidden',
    },
    dots: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    typingDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        overflow: 'hidden',
    },
    typingDotGradient: {
        flex: 1,
        borderRadius: 4,
    },
});
