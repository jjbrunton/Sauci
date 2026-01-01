import { View, Text, StyleSheet, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";
import { GradientBackground } from "../../src/components/ui";
import { colors, spacing, radius, typography } from "../../src/theme";

const ACCENT_COLOR = colors.premium.rose;

export default function QuizScreen() {
    return (
        <GradientBackground>
            <View style={styles.container}>
                <Animated.View
                    entering={FadeInDown.duration(600).springify()}
                    style={styles.content}
                >
                    {/* Icon */}
                    <View style={styles.iconContainer}>
                        <Ionicons name="heart" size={36} color={ACCENT_COLOR} />
                    </View>

                    {/* Title section */}
                    <Text style={styles.label}>INTIMACY</Text>
                    <Text style={styles.title}>Quiz</Text>

                    {/* Decorative separator */}
                    <View style={styles.separator}>
                        <View style={styles.separatorLine} />
                        <View style={styles.separatorDiamond} />
                        <View style={styles.separatorLine} />
                    </View>

                    {/* Coming soon badge */}
                    <Animated.View
                        entering={FadeIn.delay(300).duration(400)}
                        style={styles.badge}
                    >
                        <Text style={styles.badgeText}>ARRIVING SOON</Text>
                    </Animated.View>

                    {/* Description */}
                    <Text style={styles.description}>
                        Discover the depths of your connection through carefully crafted questions that reveal how well you truly know each other.
                    </Text>

                    {/* Feature hints */}
                    <View style={styles.features}>
                        <View style={styles.featureItem}>
                            <Ionicons name="sparkles" size={16} color={ACCENT_COLOR} />
                            <Text style={styles.featureText}>Uncover hidden desires</Text>
                        </View>
                        <View style={styles.featureItem}>
                            <Ionicons name="flame-outline" size={16} color={ACCENT_COLOR} />
                            <Text style={styles.featureText}>Deepen your bond</Text>
                        </View>
                        <View style={styles.featureItem}>
                            <Ionicons name="ribbon-outline" size={16} color={ACCENT_COLOR} />
                            <Text style={styles.featureText}>Track your journey</Text>
                        </View>
                    </View>

                    {/* Bottom teaser */}
                    <Text style={styles.teaser}>Something special is being crafted for you</Text>
                </Animated.View>
            </View>
        </GradientBackground>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: spacing.lg,
        paddingTop: Platform.OS === 'ios' ? 60 : 40,
        paddingBottom: Platform.OS === 'ios' ? 120 : 100,
    },
    content: {
        width: '100%',
        alignItems: 'center',
        paddingHorizontal: spacing.md,
    },
    iconContainer: {
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
    label: {
        ...typography.caption1,
        fontWeight: '600',
        letterSpacing: 3,
        color: ACCENT_COLOR,
        textAlign: 'center',
        marginBottom: spacing.xs,
    },
    title: {
        ...typography.largeTitle,
        color: colors.text,
        textAlign: 'center',
    },
    separator: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginVertical: spacing.lg,
        width: 140,
    },
    separatorLine: {
        flex: 1,
        height: 1,
        backgroundColor: 'rgba(232, 164, 174, 0.3)',
    },
    separatorDiamond: {
        width: 6,
        height: 6,
        backgroundColor: ACCENT_COLOR,
        transform: [{ rotate: '45deg' }],
        marginHorizontal: spacing.md,
        opacity: 0.6,
    },
    badge: {
        backgroundColor: 'rgba(232, 164, 174, 0.1)',
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.sm,
        borderRadius: radius.full,
        borderWidth: 1,
        borderColor: 'rgba(232, 164, 174, 0.2)',
        marginBottom: spacing.xl,
    },
    badgeText: {
        ...typography.caption2,
        fontWeight: '600',
        letterSpacing: 2,
        color: ACCENT_COLOR,
    },
    description: {
        ...typography.body,
        color: colors.textSecondary,
        textAlign: 'center',
        marginBottom: spacing.xl,
        paddingHorizontal: spacing.md,
    },
    features: {
        marginBottom: spacing.xl,
    },
    featureItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: spacing.sm,
    },
    featureText: {
        ...typography.subhead,
        color: colors.text,
        marginLeft: spacing.sm,
    },
    teaser: {
        ...typography.footnote,
        fontStyle: 'italic',
        color: colors.textTertiary,
        textAlign: 'center',
    },
});
