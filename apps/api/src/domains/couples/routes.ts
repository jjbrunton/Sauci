import type { ApiErrorResponse } from '@sauci/shared';
import type { Hono } from 'hono';
import { z } from 'zod';
import type { AuthIdentity } from '../../auth.js';
import { CoupleService } from './service.js';
import { CoupleError } from './types.js';

type Variables = { identity: AuthIdentity };
type AuthenticatedApp = Hono<{ Variables: Variables }>;

const joinBody = z.object({ invite_code: z.string() }).strict();

function error(code: string, message: string): ApiErrorResponse {
  return { error: { code, message } };
}

async function route<T>(operation: () => Promise<T>): Promise<
  { ok: true; value: T } | { ok: false; body: ApiErrorResponse; status: 400 | 404 | 409 }
> {
  try {
    return { ok: true, value: await operation() };
  } catch (cause) {
    if (cause instanceof CoupleError) {
      return { ok: false, body: error(cause.code, cause.message), status: cause.status };
    }
    throw cause;
  }
}

export function registerCoupleRoutes(app: AuthenticatedApp, service: CoupleService): void {
  app.get('/v1/couple', async (c) => {
    const result = await route(() => service.getState(c.get('identity').id));
    return result.ok ? c.json(result.value) : c.json(result.body, result.status);
  });

  app.post('/v1/couple', async (c) => {
    const rawBody: unknown = await c.req.json().catch(() => ({}));
    if (typeof rawBody === 'object' && rawBody !== null && Object.keys(rawBody).length === 0) {
      const result = await route(() => service.create(c.get('identity').id));
      return result.ok ? c.json(result.value, 201) : c.json(result.body, result.status);
    }

    const parsed = joinBody.safeParse(rawBody);
    if (!parsed.success) return c.json(error('invalid_invite_code', 'A valid invite_code is required'), 400);
    const result = await route(() => service.join(c.get('identity').id, parsed.data.invite_code));
    return result.ok ? c.json(result.value) : c.json(result.body, result.status);
  });

  app.delete('/v1/couple', async (c) => {
    const result = await route(() => service.cancel(c.get('identity').id));
    return result.ok ? c.json(result.value) : c.json(result.body, result.status);
  });
}
