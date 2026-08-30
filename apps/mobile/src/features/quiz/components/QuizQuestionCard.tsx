import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { GlassCard, GradientBackground } from "../../../components/ui";
import { colors, featureColors, radius, spacing, typography } from "../../../theme";
import type { QuizQuestion } from "../types";
import type { QuizAnswerStep } from "../hooks/useQuizScreen";

const ACCENT = featureColors.quiz.accent;

interface QuizQuestionCardProps {
    question: QuizQuestion;
    step: QuizAnswerStep;
    questionNumber: number;
    totalQuestions: number;
    onSelectOption: (index: number) => void;
}

export function QuizQuestionCard({
    question,
    step,
    questionNumber,
    totalQuestions,
    onSelectOption,
}: QuizQuestionCardProps) {
    const prompt = step === "self" ? question.prompt_self : question.prompt_guess;

    return (
        <GradientBackground>
            <View style={styles.container}>
                <Text style={styles.progress} testID="quiz-progress">
                    {questionNumber} of {totalQuestions}
                </Text>

                <View style={styles.stepBadge}>
                    <Text style={styles.stepBadgeText}>{step === "self" ? "YOU" : "YOUR PARTNER"}</Text>
                </View>

                <Animated.View entering={FadeInDown.duration(400).springify()} key={`${question.id}-${step}`}>
                    <GlassCard variant="elevated" style={styles.card}>
                        <Text style={styles.prompt}>{prompt}</Text>
                    </GlassCard>

                    <View style={styles.options}>
                        {question.options.map((option, index) => (
                            <Pressable
                                key={`${question.id}-${index}`}
                                onPress={() => onSelectOption(index)}
                                style={({ pressed }) => [styles.option, pressed && styles.optionPressed]}
                                testID={`quiz-option-${index}`}
                            >
                                <Text style={styles.optionText}>{option}</Text>
                            </Pressable>
                        ))}
                    </View>
                </Animated.View>
            </View>
        </GradientBackground>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingHorizontal: spacing.lg,
        paddingTop: 80,
    },
    progress: {
        ...typography.caption1,
        color: colors.textTertiary,
        textAlign: "center",
        marginBottom: spacing.md,
    },
    stepBadge: {
        alignSelf: "center",
        backgroundColor: colors.backgroundLight,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: radius.full,
        borderWidth: 1,
        borderColor: colors.border,
        marginBottom: spacing.lg,
    },
    stepBadgeText: {
        ...typography.caption2,
        fontWeight: "600",
        letterSpacing: 2,
        color: ACCENT,
    },
    card: {
        marginBottom: spacing.xl,
    },
    prompt: {
        ...typography.title2,
        color: colors.text,
        textAlign: "center",
    },
    options: {
        gap: spacing.md,
    },
    option: {
        backgroundColor: colors.backgroundLight,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: colors.border,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.lg,
    },
    optionPressed: {
        borderColor: ACCENT,
        backgroundColor: colors.background,
    },
    optionText: {
        ...typography.body,
        color: colors.text,
        textAlign: "center",
        fontWeight: "600",
    },
});
