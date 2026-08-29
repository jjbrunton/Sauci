import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect, useLocalSearchParams } from "expo-router";

import { useAuthStore, usePacksStore, useResponsesStore, useStreakStore } from "../../../store";
import { skipQuestion, getSkippedQuestionIds } from "../../../lib/skippedQuestions";
import { ApiError, apiClient } from "../../../lib/apiClient";
import { Events } from "../../../lib/analytics";
import type { AnswerType } from "../../../types";
import type { DailyLimitInfo, PackInfo, ResponseData } from "../types";
import {
    fetchAnswerGapStatus,
    fetchDailyLimitStatus,
    fetchPackContext,
    fetchPendingQuestions,
    fetchRecommendedQuestions,
    uploadResponseMedia,
} from "../services/swipeService";
import {
    buildPackInfo,
    calculateEffectiveTotal,
    filterSupportedQuestions,
    getCountdownState,
    resolveResponseData,
} from "../utils/useSwipeScreen-helpers";

interface GapInfo {
    unanswered: number;
    threshold: number;
}

export const useSwipeScreen = () => {
    const params = useLocalSearchParams();
    const packId = Array.isArray(params.packId) ? params.packId[0] : params.packId;
    const mode = Array.isArray(params.mode) ? params.mode[0] : params.mode;
    const startQuestionId = Array.isArray(params.startQuestionId) ? params.startQuestionId[0] : params.startQuestionId;

    const [questions, setQuestions] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [feedbackQuestion, setFeedbackQuestion] = useState<{ id: string; text: string } | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [isBlocked, setIsBlocked] = useState(false);
    const [gapInfo, setGapInfo] = useState<GapInfo | null>(null);
    const [dailyLimitInfo, setDailyLimitInfo] = useState<DailyLimitInfo | null>(null);
    const [showPaywall, setShowPaywall] = useState(false);
    const [packContext, setPackContext] = useState<{ name: string; icon: string } | null>(null);
    const [showConfetti, setShowConfetti] = useState(false);
    const [countdown, setCountdown] = useState<string>("");

    const { enabledPackIds, ensureEnabledPacksLoaded, packs } = usePacksStore();
    const { user, partner, couple } = useAuthStore();

    const filteredQuestions = filterSupportedQuestions(questions);

    const hasTrackedExhausted = useRef(false);
    const fetchRequestId = useRef(0);
    const lastFetchedMode = useRef<string | undefined>(undefined);
    const isFirstMount = useRef(true);

    const checkAnswerGap = useCallback(async (): Promise<boolean> => {
        if (!couple || !partner) {
            setIsBlocked(false);
            setGapInfo(null);
            return false;
        }

        try {
            const result = await fetchAnswerGapStatus();

            if (result) {
                setIsBlocked(result.is_blocked);
                if (result.threshold > 0) {
                    setGapInfo({
                        unanswered: result.unanswered_by_partner,
                        threshold: result.threshold,
                    });
                } else {
                    setGapInfo(null);
                }
                return result.is_blocked;
            }

            setIsBlocked(false);
            setGapInfo(null);
            return false;
        } catch (error) {
            console.error('Failed to check answer gap:', error);
            setIsBlocked(false);
            setGapInfo(null);
            return false;
        }
    }, [couple, partner]);

    const checkDailyLimit = useCallback(async (): Promise<boolean> => {
        try {
            const result = await fetchDailyLimitStatus();

            if (result) {
                setDailyLimitInfo(result);
                return result.is_blocked;
            }

            setDailyLimitInfo(null);
            return false;
        } catch (error) {
            console.error('Failed to check daily limit:', error);
            setDailyLimitInfo(null);
            return false;
        }
    }, []);

    const fetchQuestions = useCallback(async () => {
        const currentRequestId = ++fetchRequestId.current;

        try {
            const [data, skippedIds] = await Promise.all([
                fetchRecommendedQuestions(packId || undefined),
                getSkippedQuestionIds(),
            ]);

            if (currentRequestId !== fetchRequestId.current) {
                return;
            }

            let filtered = (data || []).filter((q: any) => !skippedIds.has(q.id));

            if (filtered.length === 0 && data && data.length > 0) {
                filtered = data;
            }

            if (partner) {
                // The daily limit applies to pack browsing too, so it is read in both
                // modes; the answer gap is deliberately only enforced outside packs.
                if (packId) {
                    setIsBlocked(false);
                    setGapInfo(null);
                    await checkDailyLimit();
                } else {
                    await Promise.all([checkAnswerGap(), checkDailyLimit()]);
                }
            } else {
                setIsBlocked(false);
                setGapInfo(null);
                setDailyLimitInfo(null);
            }

            if (currentRequestId === fetchRequestId.current) {
                setQuestions(filtered);
            }
        } catch (error) {
            if (currentRequestId === fetchRequestId.current) {
                console.error(error);
            }
        } finally {
            if (currentRequestId === fetchRequestId.current) {
                setIsLoading(false);
            }
        }
    }, [packId, partner, checkAnswerGap, checkDailyLimit]);

    const fetchPending = useCallback(async () => {
        const currentRequestId = ++fetchRequestId.current;
        const userId = useAuthStore.getState().user?.id;
        const coupleId = useAuthStore.getState().user?.couple_id;

        if (!coupleId || !userId) {
            if (currentRequestId === fetchRequestId.current) {
                setQuestions([]);
                setIsLoading(false);
            }
            return;
        }

        try {
            const orderedQuestions = await fetchPendingQuestions({
                userId,
                coupleId,
                startQuestionId: startQuestionId || undefined,
            });

            if (currentRequestId === fetchRequestId.current) {
                setQuestions(orderedQuestions);
                setCurrentIndex(0);
                setIsBlocked(false);
                setGapInfo(null);
                setDailyLimitInfo(null);
            }
        } catch (error) {
            if (currentRequestId === fetchRequestId.current) {
                console.error("Failed to fetch pending questions:", error);
                setQuestions([]);
            }
        } finally {
            if (currentRequestId === fetchRequestId.current) {
                setIsLoading(false);
            }
        }
    }, [startQuestionId]);

    useEffect(() => {
        if (!dailyLimitInfo?.is_blocked || !dailyLimitInfo.reset_at) {
            setCountdown("");
            return;
        }

        const updateCountdown = () => {
            const { expired, text } = getCountdownState(dailyLimitInfo.reset_at);
            setCountdown(text);

            if (expired) {
                fetchQuestions();
            }
        };

        updateCountdown();
        const interval = setInterval(updateCountdown, 1000);

        return () => clearInterval(interval);
    }, [dailyLimitInfo?.is_blocked, dailyLimitInfo?.reset_at, fetchQuestions]);

    useEffect(() => {
        setCurrentIndex(0);
        setIsLoading(true);
        setIsBlocked(false);
        setGapInfo(null);
        hasTrackedExhausted.current = false;
        lastFetchedMode.current = mode;

        ensureEnabledPacksLoaded().then(() => {
            if (mode === 'pending') {
                fetchPending();
            } else {
                fetchQuestions();
            }
        });
    }, [packId, mode, startQuestionId, ensureEnabledPacksLoaded, fetchQuestions, fetchPending]);

    useEffect(() => {
        if (!packId) {
            setPackContext(null);
            return;
        }

        const loadPackContext = async () => {
            try {
                const context = await fetchPackContext(packId);
                setPackContext(context);
            } catch (error) {
                console.error('Failed to fetch pack context:', error);
                setPackContext(null);
            }
        };

        loadPackContext();
    }, [packId]);

    useFocusEffect(
        useCallback(() => {
            if (isFirstMount.current) {
                isFirstMount.current = false;
                return;
            }
            if (lastFetchedMode.current !== mode) {
                return;
            }
            if (mode === 'pending') {
                fetchPending();
            } else {
                fetchQuestions();
            }
        }, [mode, fetchPending, fetchQuestions])
    );

    useEffect(() => {
        if (filteredQuestions.length > 0 && currentIndex >= filteredQuestions.length && !hasTrackedExhausted.current) {
            hasTrackedExhausted.current = true;
            Events.allQuestionsExhausted();
        }
    }, [currentIndex, filteredQuestions.length]);

    useEffect(() => {
        if (!packId && mode !== 'pending' && enabledPackIds.length > 0 && questions.length > 0) {
            const enabledSet = new Set(enabledPackIds);
            setQuestions(prev => {
                const filtered = prev.filter(q => enabledSet.has(q.pack_id));
                if (currentIndex >= filtered.length && filtered.length > 0) {
                    setCurrentIndex(filtered.length - 1);
                }
                return filtered;
            });
        }
    }, [enabledPackIds, mode, packId, questions.length, currentIndex]);

    const effectiveTotal = calculateEffectiveTotal(
        filteredQuestions.length,
        gapInfo,
        dailyLimitInfo,
        currentIndex
    );

    const handleAnswer = useCallback(async (questionId: string, answer: AnswerType | 'skip', responseData?: ResponseData) => {
        if (answer === 'skip') {
            setCurrentIndex(prev => prev + 1);
            await skipQuestion(questionId);
            Events.questionSkipped();
            return;
        }

        try {
            const finalResponseData = await resolveResponseData({
                responseData,
                questionId,
                userId: user?.id,
                setIsUploading,
                uploadResponseMedia,
            });

            const data = await apiClient.post<{ match: unknown | null }>("/v1/responses", {
                question_id: questionId,
                answer,
                response_data: finalResponseData,
            });

            Events.questionAnswered(answer, filteredQuestions[currentIndex]?.pack_id);

            const hasMatch = data?.match != null;

            if (hasMatch) {
                setShowConfetti(true);
            } else {
                setCurrentIndex(prev => prev + 1);
            }

            if (mode !== 'pending') {
                if (dailyLimitInfo && dailyLimitInfo.limit_value > 0) {
                    setDailyLimitInfo(prev => prev ? {
                        ...prev,
                        responses_today: prev.responses_today + 1,
                        remaining: Math.max(0, prev.remaining - 1),
                        is_blocked: prev.responses_today + 1 >= prev.limit_value,
                    } : null);
                }

                await Promise.all([checkAnswerGap(), checkDailyLimit()]);
            } else {
                // Catch-up answers are exempt from the cap, but the partner may have
                // answered after this screen loaded, so re-read rather than assume.
                await checkDailyLimit();
            }

            // The shared streak turns on today's answers, so a stale badge would show the
            // wrong partner state for the rest of the session. Refreshing it must never
            // interfere with recording the answer, so it stays off the critical path.
            void useStreakStore.getState().fetchStreak().catch(() => undefined);

            // This answer changed pack progress and the answer history. Marking their
            // caches stale costs no request: whichever screen the user opens next
            // reloads once, and the ones they do not open stay quiet.
            usePacksStore.getState().invalidatePacks();
            useResponsesStore.getState().invalidateResponses();
        } catch (error) {
            // A 429 means the server rejected this answer outright. Do not advance the
            // index, or the question is silently skipped and lost for the day.
            if (error instanceof ApiError && error.status === 429) {
                // ApiError.details carries the whole response body: { error, details }.
                const body = (error.details ?? {}) as {
                    details?: {
                        daily_limit?: number;
                        responses_today?: number;
                        remaining?: number;
                        reset_at?: string;
                    };
                };
                const details = body.details ?? {};
                setDailyLimitInfo(prev => ({
                    responses_today: details.responses_today ?? prev?.responses_today ?? 0,
                    limit_value: details.daily_limit ?? prev?.limit_value ?? 0,
                    remaining: details.remaining ?? 0,
                    reset_at: details.reset_at ?? prev?.reset_at ?? '',
                    is_blocked: true,
                }));
                return;
            }

            console.error("Failed to submit response", error);
            setCurrentIndex(prev => prev + 1);
        }
    }, [checkAnswerGap, checkDailyLimit, currentIndex, dailyLimitInfo, filteredQuestions, mode, user?.id]);

    const handleConfettiComplete = useCallback(() => {
        setShowConfetti(false);
        setCurrentIndex(prev => prev + 1);
    }, []);

    const getQuestionPackInfo = useCallback(
        (question: any): PackInfo | null =>
            buildPackInfo({
                packId,
                packContext,
                packs,
                question,
            }),
        [packContext, packId, packs]
    );

    return {
        packId,
        mode,
        startQuestionId,
        questions,
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
    };
};
