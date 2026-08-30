import { useCallback, useEffect, useMemo, useState } from "react";
import { Share } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useAuthStore } from "../../../store";
import { useQuizStore } from "../../../store/quizStore";
import { Events } from "../../../lib/analytics";
import type { QuizQuestion } from "../types";

export type QuizScreenState = "not_paired" | "loading" | "intro" | "answering" | "waiting" | "results";
export type QuizAnswerStep = "self" | "guess";

export interface CurrentQuizStep {
    question: QuizQuestion;
    step: QuizAnswerStep;
    questionNumber: number;
}

export function useQuizScreen() {
    const router = useRouter();
    const { user, partner } = useAuthStore();
    const {
        session,
        result,
        localAnswers,
        isLoading,
        isStarting,
        isSubmitting,
        isLoadingResult,
        errorCode,
        load,
        start,
        setSelfAnswer,
        setGuessAnswer,
        submit,
        loadResult,
    } = useQuizStore();
    const [shareModalVisible, setShareModalVisible] = useState(false);

    const hasCouple = Boolean(user?.couple_id);
    const hasPartner = Boolean(partner);
    const paired = hasCouple && hasPartner;

    useFocusEffect(
        useCallback(() => {
            if (paired) void load();
        }, [paired, load]),
    );

    const isCompleted = session?.status === "completed";
    const shouldShowResults = isCompleted || (session?.i_completed && session?.partner_completed);

    useEffect(() => {
        if (shouldShowResults && session && !result && !isLoadingResult) {
            void loadResult();
        }
    }, [shouldShowResults, session, result, isLoadingResult, loadResult]);

    const screenState: QuizScreenState = useMemo(() => {
        if (!paired) return "not_paired";
        if (isLoading && !session) return "loading";
        if (!session) return "intro";
        if (shouldShowResults) return "results";
        if (session.i_completed && !session.partner_completed) return "waiting";
        return "answering";
    }, [paired, isLoading, session, shouldShowResults]);

    // The first unanswered step across the question set, in order.
    const currentStep: CurrentQuizStep | null = useMemo(() => {
        if (!session) return null;
        for (let i = 0; i < session.questions.length; i += 1) {
            const question = session.questions[i];
            const answer = localAnswers[question.id];
            if (answer?.self_index === undefined) {
                return { question, step: "self", questionNumber: i + 1 };
            }
            if (answer?.guess_index === undefined) {
                return { question, step: "guess", questionNumber: i + 1 };
            }
        }
        return null;
    }, [session, localAnswers]);

    const totalQuestions = session?.questions.length ?? 0;

    const handleSelectOption = useCallback(
        async (index: number) => {
            if (!currentStep) return;
            const { question, step } = currentStep;
            if (step === "self") {
                setSelfAnswer(question.id, index);
                return;
            }
            setGuessAnswer(question.id, index);

            // The guess just recorded may be the last one needed; submit as soon as
            // every question has both a self and a guess answer.
            const answers = useQuizStore.getState().localAnswers;
            const isLastQuestion = totalQuestions > 0 && currentStep.questionNumber === totalQuestions;
            if (isLastQuestion) {
                const allAnswered = session!.questions.every((q) => {
                    const a = q.id === question.id ? { ...answers[q.id], guess_index: index } : answers[q.id];
                    return a?.self_index !== undefined && a?.guess_index !== undefined;
                });
                if (allAnswered) {
                    await submit();
                }
            }
        },
        [currentStep, setSelfAnswer, setGuessAnswer, submit, totalQuestions, session],
    );

    const handleStart = useCallback(() => {
        void start();
    }, [start]);

    const handleNewQuiz = useCallback(() => {
        void start();
    }, [start]);

    const handleRefresh = useCallback(() => {
        void load();
    }, [load]);

    const handlePairPress = useCallback(() => {
        router.push("/pairing");
    }, [router]);

    const handleNudgePartner = useCallback(async () => {
        try {
            await Share.share({
                message: "I just finished our couple quiz on Sauci, your turn!",
            });
            Events.quizPartnerNudged();
        } catch (err) {
            console.error("Error nudging partner:", err);
        }
    }, []);

    const openShareModal = useCallback(() => setShareModalVisible(true), []);
    const closeShareModal = useCallback(() => setShareModalVisible(false), []);

    return {
        screenState,
        session,
        result,
        currentStep,
        totalQuestions,
        isStarting,
        isSubmitting,
        isLoadingResult,
        isLoading,
        errorCode,
        hasCouple,
        shareModalVisible,
        handleSelectOption,
        handleStart,
        handleNewQuiz,
        handleRefresh,
        handlePairPress,
        handleNudgePartner,
        openShareModal,
        closeShareModal,
    };
}
