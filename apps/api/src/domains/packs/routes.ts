import type { ApiErrorResponse } from '@sauci/shared';
import type { Hono } from 'hono';
import { z } from 'zod';
import type { AuthIdentity } from '../../auth.js';
import { PacksDomainError, type PacksRepository } from './repository.js';

type PacksApp = Hono<{ Variables: { identity: AuthIdentity } }>;

const uuidSchema = z.string().uuid();
const toggleSchema = z.object({ enabled: z.boolean() }).strict();

function error(code: string, message: string): ApiErrorResponse {
  return { error: { code, message } };
}

export function registerPackRoutes(app: PacksApp, repository: PacksRepository): void {
  app.get('/v1/packs', async (c) => {
    const showAll = c.req.query('showAllIntensities') === 'true';
    return c.json(await repository.getCatalog(c.get('identity').id, showAll));
  });

  app.get('/v1/me/enabled-packs', async (c) =>
    c.json(await repository.getEnabledPacks(c.get('identity').id)));

  app.put('/v1/me/enabled-packs/:packId', async (c) => {
    const packId = uuidSchema.safeParse(c.req.param('packId'));
    if (!packId.success) return c.json(error('invalid_pack_id', 'Pack ID must be a UUID'), 400);
    const body = toggleSchema.safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json(error('invalid_request', 'enabled must be a boolean'), 400);
    try {
      return c.json(await repository.setPackEnabled(c.get('identity').id, packId.data, body.data.enabled));
    } catch (cause) {
      if (cause instanceof PacksDomainError && cause.code === 'no_couple') {
        return c.json(error('no_couple', 'Join a couple before changing packs'), 409);
      }
      if (cause instanceof PacksDomainError && cause.code === 'pack_not_found') {
        return c.json(error('pack_not_found', 'Pack was not found'), 404);
      }
      throw cause;
    }
  });

  app.get('/v1/me/pack-progress', async (c) =>
    c.json(await repository.getPackProgress(c.get('identity').id)));
}

