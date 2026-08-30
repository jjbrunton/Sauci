import { randomUUID } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PostgresQuizRepository } from '../src/domains/quiz/repository.js';

const url = process.env.DATABASE_URL;
const local = url ? ['127.0.0.1', 'localhost', '::1'].includes(new URL(url).hostname) : false;
if (url && !local) throw new Error('Quiz integration tests only permit localhost');

describe.skipIf(!url || !local)('quiz + PostgreSQL', () => {
  const admin = new Pool({ connectionString: url });
  const schema = `quiz_${randomUUID().replaceAll('-', '')}`;
  let pool: Pool;
  let repo: PostgresQuizRepository;

  const userA = '11111111-1111-4111-8111-111111111111';
  const userB = '22222222-2222-4222-8222-222222222222';
  const soloUser = '33333333-3333-4333-8333-333333333333';
  const outsider = '44444444-4444-4444-8444-444444444444';
  const couple = '55555555-5555-4555-8555-555555555555';
  const soloCouple = '66666666-6666-4666-8666-666666666666';
  const otherCouple = '77777777-7777-4777-8777-777777777777';

  beforeAll(async () => {
    await admin.query(`create schema "${schema}"`);
    const isolated = new URL(url!);
    isolated.searchParams.set('options', `-c search_path=${schema}`);
    pool = new Pool({ connectionString: isolated.toString() });
    repo = new PostgresQuizRepository(isolated.toString());

    const dir = new URL('../drizzle/', import.meta.url);
    const files = (await readdir(dir)).filter((name) => name.endsWith('.sql')).sort();
    for (const name of files) {
      const sql = await readFile(new URL(name, dir), 'utf8');
      for (const statement of sql.split('--> statement-breakpoint')) {
        if (statement.trim()) await pool.query(statement);
      }
    }

    await pool.query(
      'insert into couples(id,invite_code) values($1,$2),($3,$4),($5,$6)',
      [couple, 'QUIZAAA1', soloCouple, 'QUIZAAA2', otherCouple, 'QUIZAAA3'],
    );
    await pool.query(
      `insert into profiles(id,couple_id) values
        ($1,$5),($2,$5),($3,$6),($4,$7)`,
      [userA, userB, soloUser, outsider, couple, soloCouple, otherCouple],
    );
  });

  beforeEach(async () => {
    await pool.query('delete from quiz_answers');
    await pool.query('delete from quiz_sessions');
  });

  afterAll(async () => {
    await repo.close();
    await pool.end();
    await admin.query(`drop schema "${schema}" cascade`);
    await admin.end();
  });

  it('refuses to start a quiz without a couple or without a partner', async () => {
    await expect(repo.startSession(randomUUID())).rejects.toMatchObject({ code: 'no_couple' });
    await expect(repo.startSession(soloUser)).rejects.toMatchObject({ code: 'partner_required' });
  });

  it('starts a session with ten active questions and returns it idempotently', async () => {
    const first = await repo.startSession(userA);
    expect(first.created).toBe(true);
    expect(first.session.status).toBe('active');
    expect(first.session.questions).toHaveLength(10);
    expect(first.session.score_percent).toBeNull();
    expect(first.session.my_answers).toEqual([]);
    expect(first.session.i_completed).toBe(false);
    expect(first.session.partner_completed).toBe(false);

    const second = await repo.startSession(userA);
    expect(second.created).toBe(false);
    expect(second.session.id).toBe(first.session.id);

    // The partner starting also resolves to the same active session.
    const partnerView = await repo.startSession(userB);
    expect(partnerView.created).toBe(false);
    expect(partnerView.session.id).toBe(first.session.id);
  });

  it('walks the full happy path: both partners answer, session completes, score is exact', async () => {
    const { session } = await repo.startSession(userA);
    const questionIds = session.questions.map((question) => question.id);
    expect(questionIds).toHaveLength(10);

    // Self-answers alternate 0/1 per question so a guess cannot accidentally match
    // by coincidence. A guesses B's self-answer correctly on the first 6 questions
    // and wrong on the rest; B guesses A's self-answer correctly on the first 3
    // questions and wrong on the rest.
    const bSelf = questionIds.map((_, index) => index % 2);
    const aSelf = questionIds.map((_, index) => 1 - (index % 2));
    const aGuess = bSelf.map((value, index) => (index < 6 ? value : 1 - value));
    const bGuess = aSelf.map((value, index) => (index < 3 ? value : 1 - value));

    const aAnswers = questionIds.map((questionId, index) => ({
      question_id: questionId,
      self_index: aSelf[index]!,
      guess_index: aGuess[index]!,
    }));
    const bAnswers = questionIds.map((questionId, index) => ({
      question_id: questionId,
      self_index: bSelf[index]!,
      guess_index: bGuess[index]!,
    }));

    const afterA = await repo.submitAnswers(userA, session.id, aAnswers);
    expect(afterA.status).toBe('active');
    expect(afterA.i_completed).toBe(true);
    expect(afterA.partner_completed).toBe(false);
    expect(afterA.my_answers).toHaveLength(10);

    const afterB = await repo.submitAnswers(userB, session.id, bAnswers);
    expect(afterB.status).toBe('completed');
    expect(afterB.completed_at).not.toBeNull();
    expect(afterB.i_completed).toBe(true);
    expect(afterB.partner_completed).toBe(true);

    // A guessed right (guess=1 matches B's self=1) on questions 0-5: 6 hits.
    // B guessed right (guess=0 matches A's self=0) on questions 0-2: 3 hits.
    // Total 9 hits out of 20 possible = 45%.
    expect(afterB.score_percent).toBe(45);

    const result = await repo.result(userA, session.id);
    expect(result.score_percent).toBe(45);
    expect(result.completed_at).not.toBeNull();
    expect(result.questions).toHaveLength(10);
    expect(result.questions[0]).toMatchObject({
      my_self_index: aSelf[0],
      my_guess_index: aGuess[0],
      partner_self_index: bSelf[0],
      partner_guess_index: bGuess[0],
      i_guessed_right: true,
      partner_guessed_right: true,
    });
    expect(result.questions[9]).toMatchObject({
      i_guessed_right: false,
      partner_guessed_right: false,
    });

    // The partner's result view mirrors the same score with roles swapped.
    const partnerResult = await repo.result(userB, session.id);
    expect(partnerResult.score_percent).toBe(45);
  });

  it('rejects an incomplete or mismatched answer set', async () => {
    const { session } = await repo.startSession(userA);
    const questionIds = session.questions.map((question) => question.id);

    await expect(
      repo.submitAnswers(userA, session.id, [
        { question_id: questionIds[0]!, self_index: 0, guess_index: 0 },
      ]),
    ).rejects.toMatchObject({ code: 'invalid_answers' });

    await expect(
      repo.submitAnswers(userA, session.id, [
        ...questionIds.map((id) => ({ question_id: id, self_index: 0, guess_index: 0 })),
        { question_id: randomUUID(), self_index: 0, guess_index: 0 },
      ]),
    ).rejects.toMatchObject({ code: 'invalid_answers' });

    const options = session.questions[0]!.options;
    await expect(
      repo.submitAnswers(userA, session.id, questionIds.map((id) => ({
        question_id: id,
        self_index: options.length,
        guess_index: 0,
      }))),
    ).rejects.toMatchObject({ code: 'invalid_answers' });
  });

  it('isolates sessions to their own couple', async () => {
    const { session } = await repo.startSession(userA);
    await expect(repo.submitAnswers(outsider, session.id, [])).rejects.toMatchObject({ code: 'session_not_found' });
    await expect(repo.result(outsider, session.id)).rejects.toMatchObject({ code: 'session_not_found' });
    expect(await repo.currentSession(outsider)).toBeNull();
  });

  it('blocks the answers endpoint once the session has completed', async () => {
    const { session } = await repo.startSession(userA);
    const questionIds = session.questions.map((question) => question.id);
    const answers = questionIds.map((id) => ({ question_id: id, self_index: 0, guess_index: 0 }));
    await repo.submitAnswers(userA, session.id, answers);
    const completed = await repo.submitAnswers(userB, session.id, answers);
    expect(completed.status).toBe('completed');

    await expect(repo.submitAnswers(userA, session.id, answers)).rejects.toMatchObject({ code: 'session_completed' });
  });

  it('blocks the result endpoint before the session has completed', async () => {
    const { session } = await repo.startSession(userA);
    await expect(repo.result(userA, session.id)).rejects.toMatchObject({ code: 'session_not_completed' });
  });

  it('returns the couple\'s most recent session from currentSession', async () => {
    expect(await repo.currentSession(userA)).toBeNull();
    const { session } = await repo.startSession(userA);
    const current = await repo.currentSession(userB);
    expect(current?.id).toBe(session.id);
  });
});
