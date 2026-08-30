import { act, renderHook, waitFor } from "@testing-library/react-native";
import { useQuizScreen } from "./useQuizScreen";
import { useQuizStore } from "../../../store/quizStore";
import { quizApi } from "../services/quizApi";
import type { QuizSession } from "../types";

const mockRouterPush = jest.fn();
jest.mock("expo-router", () => {
    const React = jest.requireActual("react");
    return {
        useRouter: () => ({ push: mockRouterPush }),
        // Mirrors react-navigation's real semantics closely enough for this hook:
        // runs once per stable callback identity, not on every render.
        useFocusEffect: (callback: () => void) => React.useEffect(callback, [callback]),
    };
});

let mockAuth = { user: { couple_id: null as string | null }, partner: null as { id: string } | null };
jest.mock("../../../store", () => ({
    useAuthStore: () => mockAuth,
}));

jest.mock("../services/quizApi", () => ({
    quizApi: {
        startSession: jest.fn(),
        getCurrentSession: jest.fn(),
        submitAnswers: jest.fn(),
        getResult: jest.fn(),
    },
    getQuizErrorCode: () => null,
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
        ],
        my_answers: [],
        partner_completed: false,
        i_completed: false,
        ...overrides,
    };
}

describe("useQuizScreen", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        useQuizStore.setState({
            session: null, result: null, localAnswers: {},
            isLoading: false, isStarting: false, isSubmitting: false, isLoadingResult: false,
            errorCode: null, error: null, generation: 0,
        });
        mockAuth = { user: { couple_id: null }, partner: null };
    });

    it("shows the not_paired state when the user has no couple or partner", async () => {
        const { result } = renderHook(() => useQuizScreen());
        expect(result.current.screenState).toBe("not_paired");

        act(() => result.current.handlePairPress());
        expect(mockRouterPush).toHaveBeenCalledWith("/pairing");
    });

    it("moves to intro once paired and no active session exists", async () => {
        mockAuth = { user: { couple_id: "couple-1" }, partner: { id: "partner-1" } };
        (quizApi.getCurrentSession as jest.Mock).mockResolvedValue({ session: null });

        const { result } = renderHook(() => useQuizScreen());
        await waitFor(() => expect(result.current.screenState).toBe("intro"));
    });

    it("walks self then guess for each question and submits once all are answered", async () => {
        mockAuth = { user: { couple_id: "couple-1" }, partner: { id: "partner-1" } };
        (quizApi.getCurrentSession as jest.Mock).mockResolvedValue({ session: session() });
        (quizApi.submitAnswers as jest.Mock).mockResolvedValue({
            session: session({ i_completed: true }),
        });

        const { result } = renderHook(() => useQuizScreen());
        await waitFor(() => expect(result.current.screenState).toBe("answering"));
        expect(result.current.currentStep?.step).toBe("self");

        await act(async () => {
            await result.current.handleSelectOption(0);
        });
        expect(result.current.currentStep?.step).toBe("guess");

        await act(async () => {
            await result.current.handleSelectOption(1);
        });

        expect(quizApi.submitAnswers).toHaveBeenCalledWith("session-1", [
            { question_id: "q1", self_index: 0, guess_index: 1 },
        ]);
        await waitFor(() => expect(result.current.screenState).toBe("waiting"));
    });

    it("shows results once the session and both partners have completed", async () => {
        mockAuth = { user: { couple_id: "couple-1" }, partner: { id: "partner-1" } };
        (quizApi.getCurrentSession as jest.Mock).mockResolvedValue({
            session: session({ status: "completed", i_completed: true, partner_completed: true, score_percent: 80 }),
        });
        (quizApi.getResult as jest.Mock).mockResolvedValue({
            score_percent: 80, completed_at: "now", questions: [],
        });

        const { result } = renderHook(() => useQuizScreen());
        await waitFor(() => expect(result.current.screenState).toBe("results"));
        await waitFor(() => expect(result.current.result?.score_percent).toBe(80));
    });
});
