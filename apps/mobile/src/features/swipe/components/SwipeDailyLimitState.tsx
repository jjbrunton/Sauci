import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeIn, FadeInUp } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";

import { DecorativeSeparator, GradientBackground } from "../../../components/ui";
import { Paywall } from "../../../components/paywall";
import { colors, radius, spacing, typography } from "../../../theme";
import type { DailyLimitInfo } from "../types";

interface SwipeDailyLimitStateProps {
    dailyLimitInfo: DailyLimitInfo;
    countdown: string;
    showPaywall: boolean;
    onShowPaywall: () => void;
    onClosePaywall: () => void;
    onPaywallSuccess: () => void;
}

export const SwipeDailyLimitState = ({
    dailyLimitInfo,
    countdown,
    showPaywall,
    onShowPaywall,
    onClosePaywall,
    onPaywallSuccess,
}: SwipeDailyLimitStateProps) => {
    const accent = colors.premium.gold;

    return (
        <GradientBackground>
            <View style={styles.centerContainer}>
                <Animated.View
                    entering={FadeInUp.duration(600).springify()}
                    style={styles.waitingContent}
                >
                    <View style={styles.dailyLimitIconWrapper}>
                        <View style={styles.dailyLimitIconGlow} />
                        <View style={styles.dailyLimitIconContainer}>
                            <Ionicons name="hourglass-outline" size={36} color={accent} />
                        </View>
                    </View>

                    <Text style={styles.dailyLimitLabel}>DAILY LIMIT REACHED</Text>
                    <Text style={styles.dailyLimitTitle}>Take a Breather</Text>

                    <DecorativeSeparator variant="gold" />

                    <Animated.View
                        entering={FadeIn.delay(300).duration(400)}
                        style={styles.countdownContainer}
                    >
                        <Text style={styles.countdownLabel}>REFRESHES IN</Text>
                        <View style={styles.countdownBadge}
                        >
                            <Ionicons name="timer-outline" size={20} color={accent} />
                            <Text style={styles.countdownText}>{countdown}</Text>
                        </View>
                    </Animated.View>

                    <Text style={styles.dailyLimitDescription}>
                        You've answered {dailyLimitInfo.limit_value} questions today!{'\n'}
                        Let the anticipation build while you wait.
                    </Text>

                    <View style={styles.waitingFeatures}>
                        <View style={styles.waitingFeatureItem}>
                            <Ionicons name="chatbubbles-outline" size={16} color={colors.premium.gold} />
                            <Text style={styles.waitingFeatureText}>Chat about your matches</Text>
                        </View>
                        <View style={styles.waitingFeatureItem}>
                            <Ionicons name="sparkles" size={16} color={colors.premium.gold} />
                            <Text style={styles.waitingFeatureText}>Fresh questions tomorrow</Text>
                        </View>
                        <View style={styles.waitingFeatureItem}>
                            <Ionicons name="infinite-outline" size={16} color={colors.premium.gold} />
                            <Text style={styles.waitingFeatureText}>Go unlimited with Premium</Text>
                        </View>
                    </View>

                    <Text style={styles.premiumUpsellText}>Want to keep exploring?</Text>
                    <TouchableOpacity
                        onPress={onShowPaywall}
                        style={styles.premiumButton}
                        activeOpacity={0.85}
                    >
                        <LinearGradient
                            colors={[colors.premium.gold, colors.premium.goldDark]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.premiumButtonGradient}
                        />
                        <View style={styles.premiumButtonContent}>
                            <Ionicons name="infinite" size={18} color="#000" />
                            <Text style={styles.premiumButtonText}>Unlock Unlimited</Text>
                        </View>
                    </TouchableOpacity>
                </Animated.View>
            </View>

            <Paywall
                visible={showPaywall}
                onClose={onClosePaywall}
                onSuccess={onPaywallSuccess}
            />
        </GradientBackground>
    );
};

const styles = StyleSheet.create({
    centerContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
    },
    waitingContent: {
        width: '100%',
        alignItems: 'center',
        paddingHorizontal: spacing.md,
    },
    waitingFeatures: {
        marginBottom: spacing.xl,
    },
    waitingFeatureItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: spacing.sm,
    },
    waitingFeatureText: {
        ...typography.subhead,
        color: colors.text,
        marginLeft: spacing.sm,
    },
    dailyLimitIconWrapper: {
        position: 'relative',
        marginBottom: spacing.xl,
    },
    dailyLimitIconGlow: {
        position: 'absolute',
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: 'rgba(212, 175, 55, 0.15)',
        top: -24,
        left: -24,
    },
    dailyLimitIconContainer: {
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: 'rgba(212, 175, 55, 0.1)',
        borderWidth: 1.5,
        borderColor: 'rgba(212, 175, 55, 0.3)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    dailyLimitLabel: {
        ...typography.caption2,
        fontWeight: '600',
        letterSpacing: 2,
        color: colors.premium.gold,
        textAlign: 'center',
        marginBottom: spacing.xs,
    },
    dailyLimitTitle: {
        ...typography.largeTitle,
        color: colors.text,
        textAlign: 'center',
    },
    countdownContainer: {
        alignItems: 'center',
        marginBottom: spacing.xl,
    },
    countdownLabel: {
        ...typography.caption2,
        letterSpacing: 1.5,
        color: colors.textTertiary,
        marginBottom: spacing.sm,
    },
    countdownBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(212, 175, 55, 0.1)',
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.sm,
        borderRadius: radius.full,
        borderWidth: 1,
        borderColor: 'rgba(212, 175, 55, 0.2)',
    },
    countdownText: {
        ...typography.title2,
        color: colors.premium.gold,
        marginLeft: spacing.sm,
        letterSpacing: 1,
    },
    dailyLimitDescription: {
        ...typography.body,
        color: colors.textSecondary,
        textAlign: 'center',
        marginBottom: spacing.xl,
        paddingHorizontal: spacing.md,
    },
    premiumUpsellText: {
        ...typography.subhead,
        color: colors.textSecondary,
        marginBottom: spacing.sm,
    },
    premiumButton: {
        marginTop: spacing.sm,
        borderRadius: radius.full,
        overflow: 'hidden',
    },
    premiumButtonGradient: {
        ...StyleSheet.absoluteFillObject,
    },
    premiumButtonContent: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.xl,
        paddingVertical: spacing.md,
    },
    premiumButtonText: {
        ...typography.subhead,
        color: '#000',
        marginLeft: spacing.sm,
        fontWeight: '600',
    },
});
