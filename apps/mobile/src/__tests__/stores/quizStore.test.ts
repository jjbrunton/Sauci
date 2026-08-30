import { ApiError } from "@/lib/apiClient";
import { quizApi } from "@/features/quiz/services/quizApi";
import { useQuizStore } from "@/store/quizStore";
import type { QuizSession } from "@/features/quiz/types";

jest.mock("@/features/quiz/services/quizApi", () => ({
    quizApi: {
        startSession: jest.fn(),
        getCurrentSession: jest.fn(),
        submitAnswers: jest.fn(),
        getResult: jest.fn(),
    },
    getQuizErrorCode: (error: unknown) => {
        const { ApiError: RealApiError } = jest.requireActual("@/lib/apiClient");
        if (!(error instanceof RealApiError)) return null;
        const details = (error as { details?: unknown }).details as { error?: { code?: string } } | undefined;
        return details?.error?.code ?? null;
    },
}));

function session(overrides: Partial<QuizSession> = {}): QuizSession {
    return {
        id: "session-1",
        status: "active",
        created_at: "2026-08-01T00:00:00.000Z",
        completed_at: null,
        score_percent: null,
        questions: [
            { id: "q1", prompt_self: "Self 1", prompt_guess: "Guess 1", options: ["A", "B"] },
            { id: "q2", prompt_self: "Self 2", prompt_guess: "Guess 2", options: ["A", "B"] },
        ],
        my_answers: [],
        partner_completed: false,
        i_completed: false,
        ...overrides,
    };
}

const resetStore = () =>
    useQuizStore.setState({
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
    });

describe("quizStore", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        resetStore();
    });

    it("starts a new session and resets local answers/result", async () => {
        (quizApi.startSession as jest.Mock).mockResolvedValue({ session: session() });
        await useQuizStore.getState().start();

        expect(useQuizStore.getState().session?.id).toBe("session-1");
        expect(useQuizStore.getState().localAnswers).toEqual({});
        expect(useQuizStore.getState().isStarting).toBe(false);
    });

    it("records local self and guess answers per question without submitting early", () => {
        useQuizStore.setState({ session: session() });
        useQuizStore.getState().setSelfAnswer("q1", 0);
        useQuizStore.getState().setGuessAnswer("q1", 1);

        expect(useQuizStore.getState().localAnswers.q1).toEqual({ self_index: 0, guess_index: 1 });
        expect(quizApi.submitAnswers).not.toHaveBeenCalled();
    });

    it("submits the full answer set built from local answers and stores the returned session", async () => {
        useQuizStore.setState({
            session: session(),
            localAnswers: {
                q1: { self_index: 0, guess_index: 1 },
                q2: { self_index: 1, guess_index: 0 },
            },
        });
        const updated = session({ i_completed: true });
        (quizApi.submitAnswers as jest.Mock).mockResolvedValue({ session: updated });

        const ok = await useQuizStore.getState().submit();

        expect(ok).toBe(true);
        expect(quizApi.submitAnswers).toHaveBeenCalledWith("session-1", [
            { question_id: "q1", self_index: 0, guess_index: 1 },
            { question_id: "q2", self_index: 1, guess_index: 0 },
        ]);
        expect(useQuizStore.getState().session?.i_completed).toBe(true);
        expect(useQuizStore.getState().localAnswers).toEqual({});
    });

    it("surfaces a pairing error code instead of a generic message", async () => {
        (quizApi.getCurrentSession as jest.Mock).mockRejectedValue(
            new ApiError("no_couple", 409, { error: { code: "no_couple" } }),
        );

        await useQuizStore.getState().load();

        expect(useQuizStore.getState().errorCode).toBe("no_couple");
        expect(useQuizStore.getState().error).toBeNull();
    });

    it("clearQuiz resets all state and invalidates any in-flight request (sign-out)", async () => {
        let resolve!: (value: unknown) => void;
        (quizApi.getCurrentSession as jest.Mock).mockReturnValueOnce(
            new Promise((done) => {
                resolve = done;
            }),
        );
        const staleLoad = useQuizStore.getState().load();

        useQuizStore.getState().clearQuiz();
        resolve({ session: session({ id: "stale-session" }) });
        await staleLoad;

        expect(useQuizStore.getState().session).toBeNull();
        expect(useQuizStore.getState().generation).toBe(1);
    });
});
