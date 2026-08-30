import { apiClient, ApiError } from "../../../lib/apiClient";
import { getQuizErrorCode, quizApi } from "./quizApi";

jest.mock("../../../lib/apiClient", () => {
    const actual = jest.requireActual("../../../lib/apiClient");
    return {
        ...actual,
        apiClient: { get: jest.fn(), post: jest.fn() },
    };
});

const get = apiClient.get as jest.Mock;
const post = apiClient.post as jest.Mock;

describe("quizApi", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("starts a session against the couple quiz session endpoint", async () => {
        post.mockResolvedValue({ session: { id: "s1" } });
        await quizApi.startSession();
        expect(post).toHaveBeenCalledWith("/v1/quiz/sessions");
    });

    it("reads the current session", async () => {
        get.mockResolvedValue({ session: null });
        await quizApi.getCurrentSession();
        expect(get).toHaveBeenCalledWith("/v1/quiz/sessions/current");
    });

    it("submits the full answer set for a session", async () => {
        post.mockResolvedValue({ session: { id: "s1" } });
        const answers = [{ question_id: "q1", self_index: 0, guess_index: 1 }];
        await quizApi.submitAnswers("s1", answers);
        expect(post).toHaveBeenCalledWith("/v1/quiz/sessions/s1/answers", { answers });
    });

    it("encodes the session id when reading a result", async () => {
        get.mockResolvedValue({ score_percent: 80, completed_at: "now", questions: [] });
        await quizApi.getResult("s1/weird");
        expect(get).toHaveBeenCalledWith("/v1/quiz/sessions/s1%2Fweird/result");
    });
});

describe("getQuizErrorCode", () => {
    it("reads the contract's { error: { code } } body off an ApiError", () => {
        const error = new ApiError("no_couple", 409, { error: { code: "no_couple" } });
        expect(getQuizErrorCode(error)).toBe("no_couple");
    });

    it("returns null for a non-ApiError or a body without a code", () => {
        expect(getQuizErrorCode(new Error("boom"))).toBeNull();
        expect(getQuizErrorCode(new ApiError("oops", 500, {}))).toBeNull();
        expect(getQuizErrorCode(new ApiError("oops", 500, undefined))).toBeNull();
    });
});
