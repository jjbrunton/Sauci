import type { ApiErrorResponse } from '@sauci/shared';
import type { Hono } from 'hono';
import { z } from 'zod';
import type { AuthIdentity } from '../../auth.js';
import { AppDataError, type AppDataRepository } from './repository.js';

type App = Hono<{ Variables: { identity: AuthIdentity } }>;
const uuid = z.string().uuid();
const point = z.object({ x: z.number().finite().min(0).max(1), y: z.number().finite().min(0).max(1) }).strict();
const stroke = z.object({
  id: z.string().min(1).max(120), userId: uuid, points: z.array(point).max(20_000),
  color: z.string().min(1).max(64), width: z.number().finite().positive().max(100),
  timestamp: z.number().finite().nonnegative(), isEraser: z.boolean(),
}).strict();
const liveDrawBody = z.object({ strokes: z.array(stroke).max(2_000), base_revision: z.number().int().nonnegative() }).strict();
const viewedBody = z.object({ expires_at: z.string().datetime().nullable() }).strict();
const error = (code: string, message: string): ApiErrorResponse => ({ error: { code, message } });
async function run<T>(op: () => Promise<T>) { try { return { ok: true as const, value: await op() }; } catch (cause) { if (cause instanceof AppDataError) return { ok: false as const, cause }; throw cause; } }

export function registerAppDataRoutes(app: App, repository: AppDataRepository): void {
  app.get('/v1/packs/:packId/context', async c => {
    const id = uuid.safeParse(c.req.param('packId')); if (!id.success) return c.json(error('invalid_pack_id', 'A valid pack ID is required'), 400);
    const result = await run(() => repository.packContext(c.get('identity').id, id.data));
    return result.ok ? c.json({ pack: result.value }) : c.json(error(result.cause.code, result.cause.message), result.cause.status);
  });
  app.get('/v1/packs/:packId/questions', async c => {
    const id = uuid.safeParse(c.req.param('packId')); if (!id.success) return c.json(error('invalid_pack_id', 'A valid pack ID is required'), 400);
    const result = await run(() => repository.packQuestions(c.get('identity').id, id.data));
    return result.ok ? c.json({ questions: result.value }) : c.json(error(result.cause.code, result.cause.message), result.cause.status);
  });
  app.get('/v1/packs/:packId/teaser', async c => {
    const id = uuid.safeParse(c.req.param('packId')); if (!id.success) return c.json(error('invalid_pack_id', 'A valid pack ID is required'), 400);
    const result = await run(() => repository.packTeaser(c.get('identity').id, id.data));
    return result.ok ? c.json({ questions: result.value }) : c.json(error(result.cause.code, result.cause.message), result.cause.status);
  });
  app.get('/v1/matches/:matchId/context', async c => {
    const id = uuid.safeParse(c.req.param('matchId')); if (!id.success) return c.json(error('invalid_match_id', 'A valid match ID is required'), 400);
    const result = await run(() => repository.matchContext(c.get('identity').id, id.data));
    return result.ok ? c.json({ match: result.value }) : c.json(error(result.cause.code, result.cause.message), result.cause.status);
  });
  app.patch('/v1/messages/:messageId/media-viewed', async c => {
    const id = uuid.safeParse(c.req.param('messageId')); const body = viewedBody.safeParse(await c.req.json().catch(() => null));
    if (!id.success || !body.success) return c.json(error('invalid_request', 'A valid message ID and expires_at are required'), 400);
    const result = await run(() => repository.markMediaViewed(c.get('identity').id, id.data, body.data.expires_at));
    return result.ok ? c.json(result.value) : c.json(error(result.cause.code, result.cause.message), result.cause.status);
  });
  app.get('/v1/me/nudge-status', async c => c.json(await repository.nudgeStatus(c.get('identity').id)));
  app.post('/v1/me/nudge', async c => {
    const result = await run(() => repository.sendNudge(c.get('identity').id));
    return result.ok ? c.json(result.value) : c.json({ ...error(result.cause.code, result.cause.message), ...result.cause.details }, result.cause.status);
  });
  app.get('/v1/live-draw', async c => { const result = await run(() => repository.getLiveDraw(c.get('identity').id)); return result.ok ? c.json(result.value) : c.json(error(result.cause.code, result.cause.message), result.cause.status); });
  app.put('/v1/live-draw', async c => {
    const body = liveDrawBody.safeParse(await c.req.json().catch(() => null)); if (!body.success) return c.json(error('invalid_strokes', 'A valid strokes array is required'), 400);
    const result = await run(() => repository.putLiveDraw(c.get('identity').id, body.data.strokes, body.data.base_revision));
    return result.ok ? c.json(result.value) : c.json({ ...error(result.cause.code, result.cause.message), ...result.cause.details }, result.cause.status);
  });
}
