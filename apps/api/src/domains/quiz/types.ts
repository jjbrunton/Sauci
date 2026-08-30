export type QuizSessionStatus = 'active' | 'completed';

export type QuizErrorCode =
  | 'no_couple'
  | 'partner_required'
  | 'session_not_found'
  | 'session_completed'
  | 'invalid_answers'
  | 'session_not_completed';

export class QuizError extends Error {
  constructor(
    readonly code: QuizErrorCode,
    message: string,
    readonly status: 400 | 404 | 409,
  ) {
    super(message);
    this.name = 'QuizError';
  }
}

export interface QuizAnswerInput {
  question_id: string;
  self_index: number;
  guess_index: number;
}

export interface QuizQuestionSummary {
  id: string;
  prompt_self: string;
  prompt_guess: string;
  options: string[];
}

export interface QuizSessionPayload {
  id: string;
  status: QuizSessionStatus;
  created_at: string;
  completed_at: string | null;
  score_percent: number | null;
  questions: QuizQuestionSummary[];
  my_answers: QuizAnswerInput[];
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

export interface QuizResultPayload {
  score_percent: number;
  completed_at: string | null;
  questions: QuizResultQuestion[];
}
