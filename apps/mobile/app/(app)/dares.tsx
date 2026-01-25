import { View, Text, StyleSheet, Platform, Pressable, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown, FadeIn, useSharedValue, useAnimatedStyle, withSpring } from "react-native-reanimated";
import { GradientBackground } from "../../src/components/ui";
import { colors, spacing, radius, typography, animations } from "../../src/theme";
import { useFeatureInterest } from "../../src/hooks/useFeatureInterest";

const ACCENT_COLOR = colors.premium.gold;

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function DaresScreen() {
    const { isInterested, isLoading, isToggling, toggleInterest, isAuthenticated } =
        useFeatureInterest("dares");

    const scale = useSharedValue(1);
    const animatedButtonStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
    }));

    const handlePressIn = () => {
        scale.value = withSpring(0.96, animations.spring);
    };

    const handlePressOut = () => {
        scale.value = withSpring(1, animations.spring);
    };

    return (
        <GradientBackground>
            <View style={styles.container}>
                <Animated.View
                    entering={FadeInDown.duration(600).springify()}
                    style={styles.content}
                >
                    {/* Title section */}
                    <Text style={styles.label}>ADVENTURE</Text>
                    <Text style={styles.title}>Dares</Text>

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
                        Push your boundaries together with tantalising challenges designed to ignite passion and create unforgettable moments.
                    </Text>

                    {/* Feature hints */}
                    <View style={styles.features}>
                        <View style={styles.featureItem}>
                            <Ionicons name="sparkles" size={16} color={ACCENT_COLOR} />
                            <Text style={styles.featureText}>Provocative challenges</Text>
                        </View>
                        <View style={styles.featureItem}>
                            <Ionicons name="thermometer-outline" size={16} color={ACCENT_COLOR} />
                            <Text style={styles.featureText}>Multiple intensity levels</Text>
                        </View>
                        <View style={styles.featureItem}>
                            <Ionicons name="people-outline" size={16} color={ACCENT_COLOR} />
                            <Text style={styles.featureText}>Designed for two</Text>
                        </View>
                    </View>

                    {/* Bottom teaser */}
                    <Text style={styles.teaser}>Are you ready to play?</Text>

                    {/* Interest button - always reserve space to prevent layout shift */}
                    <View style={styles.interestButtonContainer}>
                        {isAuthenticated && !isLoading && (
                            <Animated.View entering={FadeIn.delay(500).duration(400)}>
                                <AnimatedPressable
                                    onPress={toggleInterest}
                                    onPressIn={handlePressIn}
                                    onPressOut={handlePressOut}
                                    disabled={isToggling}
                                    style={[
                                        styles.interestButton,
                                        isInterested && styles.interestButtonActive,
                                        animatedButtonStyle,
                                    ]}
                                >
                                    {isToggling ? (
                                        <ActivityIndicator size="small" color={ACCENT_COLOR} />
                                    ) : (
                                        <>
                                            <Ionicons
                                                name={isInterested ? "checkmark-circle" : "notifications-outline"}
                                                size={16}
                                                color={ACCENT_COLOR}
                                            />
                                            <Text style={styles.interestButtonText}>
                                                {isInterested ? "You're on the list!" : "I'm interested"}
                                            </Text>
                                        </>
                                    )}
                                </AnimatedPressable>
                            </Animated.View>
                        )}
                    </View>
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
        paddingTop: 60,
        paddingBottom: Platform.OS === 'ios' ? 120 : 100,
    },
    content: {
        width: '100%',
        alignItems: 'center',
        paddingHorizontal: spacing.md,
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
        backgroundColor: 'rgba(212, 175, 55, 0.3)',
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
        backgroundColor: colors.backgroundLight,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.sm,
        borderRadius: radius.full,
        borderWidth: 1,
        borderColor: colors.border,
        marginBottom: spacing.xl,
    },
    interestButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.backgroundLight,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.sm + 2,
        borderRadius: radius.full,
        borderWidth: 1,
        borderColor: colors.border,
        gap: spacing.sm,
    },
    interestButtonActive: {
        backgroundColor: colors.background,
        borderColor: colors.primary,
    },
    interestButtonText: {
        ...typography.subhead,
        fontWeight: '600',
        color: ACCENT_COLOR,
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
    interestButtonContainer: {
        marginTop: spacing.xl,
        minHeight: 44,
    },
});
