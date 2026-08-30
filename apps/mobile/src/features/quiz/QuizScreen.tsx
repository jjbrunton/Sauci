import { ActivityIndicator, View, StyleSheet } from "react-native";
import { GradientBackground } from "../../components/ui";
import { featureColors } from "../../theme";
import { SwipeNoPartnerState } from "../swipe/components/SwipeNoPartnerState";
import { useQuizScreen } from "./hooks/useQuizScreen";
import {
    QuizIntro,
    QuizQuestionCard,
    QuizResults,
    QuizShareModal,
    QuizWaitingState,
} from "./components";

export function QuizScreen() {
    const {
        screenState,
        session,
        result,
        currentStep,
        totalQuestions,
        isStarting,
        isSubmitting,
        isLoadingResult,
        shareModalVisible,
        handleSelectOption,
        handleStart,
        handleNewQuiz,
        handleRefresh,
        handlePairPress,
        handleNudgePartner,
        openShareModal,
        closeShareModal,
    } = useQuizScreen();

    if (screenState === "not_paired") {
        return <SwipeNoPartnerState hasCouple={false} onPairPress={handlePairPress} />;
    }

    if (screenState === "loading") {
        return (
            <GradientBackground>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={featureColors.quiz.accent} />
                </View>
            </GradientBackground>
        );
    }

    if (screenState === "intro") {
        return <QuizIntro isStarting={isStarting} onStart={handleStart} />;
    }

    if (screenState === "waiting") {
        return <QuizWaitingState onNudgePartner={handleNudgePartner} onRefresh={handleRefresh} />;
    }

    if (screenState === "results") {
        return (
            <>
                <QuizResults
                    result={result}
                    isLoadingResult={isLoadingResult}
                    isStarting={isStarting}
                    onNewQuiz={handleNewQuiz}
                    onShare={openShareModal}
                />
                <QuizShareModal
                    visible={shareModalVisible}
                    onClose={closeShareModal}
                    scorePercent={result?.score_percent ?? 0}
                />
            </>
        );
    }

    // screenState === "answering"
    if (!session || !currentStep || isSubmitting) {
        return (
            <GradientBackground>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={featureColors.quiz.accent} />
                </View>
            </GradientBackground>
        );
    }

    return (
        <QuizQuestionCard
            question={currentStep.question}
            step={currentStep.step}
            questionNumber={currentStep.questionNumber}
            totalQuestions={totalQuestions}
            onSelectOption={handleSelectOption}
        />
    );
}

const styles = StyleSheet.create({
    loadingContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
    },
});

export default QuizScreen;
