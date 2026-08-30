import { describe, expect, it } from 'vitest';
import { computeQuizScore, type QuizAnswerPair } from '../src/domains/quiz/service.js';

function pair(overrides: Partial<QuizAnswerPair> = {}): QuizAnswerPair {
  return {
    questionId: 'q1',
    aSelfIndex: 0,
    aGuessIndex: 0,
    bSelfIndex: 0,
    bGuessIndex: 0,
    ...overrides,
  };
}

describe('computeQuizScore', () => {
  it('scores 100% when every guess matches the partner self-answer in both directions', () => {
    const pairs: QuizAnswerPair[] = [
      pair({ questionId: 'q1', aSelfIndex: 1, aGuessIndex: 2, bSelfIndex: 2, bGuessIndex: 1 }),
      pair({ questionId: 'q2', aSelfIndex: 0, aGuessIndex: 3, bSelfIndex: 3, bGuessIndex: 0 }),
    ];
    const { scorePercent } = computeQuizScore(pairs);
    expect(scorePercent).toBe(100);
  });

  it('scores 0% when nobody guesses their partner correctly', () => {
    const pairs: QuizAnswerPair[] = [
      pair({ questionId: 'q1', aSelfIndex: 1, aGuessIndex: 0, bSelfIndex: 2, bGuessIndex: 3 }),
    ];
    expect(computeQuizScore(pairs).scorePercent).toBe(0);
  });

  it('counts each direction independently, so a half-right couple lands at 50%', () => {
    // A guesses B correctly, but B guesses A incorrectly: one hit out of two possible.
    const pairs: QuizAnswerPair[] = [
      pair({ questionId: 'q1', aSelfIndex: 1, aGuessIndex: 2, bSelfIndex: 2, bGuessIndex: 0 }),
    ];
    const result = computeQuizScore(pairs);
    expect(result.scorePercent).toBe(50);
    expect(result.perQuestion[0]).toMatchObject({ aGuessedRight: true, bGuessedRight: false });
  });

  it('rounds to the nearest whole percent', () => {
    // 1 hit out of 6 possible (3 questions * 2 directions) = 16.67%, rounds to 17.
    const pairs: QuizAnswerPair[] = [
      // aGuess (0) matches bSelf (0): one hit. bGuess (3) does not match aSelf (1).
      pair({ questionId: 'q1', aSelfIndex: 1, aGuessIndex: 0, bSelfIndex: 0, bGuessIndex: 3 }),
      pair({ questionId: 'q2', aSelfIndex: 0, aGuessIndex: 3, bSelfIndex: 0, bGuessIndex: 3 }),
      pair({ questionId: 'q3', aSelfIndex: 0, aGuessIndex: 3, bSelfIndex: 0, bGuessIndex: 3 }),
    ];
    expect(computeQuizScore(pairs).scorePercent).toBe(17);
  });

  it('returns 0% for an empty question set instead of dividing by zero', () => {
    expect(computeQuizScore([]).scorePercent).toBe(0);
  });
});
