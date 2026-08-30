/**
 * One partner's guess of the other's self-answer, for a single question. Scoring
 * always runs both directions: A guessing B and B guessing A each count separately,
 * so a couple who only ever gets half the guesses right lands at 50%, not 100%.
 */
export interface QuizAnswerPair {
  questionId: string;
  aSelfIndex: number;
  aGuessIndex: number;
  bSelfIndex: number;
  bGuessIndex: number;
}

export interface QuizScoreQuestionResult extends QuizAnswerPair {
  aGuessedRight: boolean;
  bGuessedRight: boolean;
}

export interface QuizScoreResult {
  scorePercent: number;
  perQuestion: QuizScoreQuestionResult[];
}

/**
 * Pure scoring function for a completed quiz session. Each question contributes
 * up to two hits (partner A's guess about B, and B's guess about A), so the
 * denominator is twice the question count.
 */
export function computeQuizScore(pairs: QuizAnswerPair[]): QuizScoreResult {
  const perQuestion = pairs.map((pair) => ({
    ...pair,
    aGuessedRight: pair.aGuessIndex === pair.bSelfIndex,
    bGuessedRight: pair.bGuessIndex === pair.aSelfIndex,
  }));
  const hits = perQuestion.reduce(
    (sum, question) => sum + (question.aGuessedRight ? 1 : 0) + (question.bGuessedRight ? 1 : 0),
    0,
  );
  const scorePercent = pairs.length === 0 ? 0 : Math.round((100 * hits) / (2 * pairs.length));
  return { scorePercent, perQuestion };
}
