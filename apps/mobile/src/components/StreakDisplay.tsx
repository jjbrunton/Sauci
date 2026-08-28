import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, useSharedValue, useAnimatedStyle, withRepeat, withSequence, withTiming, Easing } from 'react-native-reanimated';
import { useStreakStore } from '../store';
import type { CoupleStreak } from '../store';
import { colors, spacing, radius, typography, shadows } from '../theme';

interface StreakDisplayProps {
    /** Whether to show the "longest streak" indicator */
    showLongest?: boolean;
    /** Animation delay for entry animation */
    delay?: number;
    /** Compact mode for smaller displays */
    compact?: boolean;
}

/**
 * The count is deliberately framed as a couple's, not a personal score: a shared streak
 * is the thing worth keeping. The status line is the working half of that framing - it
 * says who the day is waiting on - and the copy stays an invitation, because guilt
 * between partners is the failure mode for this mechanic rather than the goal.
 */
export function streakStatus(streak: CoupleStreak): { headline: string; status: string } {
    const named = streak.partner_name?.trim() || null;
    // The same fallback reads wrong in both positions, so keep a sentence-start form.
    const subject = named ?? 'Your partner';
    const object = named ?? 'your partner';
    const days = streak.current_streak;
    const both = streak.you_answered_today && streak.partner_answered_today;

    const headline = days > 0
        ? `You and ${object} — ${days} day${days === 1 ? '' : 's'} in a row`
        : `You and ${object}`;

    if (both) return { headline, status: days > 0 ? "You've both answered today" : 'Answered together today' };
    if (streak.partner_answered_today) return { headline, status: `${subject} has answered today — your turn` };
    if (streak.you_answered_today) return { headline, status: `Answered. Waiting on ${object}` };
    return { headline, status: days > 0 ? 'One question each keeps it going' : 'Answer together to start a streak' };
}

/**
 * Displays the couple's shared streak. The flame pulses while the streak is alive.
 */
export function StreakDisplay({ showLongest = false, delay = 0, compact = false }: StreakDisplayProps) {
    const { streak, fetchStreak } = useStreakStore();

    // Fetch streak on mount
    useEffect(() => {
        fetchStreak();
    }, [fetchStreak]);

    // Flame pulse animation
    const scale = useSharedValue(1);
    const hasStreak = (streak?.current_streak ?? 0) > 0;

    useEffect(() => {
        if (hasStreak) {
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
    }, [hasStreak, scale]);

    const flameStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
    }));

    if (!streak) {
        return null;
    }

    // A dormant couple gets no zero-state card. Showing "0 days" to a pair who simply
    // have not played yet reads as a scolding for a streak they never started.
    if (!hasStreak && !streak.you_answered_today && !streak.partner_answered_today) {
        return null;
    }

    const { headline, status } = streakStatus(streak);
    const currentStreak = streak.current_streak;
    const longestStreak = streak.longest_streak;
    // The partner having moved first is the one state the couple can still act on today.
    const awaitingYou = streak.partner_answered_today && !streak.you_answered_today;

    if (compact) {
        return (
            <Animated.View entering={FadeInDown.delay(delay).duration(400)}>
                <View style={[styles.compactContainer, awaitingYou && styles.compactAwaiting]}>
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
                <View style={[styles.card, shadows.sm, awaitingYou && styles.cardAwaiting]}>
                    <View style={styles.content}>
                        <Animated.View style={[styles.iconContainer, flameStyle]}>
                            <Ionicons
                                name="flame"
                                size={28}
                                color={hasStreak ? colors.warning : colors.textTertiary}
                            />
                        </Animated.View>

                        <View style={styles.info}>
                            <Text style={styles.headline} numberOfLines={2}>
                                {headline}
                            </Text>
                            <Text style={[styles.status, awaitingYou && styles.statusAwaiting]} numberOfLines={2}>
                                {status}
                            </Text>
                        </View>
                    </View>

                    {showLongest && longestStreak > 0 && (
                        <View style={styles.longest}>
                            <Ionicons name="trophy-outline" size={12} color={colors.textTertiary} />
                            <Text style={styles.longestText}>
                                Best together: {longestStreak} day{longestStreak !== 1 ? 's' : ''}
                            </Text>
                        </View>
                    )}
                </View>
            </View>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginVertical: spacing.sm,
    },
    card: {
        backgroundColor: colors.surface,
        borderRadius: radius.lg,
        padding: spacing.md,
        borderWidth: 1,
        borderColor: colors.border,
    },
    cardAwaiting: {
        borderColor: colors.warning,
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
    },
    iconContainer: {
        width: 44,
        height: 44,
        borderRadius: radius.full,
        backgroundColor: colors.warningLight,
        justifyContent: 'center',
        alignItems: 'center',
    },
    info: {
        flex: 1,
    },
    headline: {
        ...typography.headline,
        color: colors.text,
    },
    status: {
        ...typography.subhead,
        color: colors.textSecondary,
        marginTop: 2,
    },
    statusAwaiting: {
        color: colors.warning,
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
        borderTopColor: colors.border,
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
        backgroundColor: colors.warningLight,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
        borderRadius: radius.full,
    },
    compactAwaiting: {
        borderWidth: 1,
        borderColor: colors.warning,
    },
    compactCount: {
        ...typography.caption1,
        fontWeight: '600',
        color: colors.warning,
    },
});

export default StreakDisplay;
