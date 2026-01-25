import { StyleSheet, View } from "react-native";

import { radius, shadows } from "../../../theme";
import type { PackInfo } from "../types";
import { SwipeQuestionCard } from "./SwipeQuestionCard";
import type { AnswerType } from "../../../types";
import type { ResponseData } from "../types";

interface SwipeCardStackProps {
    questions: any[];
    currentIndex: number;
    getPackInfo: (question: any) => PackInfo | null;
    user: { id: string; name?: string | null; avatar_url?: string | null } | null;
    partner: { id: string; name?: string | null; avatar_url?: string | null } | null;
    onAnswer: (questionId: string, answer: AnswerType | 'skip', responseData?: ResponseData) => void;
    onReport: (questionId: string, questionText: string) => void;
}

export const SwipeCardStack = ({
    questions,
    currentIndex,
    getPackInfo,
    user,
    partner,
    onAnswer,
    onReport,
}: SwipeCardStackProps) => {
    const activeQuestion = questions[currentIndex];

    return (
        <View style={styles.cardContainer}>
            {questions[currentIndex + 2] && (
                <View style={[styles.stackCard, styles.stackCardThird]} />
            )}

            {questions[currentIndex + 1] && (
                <View style={[styles.stackCard, styles.stackCardSecond]} />
            )}

            {activeQuestion && (
                <SwipeQuestionCard
                    question={activeQuestion}
                    packInfo={getPackInfo(activeQuestion)}
                    user={user}
                    partner={partner}
                    onAnswer={onAnswer}
                    onReport={onReport}
                />
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    cardContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
    },
    stackCard: {
        position: "absolute",
        width: "85%",
        height: "85%",
        backgroundColor: '#0d0d1a',
        borderRadius: radius.xl,
        borderWidth: 1,
        borderColor: 'rgba(212, 175, 55, 0.15)',
    },
    stackCardSecond: {
        transform: [{ scale: 0.95 }, { translateY: 12 }],
        opacity: 0.4,
        ...shadows.md,
    },
    stackCardThird: {
        transform: [{ scale: 0.90 }, { translateY: 24 }],
        opacity: 0.2,
        ...shadows.sm,
    },
});
