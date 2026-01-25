import { Platform, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";

import { GradientBackground } from "../../components/ui";
import { QuestionFeedbackModal } from "../../components/feedback";
import { MatchConfetti } from "../../components/MatchConfetti";
import { Paywall } from "../../components/paywall";
import { useSwipeScreen } from "./hooks/useSwipeScreen";
import { SwipeCardStack } from "./components/SwipeCardStack";
import { SwipeHeader } from "./components/SwipeHeader";
import { SwipeUploadOverlay } from "./components/SwipeUploadOverlay";
import { SwipeLoadingState } from "./components/SwipeLoadingState";
import { SwipeNoPartnerState } from "./components/SwipeNoPartnerState";
import { SwipeDailyLimitState } from "./components/SwipeDailyLimitState";
import { SwipeBlockedState } from "./components/SwipeBlockedState";
import { SwipeNoPacksState } from "./components/SwipeNoPacksState";
import { SwipeCaughtUpState } from "./components/SwipeCaughtUpState";

const SwipeScreen = () => {
    const router = useRouter();
    const {
        packId,
        mode,
        filteredQuestions,
        currentIndex,
        feedbackQuestion,
        isLoading,
        isUploading,
        isBlocked,
        gapInfo,
        dailyLimitInfo,
        showPaywall,
        packContext,
        showConfetti,
        countdown,
        user,
        partner,
        couple,
        enabledPackIds,
        effectiveTotal,
        fetchQuestions,
        handleAnswer,
        handleConfettiComplete,
        getQuestionPackInfo,
        checkAnswerGap,
        setFeedbackQuestion,
        setShowPaywall,
    } = useSwipeScreen();

    if (isLoading) {
        return <SwipeLoadingState />;
    }

    if (!partner) {
        return (
            <SwipeNoPartnerState
                hasCouple={!!couple}
                onPairPress={() => router.push("/pairing")}
            />
        );
    }

    if (dailyLimitInfo?.is_blocked) {
        return (
            <SwipeDailyLimitState
                dailyLimitInfo={dailyLimitInfo}
                countdown={countdown}
                showPaywall={showPaywall}
                onShowPaywall={() => setShowPaywall(true)}
                onClosePaywall={() => setShowPaywall(false)}
                onPaywallSuccess={() => {
                    setShowPaywall(false);
                    fetchQuestions();
                }}
            />
        );
    }

    if (isBlocked && gapInfo) {
        return (
            <SwipeBlockedState
                unansweredCount={gapInfo.unanswered}
                onCheckAgain={checkAnswerGap}
            />
        );
    }

    if (!packId && enabledPackIds.length === 0) {
        return (
            <SwipeNoPacksState onBrowsePacks={() => router.push("/")} />
        );
    }

    if (currentIndex >= filteredQuestions.length) {
        return (
            <SwipeCaughtUpState
                isPendingMode={mode === 'pending'}
                isPackMode={!!packId}
                packName={packContext?.name}
                onViewMatches={() => router.push("/(app)/matches")}
                onBackToHome={() => router.push("/")}
                onRefresh={fetchQuestions}
            />
        );
    }

    return (
        <GradientBackground>
            <View style={styles.container}>
                <SwipeHeader
                    currentIndex={currentIndex}
                    effectiveTotal={effectiveTotal}
                    totalQuestions={filteredQuestions.length}
                    mode={mode}
                    packContext={packContext}
                    showBackButton={!!packId || mode === 'pending'}
                    onBack={() => router.back()}
                />

                <SwipeCardStack
                    questions={filteredQuestions}
                    currentIndex={currentIndex}
                    getPackInfo={getQuestionPackInfo}
                    user={user}
                    partner={partner}
                    onAnswer={handleAnswer}
                    onReport={(questionId, questionText) => setFeedbackQuestion({ id: questionId, text: questionText })}
                />

                <View style={styles.bottomSpacer} />
            </View>

            <QuestionFeedbackModal
                visible={!!feedbackQuestion}
                onClose={() => setFeedbackQuestion(null)}
                questionId={feedbackQuestion?.id || ''}
                questionText={feedbackQuestion?.text || ''}
            />

            <MatchConfetti
                visible={showConfetti}
                onAnimationComplete={handleConfettiComplete}
            />

            <Paywall
                visible={showPaywall}
                onClose={() => setShowPaywall(false)}
                onSuccess={() => {
                    setShowPaywall(false);
                    fetchQuestions();
                }}
            />

            {isUploading && <SwipeUploadOverlay />}
        </GradientBackground>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    bottomSpacer: {
        height: Platform.OS === 'ios' ? 100 : 80,
    },
});

export default SwipeScreen;
