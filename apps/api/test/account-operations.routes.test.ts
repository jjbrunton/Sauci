import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';
import type { AuthIdentity } from '../src/auth.js';
import { registerAccountOperationRoutes } from '../src/domains/account-operations/routes.js';
import type { AccountOperationsService } from '../src/domains/account-operations/service.js';
import { AccountOperationError } from '../src/domains/account-operations/types.js';

const identity: AuthIdentity = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'alice@sauci.test',
  name: 'Alice',
  avatarUrl: null,
};

function service(): AccountOperationsService {
  return {
    deleteRelationship: vi.fn(async () => ({ success: true, message: 'deleted' })),
    resetProgress: vi.fn(async () => ({ success: true, message: 'reset' })),
    deleteAccount: vi.fn(async () => ({ success: true, message: 'deleted' })),
    syncSubscription: vi.fn(async () => ({ success: true, is_premium: true })),
  } as unknown as AccountOperationsService;
}

function appWith(operations: AccountOperationsService) {
  const app = new Hono<{ Variables: { identity: AuthIdentity } }>();
  app.use('/v1/*', async (c, next) => {
    c.set('identity', identity);
    await next();
  });
  registerAccountOperationRoutes(app, operations);
  return app;
}

describe('account operation routes', () => {
  it('derives ownership exclusively from the authenticated identity', async () => {
    const operations = service();
    const app = appWith(operations);
    expect((await app.request('/v1/couple/data', { method: 'DELETE' })).status).toBe(200);
    expect((await app.request('/v1/couple/progress', { method: 'DELETE' })).status).toBe(200);
    expect((await app.request('/v1/me', { method: 'DELETE' })).status).toBe(200);
    expect((await app.request('/v1/me/subscription/sync', { method: 'POST' })).status).toBe(200);
    expect(operations.deleteRelationship).toHaveBeenCalledWith(identity.id);
    expect(operations.resetProgress).toHaveBeenCalledWith(identity.id);
    expect(operations.deleteAccount).toHaveBeenCalledWith(identity.id);
    expect(operations.syncSubscription).toHaveBeenCalledWith(identity.id);
  });

  it('returns a safe structured provider error', async () => {
    const operations = service();
    vi.mocked(operations.deleteAccount).mockRejectedValueOnce(
      new AccountOperationError('auth_delete_failed', 'Failed to delete authentication record', 502),
    );
    const response = await appWith(operations).request('/v1/me', { method: 'DELETE' });
    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      error: { code: 'auth_delete_failed', message: 'Failed to delete authentication record' },
    });
  });
});

