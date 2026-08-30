import { create } from "zustand";
import { Events } from "../lib/analytics";
import { getQuizErrorCode, quizApi } from "../features/quiz/services/quizApi";
import type { QuizAnswer, QuizErrorCode, QuizLocalAnswer, QuizResult, QuizSession } from "../features/quiz/types";

interface QuizState {
    session: QuizSession | null;
    result: QuizResult | null;
    /** In-progress answers for the active session, keyed by question id, not yet submitted. */
    localAnswers: Record<string, QuizLocalAnswer>;
    isLoading: boolean;
    isStarting: boolean;
    isSubmitting: boolean;
    isLoadingResult: boolean;
    /** Set when the couple/partner state blocks the quiz (`no_couple`, `partner_required`). */
    errorCode: QuizErrorCode | null;
    error: string | null;
    /** Bumped on clear/sign-out so a response that outlives it cannot write into the next account's store. */
    generation: number;

    load: () => Promise<void>;
    start: () => Promise<void>;
    setSelfAnswer: (questionId: string, index: number) => void;
    setGuessAnswer: (questionId: string, index: number) => void;
    submit: () => Promise<boolean>;
    loadResult: () => Promise<void>;
    reset: () => void;
    clearQuiz: () => void;
}

export const useQuizStore = create<QuizState>((set, get) => ({
    session: null,
    result: null,
    localAnswers: {},
    isLoading: false,
    isStarting: false,
    isSubmitting: false,
    isLoadingResult: false,
    errorCode: null,
    error: null,
    generation: 0,

    load: async () => {
        const myGeneration = get().generation;
        set({ isLoading: true, error: null, errorCode: null });
        try {
            const { session } = await quizApi.getCurrentSession();
            if (get().generation !== myGeneration) return;
            set({ session, isLoading: false, localAnswers: {} });
        } catch (cause) {
            if (get().generation !== myGeneration) return;
            const code = getQuizErrorCode(cause);
            console.error("Error loading quiz session:", cause);
            set({ isLoading: false, errorCode: code, error: code ? null : "Could not load your quiz" });
        }
    },

    start: async () => {
        const myGeneration = get().generation;
        set({ isStarting: true, error: null, errorCode: null });
        try {
            const { session } = await quizApi.startSession();
            if (get().generation !== myGeneration) return;
            set({ session, result: null, localAnswers: {}, isStarting: false });
            Events.quizStarted();
        } catch (cause) {
            if (get().generation !== myGeneration) return;
            const code = getQuizErrorCode(cause);
            console.error("Error starting quiz:", cause);
            set({ isStarting: false, errorCode: code, error: code ? null : "Could not start the quiz" });
        }
    },

    setSelfAnswer: (questionId, index) => {
        set((state) => ({
            localAnswers: {
                ...state.localAnswers,
                [questionId]: { ...state.localAnswers[questionId], self_index: index },
            },
        }));
    },

    setGuessAnswer: (questionId, index) => {
        set((state) => ({
            localAnswers: {
                ...state.localAnswers,
                [questionId]: { ...state.localAnswers[questionId], guess_index: index },
            },
        }));
    },

    submit: async () => {
        const state = get();
        const session = state.session;
        if (!session) return false;

        const answers: QuizAnswer[] = session.questions.map((question) => {
            const local = state.localAnswers[question.id] ?? {};
            return {
                question_id: question.id,
                self_index: local.self_index ?? -1,
                guess_index: local.guess_index ?? -1,
            };
        });

        const myGeneration = state.generation;
        set({ isSubmitting: true, error: null, errorCode: null });
        try {
            const { session: updated } = await quizApi.submitAnswers(session.id, answers);
            if (get().generation !== myGeneration) return false;
            set({ session: updated, isSubmitting: false, localAnswers: {} });
            if (updated.score_percent !== null) {
                Events.quizCompleted(updated.score_percent);
            }
            return true;
        } catch (cause) {
            if (get().generation !== myGeneration) return false;
            const code = getQuizErrorCode(cause);
            console.error("Error submitting quiz answers:", cause);
            set({ isSubmitting: false, errorCode: code, error: code ? null : "Could not submit your answers" });
            return false;
        }
    },

    loadResult: async () => {
        const session = get().session;
        if (!session) return;

        const myGeneration = get().generation;
        set({ isLoadingResult: true, error: null });
        try {
            const result = await quizApi.getResult(session.id);
            if (get().generation !== myGeneration) return;
            set({ result, isLoadingResult: false });
        } catch (cause) {
            if (get().generation !== myGeneration) return;
            const code = getQuizErrorCode(cause);
            console.error("Error loading quiz result:", cause);
            set({ isLoadingResult: false, errorCode: code, error: code ? null : "Could not load your results" });
        }
    },

    /** Clears the in-memory quiz state without bumping the generation, e.g. after starting a new quiz. */
    reset: () => {
        set({ session: null, result: null, localAnswers: {}, error: null, errorCode: null });
    },

    clearQuiz: () => {
        set((state) => ({
            session: null,
            result: null,
            localAnswers: {},
            isLoading: false,
            isStarting: false,
            isSubmitting: false,
            isLoadingResult: false,
            errorCode: null,
            error: null,
            // Invalidates any request already in flight: its generation check will
            // fail and it will not be able to write into the next account's store.
            generation: state.generation + 1,
        }));
    },
}));
