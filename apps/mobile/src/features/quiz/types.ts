export interface QuizQuestion {
    id: string;
    prompt_self: string;
    prompt_guess: string;
    options: string[];
}

export interface QuizAnswer {
    question_id: string;
    self_index: number;
    guess_index: number;
}

export interface QuizSession {
    id: string;
    status: "active" | "completed";
    created_at: string;
    completed_at: string | null;
    score_percent: number | null;
    questions: QuizQuestion[];
    my_answers: QuizAnswer[];
    partner_completed: boolean;
    i_completed: boolean;
}

export interface QuizResultQuestion {
    question_id: string;
    prompt_self: string;
    prompt_guess: string;
    options: string[];
    my_self_index: number;
    my_guess_index: number;
    partner_self_index: number;
    partner_guess_index: number;
    i_guessed_right: boolean;
    partner_guessed_right: boolean;
}

export interface QuizResult {
    score_percent: number;
    completed_at: string;
    questions: QuizResultQuestion[];
}

/** Known error codes the quiz API can surface as `{ error: { code } }`. */
export type QuizErrorCode =
    | "no_couple"
    | "partner_required"
    | "session_not_found"
    | "session_completed"
    | "invalid_answers"
    | "session_not_completed";

/** In-progress local answer for a question, before the full set is submitted. */
export interface QuizLocalAnswer {
    self_index?: number;
    guess_index?: number;
}
