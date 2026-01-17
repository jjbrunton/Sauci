import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, useSharedValue, useAnimatedStyle, withRepeat, withSequence, withTiming, Easing } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useStreakStore } from '../store';
import { colors, spacing, radius, typography } from '../theme';

interface StreakDisplayProps {
    /** Whether to show the "longest streak" indicator */
    showLongest?: boolean;
    /** Animation delay for entry animation */
    delay?: number;
    /** Compact mode for smaller displays */
    compact?: boolean;
}

/**
 * Displays the couple's current streak with a flame icon.
 * The flame pulses when there's an active streak.
 */
export function StreakDisplay({ showLongest = false, delay = 0, compact = false }: StreakDisplayProps) {
    const { streak, isLoading, fetchStreak } = useStreakStore();

    // Fetch streak on mount
    useEffect(() => {
        fetchStreak();
    }, [fetchStreak]);

    // Flame pulse animation
    const scale = useSharedValue(1);

    useEffect(() => {
        if (streak && streak.current_streak > 0) {
            scale.value = withRepeat(
                withSequence(
                    withTiming(1.1, { duration: 800, easing: Easing.inOut(Easing.ease) }),
                    withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) })
                ),
                -1,
                true
            );
        } else {
            scale.value = 1;
        }
    }, [streak?.current_streak, scale]);

    const flameStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
    }));

    // Don't show if loading or no couple
    if (isLoading || !streak) {
        return null;
    }

    const hasStreak = streak.current_streak > 0;
    const currentStreak = streak.current_streak;
    const longestStreak = streak.longest_streak;

    if (compact) {
        return (
            <Animated.View entering={FadeInDown.delay(delay).duration(400)}>
                <View style={styles.compactContainer}>
                    <Animated.View style={flameStyle}>
                        <Ionicons
                            name="flame"
                            size={16}
                            color={hasStreak ? colors.warning : colors.textTertiary}
                        />
                    </Animated.View>
                    <Text style={[styles.compactCount, !hasStreak && styles.inactiveText]}>
                        {currentStreak}
                    </Text>
                </View>
            </Animated.View>
        );
    }

    return (
        <Animated.View entering={FadeInDown.delay(delay).duration(500)}>
            <View style={styles.container}>
                {/* Main streak display */}
                <LinearGradient
                    colors={hasStreak ? ['rgba(243, 156, 18, 0.2)', 'rgba(233, 69, 96, 0.1)'] : ['rgba(255, 255, 255, 0.05)', 'rgba(255, 255, 255, 0.02)']}
                    style={styles.card}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                >
                    <View style={styles.content}>
                        {/* Flame icon */}
                        <Animated.View style={[styles.iconContainer, flameStyle]}>
                            <Ionicons
                                name="flame"
                                size={32}
                                color={hasStreak ? colors.warning : colors.textTertiary}
                            />
                        </Animated.View>

                        {/* Streak info */}
                        <View style={styles.info}>
                            <Text style={[styles.count, !hasStreak && styles.inactiveText]}>
                                {currentStreak}
                            </Text>
                            <Text style={styles.label}>
                                day{currentStreak !== 1 ? 's' : ''} together
                            </Text>
                        </View>
                    </View>

                    {/* Longest streak */}
                    {showLongest && longestStreak > 0 && (
                        <View style={styles.longest}>
                            <Ionicons name="trophy-outline" size={12} color={colors.textTertiary} />
                            <Text style={styles.longestText}>
                                Best: {longestStreak} day{longestStreak !== 1 ? 's' : ''}
                            </Text>
                        </View>
                    )}
                </LinearGradient>
            </View>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginVertical: spacing.sm,
    },
    card: {
        borderRadius: radius.lg,
        padding: spacing.md,
        borderWidth: 1,
        borderColor: colors.glass.border,
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
    },
    iconContainer: {
        width: 48,
        height: 48,
        borderRadius: radius.full,
        backgroundColor: 'rgba(243, 156, 18, 0.15)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    info: {
        flex: 1,
    },
    count: {
        ...typography.title1,
        color: colors.text,
    },
    label: {
        ...typography.subhead,
        color: colors.textSecondary,
    },
    inactiveText: {
        color: colors.textTertiary,
    },
    longest: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        marginTop: spacing.sm,
        paddingTop: spacing.sm,
        borderTopWidth: 1,
        borderTopColor: colors.glass.border,
    },
    longestText: {
        ...typography.caption1,
        color: colors.textTertiary,
    },
    // Compact styles
    compactContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        backgroundColor: 'rgba(243, 156, 18, 0.15)',
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
        borderRadius: radius.full,
    },
    compactCount: {
        ...typography.caption1,
        fontWeight: '600',
        color: colors.warning,
    },
});

export default StreakDisplay;
