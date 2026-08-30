import { Pool, type PoolClient, type QueryResultRow } from 'pg';
import { closeResolvedPool, resolvePool, type DatabaseConnection } from '../../db/pool.js';
import { computeQuizScore, type QuizAnswerPair } from './service.js';
import {
  QuizError,
  type QuizAnswerInput,
  type QuizQuestionSummary,
  type QuizResultPayload,
  type QuizSessionPayload,
  type QuizSessionStatus,
} from './types.js';

interface QuizQuestionRow extends QueryResultRow {
  id: string;
  prompt_self: string;
  prompt_guess: string;
  options: string[];
}

interface QuizSessionRow extends QueryResultRow {
  id: string;
  couple_id: string;
  status: QuizSessionStatus;
  question_ids: string[];
  score_percent: number | null;
  completed_at: Date | null;
  created_at: Date;
}

interface QuizAnswerRow extends QueryResultRow {
  user_id: string;
  question_id: string;
  self_index: number;
  guess_index: number;
}

export interface QuizRepository {
  startSession(userId: string): Promise<{ session: QuizSessionPayload; created: boolean }>;
  currentSession(userId: string): Promise<QuizSessionPayload | null>;
  submitAnswers(userId: string, sessionId: string, answers: QuizAnswerInput[]): Promise<QuizSessionPayload>;
  result(userId: string, sessionId: string): Promise<QuizResultPayload>;
  close(): Promise<void>;
}

const QUESTIONS_PER_SESSION = 10;

async function transaction<T>(pool: Pool, work: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('begin');
    const result = await work(client);
    await client.query('commit');
    return result;
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}

function orderByIds<T extends { id: string }>(rows: T[], ids: string[]): T[] {
  const byId = new Map(rows.map((row) => [row.id, row]));
  return ids.map((id) => byId.get(id)).filter((row): row is T => row !== undefined);
}

export class PostgresQuizRepository implements QuizRepository {
  private readonly pool: Pool;
  private readonly ownsPool: boolean;

  constructor(connection: DatabaseConnection) {
    const resolved = resolvePool(connection);
    this.pool = resolved.pool;
    this.ownsPool = resolved.owned;
  }

  private async coupleOf(client: Pool | PoolClient, userId: string): Promise<string | null> {
    const result = await client.query<{ couple_id: string | null }>(
      'select couple_id from profiles where id = $1',
      [userId],
    );
    return result.rows[0]?.couple_id ?? null;
  }

  private async partnerOf(client: Pool | PoolClient, coupleId: string, userId: string): Promise<string | null> {
    const result = await client.query<{ id: string }>(
      'select id from profiles where couple_id = $1 and id <> $2 order by id asc limit 1',
      [coupleId, userId],
    );
    return result.rows[0]?.id ?? null;
  }

  private async questionsFor(client: Pool | PoolClient, questionIds: string[]): Promise<QuizQuestionRow[]> {
    const result = await client.query<QuizQuestionRow>(
      'select id, prompt_self, prompt_guess, options from quiz_questions where id = any($1::uuid[])',
      [questionIds],
    );
    return orderByIds(result.rows, questionIds);
  }

  private async buildPayload(
    client: Pool | PoolClient,
    session: QuizSessionRow,
    userId: string,
  ): Promise<QuizSessionPayload> {
    const questions = await this.questionsFor(client, session.question_ids);
    const [myAnswers, counts] = await Promise.all([
      client.query<QuizAnswerRow>(
        'select question_id, self_index, guess_index from quiz_answers where session_id = $1 and user_id = $2',
        [session.id, userId],
      ),
      client.query<{ user_id: string; count: string }>(
        'select user_id, count(*)::text as count from quiz_answers where session_id = $1 group by user_id',
        [session.id],
      ),
    ]);

    const coupleId = session.couple_id;
    const partnerId = await this.partnerOf(client, coupleId, userId);
    const answerCounts = new Map(counts.rows.map((row) => [row.user_id, Number(row.count)]));
    const questionCount = session.question_ids.length;

    const answersByQuestion = new Map(myAnswers.rows.map((row) => [row.question_id, row]));
    const orderedAnswers: QuizAnswerInput[] = session.question_ids
      .map((questionId) => answersByQuestion.get(questionId))
      .filter((row): row is QuizAnswerRow => row !== undefined)
      .map((row) => ({ question_id: row.question_id, self_index: row.self_index, guess_index: row.guess_index }));

    const questionSummaries: QuizQuestionSummary[] = questions.map((row) => ({
      id: row.id,
      prompt_self: row.prompt_self,
      prompt_guess: row.prompt_guess,
      options: row.options,
    }));

    return {
      id: session.id,
      status: session.status,
      created_at: session.created_at.toISOString(),
      completed_at: session.completed_at?.toISOString() ?? null,
      score_percent: session.score_percent,
      questions: questionSummaries,
      my_answers: orderedAnswers,
      partner_completed: partnerId ? (answerCounts.get(partnerId) ?? 0) === questionCount : false,
      i_completed: (answerCounts.get(userId) ?? 0) === questionCount,
    };
  }

  async startSession(userId: string): Promise<{ session: QuizSessionPayload; created: boolean }> {
    return transaction(this.pool, async (client) => {
      const coupleId = await this.coupleOf(client, userId);
      if (!coupleId) throw new QuizError('no_couple', 'Join a couple before starting a quiz', 409);

      const members = await client.query<{ count: string }>(
        'select count(*)::text as count from profiles where couple_id = $1',
        [coupleId],
      );
      if (Number(members.rows[0]?.count ?? 0) < 2) {
        throw new QuizError('partner_required', 'Both partners must be paired to start a quiz', 409);
      }

      const existing = await client.query<QuizSessionRow>(
        `select * from quiz_sessions where couple_id = $1 and status = 'active' order by created_at desc limit 1`,
        [coupleId],
      );
      if (existing.rows[0]) {
        return { session: await this.buildPayload(client, existing.rows[0], userId), created: false };
      }

      // Prefer questions this couple has never had in any prior session (completed or
      // active), then the least-recently-used ones, with a random tiebreak within each
      // group so repeat quizzes stay varied instead of always reusing the same pool.
      const questions = await client.query<{ id: string }>(
        `select q.id
         from quiz_questions q
         left join (
           select question_id, max(created_at) as last_used
           from quiz_sessions, unnest(question_ids) as question_id
           where couple_id = $1
           group by question_id
         ) usage on usage.question_id = q.id
         where q.is_active = true
         order by (usage.last_used is not null), usage.last_used asc, random()
         limit $2`,
        [coupleId, QUESTIONS_PER_SESSION],
      );
      const questionIds = questions.rows.map((row) => row.id);

      // The partial unique index (one active session per couple) is the source of
      // truth for the race between two simultaneous starts; ON CONFLICT DO NOTHING
      // lets the loser fall through to reading the winner's row instead of erroring.
      const inserted = await client.query<QuizSessionRow>(
        `insert into quiz_sessions (couple_id, question_ids)
         values ($1, $2::uuid[])
         on conflict (couple_id) where status = 'active' do nothing
         returning *`,
        [coupleId, questionIds],
      );

      let sessionRow = inserted.rows[0];
      let created = true;
      if (!sessionRow) {
        created = false;
        const raced = await client.query<QuizSessionRow>(
          `select * from quiz_sessions where couple_id = $1 and status = 'active' order by created_at desc limit 1`,
          [coupleId],
        );
        sessionRow = raced.rows[0]!;
      }

      return { session: await this.buildPayload(client, sessionRow, userId), created };
    });
  }

  async currentSession(userId: string): Promise<QuizSessionPayload | null> {
    const coupleId = await this.coupleOf(this.pool, userId);
    if (!coupleId) return null;
    const result = await this.pool.query<QuizSessionRow>(
      'select * from quiz_sessions where couple_id = $1 order by created_at desc limit 1',
      [coupleId],
    );
    const row = result.rows[0];
    if (!row) return null;
    return this.buildPayload(this.pool, row, userId);
  }

  async submitAnswers(userId: string, sessionId: string, answers: QuizAnswerInput[]): Promise<QuizSessionPayload> {
    return transaction(this.pool, async (client) => {
      const sessionResult = await client.query<QuizSessionRow>(
        'select * from quiz_sessions where id = $1 for update',
        [sessionId],
      );
      const session = sessionResult.rows[0];
      const coupleId = await this.coupleOf(client, userId);
      if (!session || !coupleId || session.couple_id !== coupleId) {
        throw new QuizError('session_not_found', 'Quiz session not found', 404);
      }
      if (session.status !== 'active') {
        throw new QuizError('session_completed', 'This quiz session has already finished', 409);
      }

      const questionIds = new Set(session.question_ids);
      const answeredIds = new Set(answers.map((answer) => answer.question_id));
      if (answeredIds.size !== answers.length || answeredIds.size !== questionIds.size) {
        throw new QuizError('invalid_answers', 'Answers must cover every question in the session exactly once', 400);
      }
      for (const id of answeredIds) {
        if (!questionIds.has(id)) {
          throw new QuizError('invalid_answers', 'Answers must cover every question in the session exactly once', 400);
        }
      }

      const questions = await this.questionsFor(client, session.question_ids);
      const optionsByQuestion = new Map(questions.map((question) => [question.id, question.options]));
      for (const answer of answers) {
        const options = optionsByQuestion.get(answer.question_id);
        if (!options) {
          throw new QuizError('invalid_answers', 'Answers must cover every question in the session exactly once', 400);
        }
        if (
          answer.self_index < 0 || answer.self_index >= options.length ||
          answer.guess_index < 0 || answer.guess_index >= options.length
        ) {
          throw new QuizError('invalid_answers', 'Answer indexes must be within the question options', 400);
        }
      }

      for (const answer of answers) {
        await client.query(
          `insert into quiz_answers (session_id, user_id, question_id, self_index, guess_index)
           values ($1, $2, $3, $4, $5)
           on conflict (session_id, user_id, question_id)
           do update set self_index = excluded.self_index, guess_index = excluded.guess_index`,
          [sessionId, userId, answer.question_id, answer.self_index, answer.guess_index],
        );
      }

      const partnerId = await this.partnerOf(client, coupleId, userId);
      let updatedSession = session;
      if (partnerId) {
        const counts = await client.query<{ user_id: string; count: string }>(
          'select user_id, count(*)::text as count from quiz_answers where session_id = $1 group by user_id',
          [sessionId],
        );
        const answerCounts = new Map(counts.rows.map((row) => [row.user_id, Number(row.count)]));
        const questionCount = session.question_ids.length;
        const bothComplete =
          (answerCounts.get(userId) ?? 0) === questionCount && (answerCounts.get(partnerId) ?? 0) === questionCount;

        if (bothComplete) {
          const allAnswers = await client.query<QuizAnswerRow>(
            'select user_id, question_id, self_index, guess_index from quiz_answers where session_id = $1',
            [sessionId],
          );
          const byUser = new Map<string, Map<string, QuizAnswerRow>>();
          for (const row of allAnswers.rows) {
            if (!byUser.has(row.user_id)) byUser.set(row.user_id, new Map());
            byUser.get(row.user_id)!.set(row.question_id, row);
          }
          const mine = byUser.get(userId)!;
          const theirs = byUser.get(partnerId)!;
          const pairs: QuizAnswerPair[] = session.question_ids.map((questionId) => ({
            questionId,
            aSelfIndex: mine.get(questionId)!.self_index,
            aGuessIndex: mine.get(questionId)!.guess_index,
            bSelfIndex: theirs.get(questionId)!.self_index,
            bGuessIndex: theirs.get(questionId)!.guess_index,
          }));
          const { scorePercent } = computeQuizScore(pairs);

          const completed = await client.query<QuizSessionRow>(
            `update quiz_sessions set status = 'completed', score_percent = $2, completed_at = now()
             where id = $1
             returning *`,
            [sessionId, scorePercent],
          );
          updatedSession = completed.rows[0]!;
        }
      }

      return this.buildPayload(client, updatedSession, userId);
    });
  }

  async result(userId: string, sessionId: string): Promise<QuizResultPayload> {
    const sessionResult = await this.pool.query<QuizSessionRow>(
      'select * from quiz_sessions where id = $1',
      [sessionId],
    );
    const session = sessionResult.rows[0];
    const coupleId = await this.coupleOf(this.pool, userId);
    if (!session || !coupleId || session.couple_id !== coupleId) {
      throw new QuizError('session_not_found', 'Quiz session not found', 404);
    }
    if (session.status !== 'completed') {
      throw new QuizError('session_not_completed', 'This quiz session has not finished yet', 409);
    }

    const partnerId = await this.partnerOf(this.pool, coupleId, userId);
    if (!partnerId) throw new QuizError('session_not_found', 'Quiz session not found', 404);

    const [questions, allAnswers] = await Promise.all([
      this.questionsFor(this.pool, session.question_ids),
      this.pool.query<QuizAnswerRow>(
        'select user_id, question_id, self_index, guess_index from quiz_answers where session_id = $1',
        [sessionId],
      ),
    ]);

    const byUser = new Map<string, Map<string, QuizAnswerRow>>();
    for (const row of allAnswers.rows) {
      if (!byUser.has(row.user_id)) byUser.set(row.user_id, new Map());
      byUser.get(row.user_id)!.set(row.question_id, row);
    }
    const mine = byUser.get(userId) ?? new Map<string, QuizAnswerRow>();
    const theirs = byUser.get(partnerId) ?? new Map<string, QuizAnswerRow>();

    const questionsPayload = questions.map((question) => {
      const my = mine.get(question.id);
      const partner = theirs.get(question.id);
      const mySelf = my?.self_index ?? 0;
      const myGuess = my?.guess_index ?? 0;
      const partnerSelf = partner?.self_index ?? 0;
      const partnerGuess = partner?.guess_index ?? 0;
      return {
        question_id: question.id,
        prompt_self: question.prompt_self,
        prompt_guess: question.prompt_guess,
        options: question.options,
        my_self_index: mySelf,
        my_guess_index: myGuess,
        partner_self_index: partnerSelf,
        partner_guess_index: partnerGuess,
        i_guessed_right: myGuess === partnerSelf,
        partner_guessed_right: partnerGuess === mySelf,
      };
    });

    return {
      score_percent: session.score_percent ?? 0,
      completed_at: session.completed_at?.toISOString() ?? null,
      questions: questionsPayload,
    };
  }

  async close(): Promise<void> {
    await closeResolvedPool(this.pool, this.ownsPool);
  }
}
