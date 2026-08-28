export type Answer = 'yes' | 'no' | 'maybe';
export type QuestionType = 'swipe' | 'text_answer' | 'audio' | 'photo' | 'who_likely';
export type MatchType = 'yes_yes' | 'yes_maybe' | 'maybe_maybe' | 'both_answered';
export type ResponseData = Record<string, unknown> | null;

export interface QuestionRef {
  id: string;
  question_type: QuestionType;
}

export function calculateMatchType(question: QuestionRef, first: Answer, second: Answer): MatchType | null {
  if (question.question_type === 'swipe') {
    if (first === 'no' || second === 'no') return null;
    if (first === 'yes' && second === 'yes') return 'yes_yes';
    if (first === 'maybe' && second === 'maybe') return 'maybe_maybe';
    return 'yes_maybe';
  }
  if (question.question_type === 'who_likely') return 'both_answered';
  return first === 'no' || second === 'no' ? null : 'both_answered';
}

export class AnswersError extends Error {
  constructor(
    readonly code: 'no_couple' | 'question_not_found' | 'question_not_eligible' | 'response_not_found' | 'daily_limit' | 'match_not_found',
    readonly status: 400 | 404 | 409 | 429,
    message: string,
    readonly details?: Record<string, unknown>,
  ) { super(message); }
}
