import type { ApiErrorResponse } from '@sauci/shared';
import type { Hono } from 'hono';
import { z } from 'zod';
import type { AuthIdentity } from '../../auth.js';
import { QuizError, type QuizAnswerInput } from './types.js';
import type { QuizRepository } from './repository.js';

type QuizApp = Hono<{ Variables: { identity: AuthIdentity } }>;

const id = z.string().uuid();

const answerEntry = z
  .object({
    question_id: id,
    self_index: z.number().int().min(0),
    guess_index: z.number().int().min(0),
  })
  .strict();

const submitBody = z.object({ answers: z.array(answerEntry).min(1) }).strict();

function error(code: string, message: string): ApiErrorResponse {
  return { error: { code, message } };
}

async function result<T>(operation: () => Promise<T>) {
  try {
    return { ok: true as const, value: await operation() };
  } catch (cause) {
    if (cause instanceof QuizError) return { ok: false as const, cause };
    throw cause;
  }
}

export function registerQuizRoutes(app: QuizApp, repository: QuizRepository): void {
  app.post('/v1/quiz/sessions', async (c) => {
    const response = await result(() => repository.startSession(c.get('identity').id));
    if (!response.ok) return c.json(error(response.cause.code, response.cause.message), response.cause.status);
    return c.json({ session: response.value.session }, response.value.created ? 201 : 200);
  });

  app.get('/v1/quiz/sessions/current', async (c) => {
    const response = await result(() => repository.currentSession(c.get('identity').id));
    if (!response.ok) return c.json(error(response.cause.code, response.cause.message), response.cause.status);
    return c.json({ session: response.value });
  });

  app.post('/v1/quiz/sessions/:sessionId/answers', async (c) => {
    const sessionId = id.safeParse(c.req.param('sessionId'));
    if (!sessionId.success) return c.json(error('session_not_found', 'Quiz session not found'), 404);
    const body = submitBody.safeParse(await c.req.json().catch(() => ({})));
    if (!body.success) return c.json(error('invalid_answers', 'Provide the full set of question answers'), 400);
    const answers: QuizAnswerInput[] = body.data.answers;
    const response = await result(() => repository.submitAnswers(c.get('identity').id, sessionId.data, answers));
    if (!response.ok) return c.json(error(response.cause.code, response.cause.message), response.cause.status);
    return c.json({ session: response.value });
  });

  app.get('/v1/quiz/sessions/:sessionId/result', async (c) => {
    const sessionId = id.safeParse(c.req.param('sessionId'));
    if (!sessionId.success) return c.json(error('session_not_found', 'Quiz session not found'), 404);
    const response = await result(() => repository.result(c.get('identity').id, sessionId.data));
    if (!response.ok) return c.json(error(response.cause.code, response.cause.message), response.cause.status);
    return c.json(response.value);
  });
}
