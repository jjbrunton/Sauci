import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeInDown } from "react-native-reanimated";
import { GlassButton, GlassCard, GradientBackground } from "../../../components/ui";
import { colors, featureColors, radius, spacing, typography } from "../../../theme";
import type { QuizResult } from "../types";

interface QuizResultsProps {
    result: QuizResult | null;
    isLoadingResult: boolean;
    isStarting: boolean;
    onNewQuiz: () => void;
    onShare: () => void;
}

export function QuizResults({ result, isLoadingResult, isStarting, onNewQuiz, onShare }: QuizResultsProps) {
    if (!result) {
        return (
            <GradientBackground>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={featureColors.quiz.accent} />
                    <Text style={styles.loadingText}>
                        {isLoadingResult ? "Tallying your answers..." : "Loading your results..."}
                    </Text>
                </View>
            </GradientBackground>
        );
    }

    return (
        <GradientBackground>
            <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
                <Animated.View entering={FadeInDown.duration(500).springify()}>
                    <LinearGradient
                        colors={featureColors.quiz.gradient as [string, string]}
                        style={styles.hero}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                    >
                        <Text style={styles.heroLabel}>YOU MATCHED ON</Text>
                        <Text style={styles.heroScore} testID="quiz-score">
                            {result.score_percent}%
                        </Text>
                        <Text style={styles.heroTagline}>How well do you know each other?</Text>
                    </LinearGradient>
                </Animated.View>

                <View style={styles.breakdown}>
                    {result.questions.map((question) => (
                        <GlassCard key={question.question_id} style={styles.questionCard}>
                            <Text style={styles.questionPrompt}>{question.prompt_self}</Text>
                            <View style={styles.resultRow}>
                                <Ionicons
                                    name={question.i_guessed_right ? "checkmark-circle" : "close-circle"}
                                    size={18}
                                    color={question.i_guessed_right ? colors.success : colors.error}
                                />
                                <Text style={styles.resultText}>
                                    {question.i_guessed_right ? "You guessed right" : "You guessed wrong"}
                                </Text>
                            </View>
                            <View style={styles.resultRow}>
                                <Ionicons
                                    name={question.partner_guessed_right ? "checkmark-circle" : "close-circle"}
                                    size={18}
                                    color={question.partner_guessed_right ? colors.success : colors.error}
                                />
                                <Text style={styles.resultText}>
                                    {question.partner_guessed_right
                                        ? "Your partner guessed right"
                                        : "Your partner guessed wrong"}
                                </Text>
                            </View>
                        </GlassCard>
                    ))}
                </View>

                <GlassButton
                    onPress={onShare}
                    fullWidth
                    size="lg"
                    style={styles.shareButton}
                    icon={<Ionicons name="share-outline" size={20} color={colors.text} />}
                    testID="quiz-share"
                >
                    Share your score
                </GlassButton>

                <GlassButton
                    variant="secondary"
                    onPress={onNewQuiz}
                    loading={isStarting}
                    disabled={isStarting}
                    fullWidth
                    style={styles.newQuizButton}
                >
                    Take another quiz
                </GlassButton>
            </ScrollView>
        </GradientBackground>
    );
}

const styles = StyleSheet.create({
    loadingContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        gap: spacing.md,
    },
    loadingText: {
        ...typography.body,
        color: colors.textSecondary,
    },
    container: {
        paddingHorizontal: spacing.lg,
        paddingTop: 60,
        paddingBottom: spacing.xxl,
    },
    hero: {
        borderRadius: radius.xl,
        paddingVertical: spacing.xl,
        paddingHorizontal: spacing.lg,
        alignItems: "center",
        marginBottom: spacing.lg,
    },
    heroLabel: {
        ...typography.caption1,
        fontWeight: "600",
        letterSpacing: 3,
        color: "rgba(255, 255, 255, 0.85)",
        marginBottom: spacing.xs,
    },
    heroScore: {
        ...typography.largeTitle,
        fontSize: 56,
        lineHeight: 64,
        color: colors.text,
        fontWeight: "800",
    },
    heroTagline: {
        ...typography.subhead,
        color: "rgba(255, 255, 255, 0.85)",
        marginTop: spacing.xs,
    },
    breakdown: {
        gap: spacing.sm,
        marginBottom: spacing.xl,
    },
    questionCard: {
        gap: spacing.xs,
    },
    questionPrompt: {
        ...typography.subhead,
        color: colors.text,
        fontWeight: "600",
        marginBottom: spacing.xs,
    },
    resultRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
    },
    resultText: {
        ...typography.caption1,
        color: colors.textSecondary,
    },
    shareButton: {
        marginBottom: spacing.md,
    },
    newQuizButton: {},
});
