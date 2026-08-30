import { apiClient, ApiError } from "../../../lib/apiClient";
import type { QuizAnswer, QuizErrorCode, QuizResult, QuizSession } from "../types";

const sessionPath = (sessionId: string) => `/v1/quiz/sessions/${encodeURIComponent(sessionId)}`;

export const quizApi = {
    startSession: () => apiClient.post<{ session: QuizSession }>("/v1/quiz/sessions"),
    getCurrentSession: () => apiClient.get<{ session: QuizSession | null }>("/v1/quiz/sessions/current"),
    submitAnswers: (sessionId: string, answers: QuizAnswer[]) =>
        apiClient.post<{ session: QuizSession }>(`${sessionPath(sessionId)}/answers`, { answers }),
    getResult: (sessionId: string) => apiClient.get<QuizResult>(`${sessionPath(sessionId)}/result`),
};

/**
 * Reads the API's `{ error: { code } }` body out of an `ApiError`, so callers can
 * branch on the contract's error codes instead of matching on message text.
 */
export function getQuizErrorCode(error: unknown): QuizErrorCode | null {
    if (!(error instanceof ApiError)) return null;
    const body = error.details as { error?: { code?: string } } | undefined;
    const code = body?.error?.code;
    return typeof code === "string" ? (code as QuizErrorCode) : null;
}
