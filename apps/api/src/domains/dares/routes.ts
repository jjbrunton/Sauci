import type { ApiErrorResponse } from '@sauci/shared';
import type { Hono } from 'hono';
import { z } from 'zod';
import type { AuthIdentity } from '../../auth.js';
import { DURATION_PRESET_HOURS, DaresError, type DaresRepository } from './repository.js';

type DaresApp = Hono<{ Variables: { identity: AuthIdentity } }>;

const id = z.string().uuid();

const sendBody = z
  .object({
    dare_id: id.nullish(),
    custom_dare_text: z.string().trim().min(1).max(500).nullish(),
    custom_dare_intensity: z.number().int().min(1).max(5).nullish(),
    duration_hours: z.union([z.literal(1), z.literal(6), z.literal(12), z.literal(24), z.literal(72), z.literal(168)]).nullish(),
    sender_notes: z.string().trim().max(500).nullish(),
  })
  .strict()
  .refine((value) => Boolean(value.dare_id) !== Boolean(value.custom_dare_text), {
    message: 'Provide either dare_id or custom_dare_text',
  });

const respondBody = z.object({ action: z.enum(['accept', 'decline']) }).strict();

function error(code: string, message: string): ApiErrorResponse {
  return { error: { code, message } };
}

async function result<T>(operation: () => Promise<T>) {
  try {
    return { ok: true as const, value: await operation() };
  } catch (cause) {
    if (cause instanceof DaresError) return { ok: false as const, cause };
    throw cause;
  }
}

export function registerDareRoutes(app: DaresApp, repository: DaresRepository): void {
  app.get('/v1/dares/durations', (c) => c.json({ presets: DURATION_PRESET_HOURS }));

  app.get('/v1/dares/packs', async (c) => {
    const response = await result(() => repository.getCatalog(c.get('identity').id));
    return response.ok
      ? c.json(response.value)
      : c.json(error(response.cause.code, response.cause.message), response.cause.status);
  });

  app.get('/v1/dares/packs/:packId/dares', async (c) => {
    const packId = id.safeParse(c.req.param('packId'));
    if (!packId.success) return c.json(error('invalid_pack_id', 'A valid pack ID is required'), 400);
    const response = await result(() => repository.listPackDares(c.get('identity').id, packId.data));
    return response.ok
      ? c.json({ dares: response.value })
      : c.json(error(response.cause.code, response.cause.message), response.cause.status);
  });

  app.get('/v1/dares', async (c) => {
    const filter = c.req.query('filter') ?? 'active';
    if (filter !== 'active' && filter !== 'history') {
      return c.json(error('invalid_filter', 'Filter must be active or history'), 400);
    }
    const response = await result(() => repository.listDares(c.get('identity').id, filter));
    return response.ok
      ? c.json({ dares: response.value })
      : c.json(error(response.cause.code, response.cause.message), response.cause.status);
  });

  app.get('/v1/dares/stats', async (c) => {
    const response = await result(() => repository.stats(c.get('identity').id));
    return response.ok
      ? c.json(response.value)
      : c.json(error(response.cause.code, response.cause.message), response.cause.status);
  });

  app.post('/v1/dares', async (c) => {
    const body = sendBody.safeParse(await c.req.json().catch(() => ({})));
    if (!body.success) return c.json(error('invalid_dare', 'Provide either a dare_id or custom dare text'), 400);
    const response = await result(() => repository.send(c.get('identity').id, body.data));
    return response.ok
      ? c.json({ dare: response.value }, 201)
      : c.json(error(response.cause.code, response.cause.message), response.cause.status);
  });

  app.post('/v1/dares/:dareId/respond', async (c) => {
    const dareId = id.safeParse(c.req.param('dareId'));
    const body = respondBody.safeParse(await c.req.json().catch(() => ({})));
    if (!dareId.success) return c.json(error('invalid_dare_id', 'A valid dare ID is required'), 400);
    if (!body.success) return c.json(error('invalid_action', 'Action must be accept or decline'), 400);
    const response = await result(() => repository.respond(c.get('identity').id, dareId.data, body.data.action));
    return response.ok
      ? c.json({ dare: response.value })
      : c.json(error(response.cause.code, response.cause.message), response.cause.status);
  });

  for (const [path, method] of [
    ['submit', 'submit'],
    ['complete', 'complete'],
    ['cancel', 'cancel'],
  ] as const) {
    app.post(`/v1/dares/:dareId/${path}`, async (c) => {
      const dareId = id.safeParse(c.req.param('dareId'));
      if (!dareId.success) return c.json(error('invalid_dare_id', 'A valid dare ID is required'), 400);
      const response = await result(() => repository[method](c.get('identity').id, dareId.data));
      return response.ok
        ? c.json({ dare: response.value })
        : c.json(error(response.cause.code, response.cause.message), response.cause.status);
    });
  }
}
