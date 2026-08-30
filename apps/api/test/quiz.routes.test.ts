import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';
import type { AuthIdentity } from '../src/auth.js';
import type { QuizRepository } from '../src/domains/quiz/repository.js';
import { registerQuizRoutes } from '../src/domains/quiz/routes.js';
import { QuizError, type QuizSessionPayload } from '../src/domains/quiz/types.js';

const identity: AuthIdentity = { id: '11111111-1111-4111-8111-111111111111', email: null, name: null, avatarUrl: null };
const sessionId = '22222222-2222-4222-8222-222222222222';
const questionId = '33333333-3333-4333-8333-333333333333';

const session: QuizSessionPayload = {
  id: sessionId,
  status: 'active',
  created_at: '2026-08-27T00:00:00.000Z',
  completed_at: null,
  score_percent: null,
  questions: [
    { id: questionId, prompt_self: 'Self prompt', prompt_guess: 'Guess prompt', options: ['A', 'B'] },
  ],
  my_answers: [],
  partner_completed: false,
  i_completed: false,
};

function setup(overrides: Partial<QuizRepository> = {}) {
  const repository: QuizRepository = {
    startSession: vi.fn(async () => ({ session, created: true })),
    currentSession: vi.fn(async () => session),
    submitAnswers: vi.fn(async () => session),
    result: vi.fn(async () => ({
      score_percent: 100,
      completed_at: '2026-08-27T00:00:00.000Z',
      questions: [],
    })),
    close: vi.fn(async () => undefined),
    ...overrides,
  };
  const app = new Hono<{ Variables: { identity: AuthIdentity } }>();
  app.use('/v1/*', async (c, next) => { c.set('identity', identity); await next(); });
  registerQuizRoutes(app, repository);
  return { app, repository };
}

function post(app: Hono<{ Variables: { identity: AuthIdentity } }>, path: string, body?: unknown) {
  return app.request(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe('quiz routes', () => {
  it('starts a session and returns 201 when a new one is created', async () => {
    const { app, repository } = setup();
    const response = await post(app, '/v1/quiz/sessions');
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ session });
    expect(repository.startSession).toHaveBeenCalledWith(identity.id);
  });

  it('returns 200 when starting resolves to an existing active session', async () => {
    const { app } = setup({ startSession: vi.fn(async () => ({ session, created: false })) });
    const response = await post(app, '/v1/quiz/sessions');
    expect(response.status).toBe(200);
  });

  it('maps no_couple and partner_required to 409', async () => {
    const { app } = setup({
      startSession: vi.fn(async () => { throw new QuizError('no_couple', 'Join a couple first', 409); }),
    });
    const response = await post(app, '/v1/quiz/sessions');
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ error: { code: 'no_couple' } });
  });

  it('returns the current session, including null when none exists', async () => {
    const { app } = setup({ currentSession: vi.fn(async () => null) });
    const response = await app.request('/v1/quiz/sessions/current');
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ session: null });
  });

  it('rejects a malformed session id on the answers route', async () => {
    const { app, repository } = setup();
    const response = await post(app, '/v1/quiz/sessions/not-a-uuid/answers', {
      answers: [{ question_id: questionId, self_index: 0, guess_index: 1 }],
    });
    expect(response.status).toBe(404);
    expect(repository.submitAnswers).not.toHaveBeenCalled();
  });

  it('rejects an empty or malformed answer body', async () => {
    const { app, repository } = setup();
    expect((await post(app, `/v1/quiz/sessions/${sessionId}/answers`, { answers: [] })).status).toBe(400);
    expect((await post(app, `/v1/quiz/sessions/${sessionId}/answers`, {})).status).toBe(400);
    expect((await post(app, `/v1/quiz/sessions/${sessionId}/answers`, {
      answers: [{ question_id: questionId, self_index: 0, guess_index: 1, extra: true }],
    })).status).toBe(400);
    expect(repository.submitAnswers).not.toHaveBeenCalled();
  });

  it('submits valid answers and surfaces the updated session', async () => {
    const { app, repository } = setup();
    const answers = [{ question_id: questionId, self_index: 0, guess_index: 1 }];
    const response = await post(app, `/v1/quiz/sessions/${sessionId}/answers`, { answers });
    expect(response.status).toBe(200);
    expect(repository.submitAnswers).toHaveBeenCalledWith(identity.id, sessionId, answers);
  });

  it('maps session errors to their status codes', async () => {
    const { app } = setup({
      submitAnswers: vi.fn(async () => { throw new QuizError('session_completed', 'Already finished', 409); }),
    });
    const response = await post(app, `/v1/quiz/sessions/${sessionId}/answers`, {
      answers: [{ question_id: questionId, self_index: 0, guess_index: 1 }],
    });
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ error: { code: 'session_completed' } });
  });

  it('returns the result payload for a completed session', async () => {
    const { app, repository } = setup();
    const response = await app.request(`/v1/quiz/sessions/${sessionId}/result`);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ score_percent: 100 });
    expect(repository.result).toHaveBeenCalledWith(identity.id, sessionId);
  });

  it('maps session_not_completed to 409 on the result route', async () => {
    const { app } = setup({
      result: vi.fn(async () => { throw new QuizError('session_not_completed', 'Not finished yet', 409); }),
    });
    const response = await app.request(`/v1/quiz/sessions/${sessionId}/result`);
    expect(response.status).toBe(409);
  });

  it('rejects a malformed session id on the result route', async () => {
    const { app, repository } = setup();
    const response = await app.request('/v1/quiz/sessions/not-a-uuid/result');
    expect(response.status).toBe(404);
    expect(repository.result).not.toHaveBeenCalled();
  });
});
