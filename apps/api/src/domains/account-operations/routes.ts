import type { ApiErrorResponse } from '@sauci/shared';
import type { Hono } from 'hono';
import type { AuthIdentity } from '../../auth.js';
import type { AccountOperationsService } from './service.js';
import { AccountOperationError } from './types.js';

type AuthenticatedApp = Hono<{ Variables: { identity: AuthIdentity } }>;

function error(code: string, message: string): ApiErrorResponse {
  return { error: { code, message } };
}

async function run<T>(operation: () => Promise<T>): Promise<
  { ok: true; value: T } |
  { ok: false; body: ApiErrorResponse; status: 400 | 404 | 502 | 503 }
> {
  try {
    return { ok: true, value: await operation() };
  } catch (cause) {
    if (cause instanceof AccountOperationError) {
      return { ok: false, body: error(cause.code, cause.message), status: cause.status };
    }
    throw cause;
  }
}

export function registerAccountOperationRoutes(app: AuthenticatedApp, service: AccountOperationsService): void {
  app.delete('/v1/couple/data', async (c) => {
    const result = await run(() => service.deleteRelationship(c.get('identity').id));
    return result.ok ? c.json(result.value) : c.json(result.body, result.status);
  });

  app.delete('/v1/couple/progress', async (c) => {
    const result = await run(() => service.resetProgress(c.get('identity').id));
    return result.ok ? c.json(result.value) : c.json(result.body, result.status);
  });

  app.delete('/v1/me', async (c) => {
    const result = await run(() => service.deleteAccount(c.get('identity').id));
    return result.ok ? c.json(result.value) : c.json(result.body, result.status);
  });

  app.post('/v1/me/subscription/sync', async (c) => {
    const result = await run(() => service.syncSubscription(c.get('identity').id));
    return result.ok ? c.json(result.value) : c.json(result.body, result.status);
  });
}

