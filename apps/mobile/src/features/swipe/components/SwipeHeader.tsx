import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeIn } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";

import { colors, spacing, typography } from "../../../theme";
import { StreakDisplay } from "../../../components/StreakDisplay";
import { useProgressShimmer } from "../hooks/useProgressShimmer";
import type { DailyLimitInfo } from "../types";

/** Remaining answers at or below this switch the meter to its "running out" treatment. */
const SCARCITY_THRESHOLD = 3;

interface SwipeHeaderProps {
    currentIndex: number;
    effectiveTotal: number;
    totalQuestions: number;
    mode?: string;
    packContext: { name: string } | null;
    showBackButton: boolean;
    onBack: () => void;
    dailyLimitInfo?: DailyLimitInfo | null;
}

export const SwipeHeader = ({
    currentIndex,
    effectiveTotal,
    totalQuestions,
    mode,
    packContext,
    showBackButton,
    onBack,
    dailyLimitInfo,
}: SwipeHeaderProps) => {
    const shimmerStyle = useProgressShimmer();
    const total = effectiveTotal || totalQuestions;
    const progressPercent = total > 0 ? ((currentIndex + 1) / total) * 100 : 0;

    // Catch-up answers are exempt from the cap, so the meter is hidden in pending mode.
    const showMeter = mode !== 'pending'
        && !!dailyLimitInfo
        && dailyLimitInfo.limit_value > 0
        && !dailyLimitInfo.is_blocked;
    const remaining = dailyLimitInfo?.remaining ?? 0;
    const isRunningOut = showMeter && remaining <= SCARCITY_THRESHOLD;

    return (
        <Animated.View
            entering={FadeIn.duration(400)}
            style={styles.header}
        >
            <View style={styles.headerRow}>
                {showBackButton && (
                    <TouchableOpacity onPress={onBack} style={styles.backButton}>
                        <Ionicons name="chevron-back" size={24} color={colors.text} />
                    </TouchableOpacity>
                )}
                <View style={styles.progressContainer}>
                    <Text style={styles.progressLabel}>
                        {mode === 'pending' ? 'YOUR TURN' : packContext ? packContext.name.toUpperCase() : 'EXPLORE'}
                    </Text>
                    <Text style={styles.progressText}>
                        {currentIndex + 1} of {total}
                    </Text>
                    {showMeter && (
                        <View style={[styles.meter, isRunningOut && styles.meterUrgent]}>
                            {isRunningOut && (
                                <Ionicons name="hourglass-outline" size={12} color={colors.premium.gold} />
                            )}
                            <Text style={[styles.meterText, isRunningOut && styles.meterTextUrgent]}>
                                {remaining === 1 ? '1 left today' : `${remaining} left today`}
                            </Text>
                        </View>
                    )}
                    <View style={[styles.progressBar, styles.progressBarPremium]}>
                        <Animated.View
                            style={[
                                styles.progressFill,
                                styles.progressFillPremium,
                                { width: `${progressPercent}%` },
                            ]}
                        >
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
                {/* The shared streak sits opposite the back button so the centred
                    progress column keeps its position. */}
                <View style={styles.streakBadge} pointerEvents="none">
                    <StreakDisplay compact delay={200} />
                </View>
            </View>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
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
        position: 'absolute',
        left: 0,
        padding: spacing.sm,
    },
    streakBadge: {
        position: 'absolute',
        right: 0,
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
        marginBottom: spacing.xs,
    },
    meter: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: spacing.sm,
    },
    meterUrgent: {
        paddingHorizontal: spacing.sm,
        paddingVertical: 2,
        borderRadius: 999,
        backgroundColor: 'rgba(212, 175, 55, 0.1)',
        borderWidth: 1,
        borderColor: 'rgba(212, 175, 55, 0.2)',
    },
    meterText: {
        ...typography.caption2,
        letterSpacing: 0.5,
        color: colors.textTertiary,
    },
    meterTextUrgent: {
        color: colors.premium.gold,
        fontWeight: '600',
        marginLeft: spacing.xs,
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
});
