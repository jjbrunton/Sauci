import type { ApiErrorResponse } from '@sauci/shared';
import type { Hono } from 'hono';
import { z } from 'zod';
import type { AuthIdentity } from '../../auth.js';
import { bearerToken } from '../../auth.js';
import type { AdminRequestAuth } from './auth.js';
import type { AdminRepository } from './repository.js';
import { AdminError } from './types.js';
import type { FilesystemMediaStorage } from '../media/storage.js';

type App = Hono<{ Variables: { identity: AuthIdentity } }>;
const resource = z.string().regex(/^[a-z_][a-z0-9_]*$/);
const queryBody = z.object({
  columns: z.array(z.string().regex(/^[a-z_][a-z0-9_]*$/)).min(1).max(100).optional(),
  filters: z.array(z.object({ column: z.string(), op: z.enum(['eq', 'neq', 'in', 'is', 'gte', 'lte', 'ilike']), value: z.unknown() })).optional(),
  order: z.object({ column: z.string(), ascending: z.boolean().optional() }).optional(),
  limit: z.number().int().positive().max(500).optional(), offset: z.number().int().nonnegative().optional(),
}).strict();
const insertBody = z.object({ records: z.array(z.record(z.unknown())).min(1) }).strict();
const updateBody = z.object({ values: z.record(z.unknown()) }).strict();

function failure(code: string, message: string): ApiErrorResponse { return { error: { code, message } }; }
async function execute<T>(operation: () => Promise<T>) {
  try { return { ok: true as const, value: await operation() }; }
  catch (cause) { if (cause instanceof AdminError) return { ok: false as const, cause }; throw cause; }
}

export function registerAdminRoutes(app: App, repository: AdminRepository, auth?: AdminRequestAuth, mediaStorage?: FilesystemMediaStorage): void {
  if (auth) {
    app.use('/v1/admin/*', async (c, next) => {
      const token = bearerToken(c.req.header('authorization'));
      if (!token) return c.json(failure('unauthorized', 'A bearer token is required'), 401);
      try { c.set('identity', await auth.verify(token)); }
      catch { return c.json(failure('unauthorized', 'The bearer token is invalid'), 401); }
      await next();
    });
  }
  app.get('/v1/admin/me', async (c) => {
    const result = await execute(() => repository.principal(c.get('identity').id));
    return result.ok ? c.json({ role: result.value.role, permissions: result.value.permissions }) : c.json(failure(result.cause.code, result.cause.message), result.cause.status);
  });

  app.post('/v1/admin/query/:resource', async (c) => {
    const parsedResource = resource.safeParse(c.req.param('resource'));
    const parsedBody = queryBody.safeParse(await c.req.json().catch(() => ({})));
    if (!parsedResource.success || !parsedBody.success) return c.json(failure('invalid_admin_query', 'Invalid admin query'), 400);
    const result = await execute(async () => repository.query(await repository.principal(c.get('identity').id), parsedResource.data, parsedBody.data));
    return result.ok ? c.json(result.value) : c.json(failure(result.cause.code, result.cause.message), result.cause.status);
  });

  app.post('/v1/admin/data/:resource', async (c) => {
    const parsedResource = resource.safeParse(c.req.param('resource'));
    const parsedBody = insertBody.safeParse(await c.req.json().catch(() => ({})));
    if (!parsedResource.success || !parsedBody.success) return c.json(failure('invalid_admin_mutation', 'Invalid admin mutation'), 400);
    const result = await execute(async () => repository.insert(await repository.principal(c.get('identity').id), parsedResource.data, parsedBody.data.records));
    return result.ok ? c.json({ rows: result.value }, 201) : c.json(failure(result.cause.code, result.cause.message), result.cause.status);
  });

  app.patch('/v1/admin/data/:resource/:id', async (c) => {
    const parsedResource = resource.safeParse(c.req.param('resource'));
    const parsedBody = updateBody.safeParse(await c.req.json().catch(() => ({})));
    if (!parsedResource.success || !parsedBody.success) return c.json(failure('invalid_admin_mutation', 'Invalid admin mutation'), 400);
    const result = await execute(async () => repository.update(await repository.principal(c.get('identity').id), parsedResource.data, c.req.param('id'), parsedBody.data.values));
    return result.ok ? c.json({ row: result.value }) : c.json(failure(result.cause.code, result.cause.message), result.cause.status);
  });

  app.delete('/v1/admin/data/:resource/:id', async (c) => {
    const parsedResource = resource.safeParse(c.req.param('resource'));
    if (!parsedResource.success) return c.json(failure('invalid_admin_mutation', 'Invalid admin mutation'), 400);
    const result = await execute(async () => repository.delete(await repository.principal(c.get('identity').id), parsedResource.data, c.req.param('id')));
    return result.ok ? c.json({ deleted: true }) : c.json(failure(result.cause.code, result.cause.message), result.cause.status);
  });

  app.get('/v1/admin/dashboard', async (c) => {
    const result = await execute(async () => repository.dashboard(await repository.principal(c.get('identity').id)));
    return result.ok ? c.json(result.value) : c.json(failure(result.cause.code, result.cause.message), result.cause.status);
  });

  app.get('/v1/admin/users', async (c) => {
    const result = await execute(async () => repository.users(await repository.principal(c.get('identity').id), c.req.query('userId')));
    return result.ok ? c.json({ users: result.value }) : c.json(failure(result.cause.code, result.cause.message), result.cause.status);
  });

  app.get('/v1/admin/feature-interest-counts', async (c) => {
    const result = await execute(async () => repository.featureInterestCounts(await repository.principal(c.get('identity').id)));
    return result.ok ? c.json({ counts: result.value }) : c.json(failure(result.cause.code, result.cause.message), result.cause.status);
  });

  app.get('/v1/admin/media/:mediaId/url', async (c) => {
    const parsed = z.string().uuid().safeParse(c.req.param('mediaId'));
    if (!parsed.success) return c.json(failure('invalid_media_id', 'A valid media ID is required'), 400);
    if (!mediaStorage) return c.json(failure('media_unavailable', 'Media storage is unavailable'), 503);
    const result = await execute(async () => {
      await repository.authorizeMedia(await repository.principal(c.get('identity').id), parsed.data);
      return mediaStorage.signedUrl(parsed.data, 300);
    });
    return result.ok ? c.json(result.value, 200, { 'cache-control': 'private, no-store' }) : c.json(failure(result.cause.code, result.cause.message), result.cause.status);
  });

  app.get('/v1/admin/responses/:responseId/media', async (c) => {
    const parsed = z.string().uuid().safeParse(c.req.param('responseId'));
    if (!parsed.success) return c.json(failure('invalid_response_id', 'A valid response ID is required'), 400);
    if (!mediaStorage) return c.json(failure('media_unavailable', 'Media storage is unavailable'), 503);
    const result = await execute(async () => {
      const media = await repository.responseMedia(await repository.principal(c.get('identity').id), parsed.data);
      const bytes = await mediaStorage.read(media.storageKey).catch(() => {
        throw new AdminError('response_media_not_found', 'Response media not found', 404);
      });
      return { ...media, bytes };
    });
    if (!result.ok) return c.json(failure(result.cause.code, result.cause.message), result.cause.status);
    return c.body(new Uint8Array(result.value.bytes), 200, {
      'content-type': result.value.mimeType,
      'content-length': String(result.value.bytes.byteLength),
      'cache-control': 'private, no-store',
      'x-content-type-options': 'nosniff',
    });
  });

  app.post('/v1/admin/users/:userId/gift-premium', async (c) => {
    const parsed = z.object({ days: z.number().int().min(1).max(3650).nullable(), reason: z.string().trim().max(500).optional() }).strict()
      .safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) return c.json(failure('invalid_gift', 'A valid premium duration is required'), 400);
    const result = await execute(async () => repository.giftPremium(await repository.principal(c.get('identity').id), c.req.param('userId'), parsed.data.days, parsed.data.reason));
    return result.ok ? c.json(result.value, 201) : c.json(failure(result.cause.code, result.cause.message), result.cause.status);
  });

  app.post('/v1/admin/actions/decrypt-message', async (c) => {
    const parsed = z.object({ messageId: z.string().uuid() }).strict().safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) return c.json(failure('invalid_message_id', 'A valid message ID is required'), 400);
    const result = await execute(async () => repository.decryptMessage(await repository.principal(c.get('identity').id), parsed.data.messageId));
    return result.ok ? c.json(result.value) : c.json(failure(result.cause.code, result.cause.message), result.cause.status);
  });

  app.post('/v1/admin/actions/decrypt-media', async (c) => {
    const parsed = z.object({ messageId: z.string().uuid() }).strict().safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) return c.json(failure('invalid_message_id', 'A valid message ID is required'), 400);
    const result = await execute(async () => repository.decryptMedia(await repository.principal(c.get('identity').id), parsed.data.messageId));
    if (!result.ok) return c.json(failure(result.cause.code, result.cause.message), result.cause.status);
    return c.body(new Uint8Array(result.value.bytes), 200, { 'content-type': result.value.mimeType, 'cache-control': 'private, no-store' });
  });
}
