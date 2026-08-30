import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeInDown } from "react-native-reanimated";
import { GlassButton, GradientBackground } from "../../../components/ui";
import { colors, featureColors, radius, shadows, spacing, typography } from "../../../theme";

const ACCENT = featureColors.quiz.accent;

interface QuizIntroProps {
    isStarting: boolean;
    onStart: () => void;
}

export function QuizIntro({ isStarting, onStart }: QuizIntroProps) {
    return (
        <GradientBackground>
            <View style={styles.container}>
                <Animated.View entering={FadeInDown.duration(600).springify()} style={styles.content}>
                    <LinearGradient
                        colors={featureColors.quiz.gradient as [string, string]}
                        style={styles.iconGradient}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                    >
                        <Ionicons name="help-circle" size={40} color={colors.text} />
                    </LinearGradient>

                    <Text style={styles.label}>CONNECTION</Text>
                    <Text style={styles.title}>How well do you know each other?</Text>
                    <Text style={styles.description}>
                        Answer a set of questions about yourself, then guess how your partner
                        answered. See how well you really know each other, and share your score.
                    </Text>

                    <View style={styles.badge}>
                        <Ionicons name="list-outline" size={14} color={ACCENT} />
                        <Text style={styles.badgeText}>10 questions</Text>
                    </View>

                    <GlassButton
                        onPress={onStart}
                        loading={isStarting}
                        disabled={isStarting}
                        fullWidth
                        size="lg"
                        style={styles.startButton}
                        testID="quiz-start"
                    >
                        Start the quiz
                    </GlassButton>
                </Animated.View>
            </View>
        </GradientBackground>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        paddingHorizontal: spacing.lg,
    },
    content: {
        width: "100%",
        alignItems: "center",
    },
    iconGradient: {
        width: 88,
        height: 88,
        borderRadius: 44,
        justifyContent: "center",
        alignItems: "center",
        marginBottom: spacing.lg,
        ...shadows.lg,
    },
    label: {
        ...typography.caption1,
        fontWeight: "600",
        letterSpacing: 3,
        color: ACCENT,
        textAlign: "center",
        marginBottom: spacing.xs,
    },
    title: {
        ...typography.title1,
        color: colors.text,
        textAlign: "center",
        marginBottom: spacing.md,
    },
    description: {
        ...typography.body,
        color: colors.textSecondary,
        textAlign: "center",
        marginBottom: spacing.lg,
    },
    badge: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.xs,
        backgroundColor: colors.backgroundLight,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: radius.full,
        borderWidth: 1,
        borderColor: colors.border,
        marginBottom: spacing.xl,
    },
    badgeText: {
        ...typography.caption1,
        fontWeight: "600",
        color: ACCENT,
    },
    startButton: {
        marginTop: spacing.md,
    },
});
