import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';
import type { AuthIdentity } from '../src/auth.js';
import type { CoupleRepository } from '../src/domains/couples/repository.js';
import { registerCoupleRoutes } from '../src/domains/couples/routes.js';
import { CoupleService } from '../src/domains/couples/service.js';

const identity: AuthIdentity = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'alice@sauci.test',
  name: 'Alice',
  avatarUrl: null,
};

function setup() {
  const repository: CoupleRepository = {
    getState: vi.fn(async () => ({ couple: null, partner: null, sealed_count: 0 })),
    create: vi.fn(async (_userId, coupleId, inviteCode) => ({
      id: coupleId,
      invite_code: inviteCode,
      created_at: '2026-08-27T00:00:00.000Z',
    })),
    join: vi.fn(async (_userId, inviteCode) => ({
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      invite_code: inviteCode,
      created_at: '2026-08-27T00:00:00.000Z',
    })),
    cancel: vi.fn(async () => undefined),
    close: vi.fn(async () => undefined),
  };
  const app = new Hono<{ Variables: { identity: AuthIdentity } }>();
  app.use('/v1/*', async (c, next) => {
    c.set('identity', identity);
    await next();
  });
  registerCoupleRoutes(app, new CoupleService(repository));
  return { app, repository };
}

describe('couple routes', () => {
  it('reads only the authenticated user pairing state', async () => {
    const { app, repository } = setup();
    const response = await app.request('/v1/couple');

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ couple: null, partner: null, sealed_count: 0 });
    expect(repository.getState).toHaveBeenCalledWith(identity.id);
  });

  it('creates with an empty body and joins with a canonical invite code', async () => {
    const { app, repository } = setup();
    const created = await app.request('/v1/couple', { method: 'POST', body: '{}' });
    expect(created.status).toBe(201);
    expect(repository.create).toHaveBeenCalledWith(identity.id, expect.any(String), expect.stringMatching(/^[A-Z0-9]{8}$/));

    const joined = await app.request('/v1/couple', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ invite_code: 'abcd2345' }),
    });
    expect(joined.status).toBe(200);
    expect(repository.join).toHaveBeenCalledWith(identity.id, 'ABCD2345');
  });

  it('rejects extra ownership fields instead of trusting the client', async () => {
    const { app, repository } = setup();
    const response = await app.request('/v1/couple', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ invite_code: 'ABCD2345', user_id: 'someone-else' }),
    });
    expect(response.status).toBe(400);
    expect(repository.join).not.toHaveBeenCalled();
  });

  it('cancels the authenticated user pairing', async () => {
    const { app, repository } = setup();
    const response = await app.request('/v1/couple', { method: 'DELETE' });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true, couple_id: null });
    expect(repository.cancel).toHaveBeenCalledWith(identity.id);
  });
});
