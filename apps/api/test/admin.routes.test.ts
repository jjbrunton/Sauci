import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';
import type { AuthIdentity } from '../src/auth.js';
import type { AdminRepository } from '../src/domains/admin/repository.js';
import { registerAdminRoutes } from '../src/domains/admin/routes.js';
import { AdminError, type AdminPrincipal } from '../src/domains/admin/types.js';
import { FilesystemMediaStorage } from '../src/domains/media/storage.js';

const identity: AuthIdentity = { id: '11111111-1111-4111-8111-111111111111', email: 'admin@test', name: 'Admin', avatarUrl: null };
const principal: AdminPrincipal = { adminId: '22222222-2222-4222-8222-222222222222', userId: identity.id, role: 'pack_creator', permissions: ['manage_packs'] };

function setup(denied = false) {
  const repository: AdminRepository = {
    principal: vi.fn(async (userId) => { if (denied) throw new AdminError('admin_access_denied', 'denied', 403); return { ...principal, userId }; }),
    query: vi.fn(async () => ({ rows: [{ id: 'pack' }], count: 1 })),
    insert: vi.fn(async () => [{ id: 'pack' }]), update: vi.fn(async () => ({ id: 'pack' })),
    delete: vi.fn(async () => undefined), dashboard: vi.fn(async () => ({ packs: 1 })),
    giftPremium: vi.fn(async () => ({ subscription_id: 'sub', expires_at: 'later' })),
    featureInterestCounts: vi.fn(async () => []), users: vi.fn(async () => []), close: vi.fn(async () => undefined),
    authorizeMedia: vi.fn(async () => undefined),
    responseMedia: vi.fn(async () => ({ storageKey: 'response/test.jpg', mimeType: 'image/jpeg' })),
    decryptMessage: vi.fn(async () => ({ content: 'plain' })),
    decryptMedia: vi.fn(async () => ({ bytes: Buffer.from('media'), mimeType: 'image/png' })),
  };
  const app = new Hono<{ Variables: { identity: AuthIdentity } }>();
  app.use('/v1/*', async (c, next) => { c.set('identity', identity); await next(); });
  const mediaStorage = new FilesystemMediaStorage('/tmp/admin-route-media', 'test-signing-secret', 'http://localhost:8787');
  vi.spyOn(mediaStorage, 'read').mockResolvedValue(Buffer.from('response-media'));
  registerAdminRoutes(app, repository, undefined, mediaStorage);
  return { app, repository };
}

describe('admin routes', () => {
  it('returns role claims only after server-side admin lookup', async () => {
    const { app, repository } = setup();
    const response = await app.request('/v1/admin/me');
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ role: 'pack_creator', permissions: ['manage_packs'] });
    expect(repository.principal).toHaveBeenCalledWith(identity.id);
  });

  it('denies authenticated users absent from active admin membership', async () => {
    const response = await setup(true).app.request('/v1/admin/me');
    expect(response.status).toBe(403);
  });

  it('never accepts actor identity or role from mutation bodies', async () => {
    const { app, repository } = setup();
    const response = await app.request('/v1/admin/data/question_packs', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ records: [{ name: 'Pack' }], role: 'super_admin', actor_user_id: 'attacker' }),
    });
    expect(response.status).toBe(400);
    expect(repository.insert).not.toHaveBeenCalled();
  });

  it('passes only validated query and mutation data to the authorized repository', async () => {
    const { app, repository } = setup();
    const queried = await app.request('/v1/admin/query/question_packs', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ columns: ['id', 'name'], filters: [{ column: 'is_public', op: 'eq', value: true }], limit: 20 }),
    });
    expect(queried.status).toBe(200);
    expect(repository.query).toHaveBeenCalledWith(expect.objectContaining({ userId: identity.id }), 'question_packs', expect.objectContaining({ columns: ['id', 'name'], limit: 20 }));
  });

  it('issues short-lived admin-authorized media URLs without exposing storage paths', async () => {
    const { app, repository } = setup();
    const mediaId = '33333333-3333-4333-8333-333333333333';
    const response = await app.request(`/v1/admin/media/${mediaId}/url`);
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(await response.json()).toMatchObject({ url: expect.stringContaining(`/media/${mediaId}/content?`) });
    expect(repository.authorizeMedia).toHaveBeenCalledWith(expect.objectContaining({ userId: identity.id }), mediaId);
  });

  it('accepts explicit lifetime premium grants', async () => {
    const { app, repository } = setup();
    const response = await app.request(`/v1/admin/users/${identity.id}/gift-premium`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ days: null }),
    });
    expect(response.status).toBe(201);
    expect(repository.giftPremium).toHaveBeenCalledWith(expect.objectContaining({ userId: identity.id }), identity.id, null, undefined);
  });

  it('streams response media only after response-scoped repository authorization', async () => {
    const { app, repository } = setup();
    const responseId = '44444444-4444-4444-8444-444444444444';
    const response = await app.request(`/v1/admin/responses/${responseId}/media`);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/jpeg');
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(await response.text()).toBe('response-media');
    expect(repository.responseMedia).toHaveBeenCalledWith(expect.objectContaining({ userId: identity.id }), responseId);
  });

  it('rejects malformed response media identifiers before repository access', async () => {
    const { app, repository } = setup();
    const response = await app.request('/v1/admin/responses/not-a-uuid/media');
    expect(response.status).toBe(400);
    expect(repository.responseMedia).not.toHaveBeenCalled();
  });
});
