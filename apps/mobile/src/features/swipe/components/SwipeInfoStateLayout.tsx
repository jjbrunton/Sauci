import { StyleSheet, Text, TextStyle, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeIn, FadeInUp } from "react-native-reanimated";

import { DecorativeSeparator, GlassButton, GradientBackground } from "../../../components/ui";
import { colors, radius, spacing, typography } from "../../../theme";

export interface FeatureItem {
    icon: keyof typeof Ionicons.glyphMap;
    text: string;
    color?: string;
}

interface SwipeInfoStateLayoutProps {
    accentColor: string;
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
    title: string;
    badgeText?: string;
    description: string;
    features: FeatureItem[];
    teaser: string;
    separatorVariant?: "rose" | "gold";
    labelStyle?: TextStyle;
    action?: {
        label: string;
        onPress: () => void;
        variant?: "primary" | "secondary";
    };
    secondaryAction?: {
        label: string;
        onPress: () => void;
        icon?: keyof typeof Ionicons.glyphMap;
    };
}

export const SwipeInfoStateLayout = ({
    accentColor,
    icon,
    label,
    title,
    badgeText,
    description,
    features,
    teaser,
    separatorVariant = "rose",
    labelStyle,
    action,
    secondaryAction,
}: SwipeInfoStateLayoutProps) => (
    <GradientBackground>
        <View style={styles.centerContainer}>
            <Animated.View
                entering={FadeInUp.duration(600).springify()}
                style={styles.waitingContent}
            >
                <View style={styles.waitingIconContainer}>
                    <Ionicons name={icon} size={36} color={accentColor} />
                </View>

                <Text style={[styles.waitingLabel, labelStyle]}>{label}</Text>
                <Text style={styles.waitingTitle}>{title}</Text>

                <DecorativeSeparator variant={separatorVariant} />

                {badgeText && (
                    <Animated.View
                        entering={FadeIn.delay(300).duration(400)}
                        style={styles.waitingBadge}
                    >
                        <Text style={styles.waitingBadgeText}>{badgeText}</Text>
                    </Animated.View>
                )}

                <Text style={styles.waitingDescription}>{description}</Text>

                <View style={styles.waitingFeatures}>
                    {features.map((feature, index) => (
                        <View key={`${feature.text}-${index}`} style={styles.waitingFeatureItem}>
                            <Ionicons name={feature.icon} size={16} color={feature.color || accentColor} />
                            <Text style={styles.waitingFeatureText}>{feature.text}</Text>
                        </View>
                    ))}
                </View>

                <Text style={styles.waitingTeaser}>{teaser}</Text>

                {action && (
                    <GlassButton
                        variant={action.variant}
                        onPress={action.onPress}
                        style={{ marginTop: spacing.lg }}
                    >
                        {action.label}
                    </GlassButton>
                )}

                {secondaryAction && (
                    <GlassButton
                        variant="secondary"
                        onPress={secondaryAction.onPress}
                        style={{ marginTop: spacing.sm }}
                        icon={secondaryAction.icon ? <Ionicons name={secondaryAction.icon} size={18} color={colors.text} /> : undefined}
                    >
                        {secondaryAction.label}
                    </GlassButton>
                )}
            </Animated.View>
        </View>
    </GradientBackground>
);

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
    waitingIconContainer: {
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: 'rgba(232, 164, 174, 0.1)',
        borderWidth: 1,
        borderColor: 'rgba(232, 164, 174, 0.2)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: spacing.xl,
    },
    waitingLabel: {
        ...typography.caption1,
        fontWeight: '600',
        letterSpacing: 3,
        color: colors.premium.rose,
        textAlign: 'center',
        marginBottom: spacing.xs,
    },
    waitingTitle: {
        ...typography.largeTitle,
        color: colors.text,
        textAlign: 'center',
    },
    waitingBadge: {
        backgroundColor: 'rgba(232, 164, 174, 0.1)',
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.sm,
        borderRadius: radius.full,
        borderWidth: 1,
        borderColor: 'rgba(232, 164, 174, 0.2)',
        marginBottom: spacing.xl,
    },
    waitingBadgeText: {
        ...typography.caption2,
        fontWeight: '600',
        letterSpacing: 2,
        color: colors.premium.rose,
    },
    waitingDescription: {
        ...typography.body,
        color: colors.textSecondary,
        textAlign: 'center',
        marginBottom: spacing.xl,
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
    waitingTeaser: {
        ...typography.footnote,
        fontStyle: 'italic',
        color: colors.textTertiary,
        textAlign: 'center',
    },
});
