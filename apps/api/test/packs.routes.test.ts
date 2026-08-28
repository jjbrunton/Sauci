import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';
import type { AuthIdentity } from '../src/auth.js';
import {
  PacksDomainError,
  type PacksRepository,
} from '../src/domains/packs/repository.js';
import { registerPackRoutes } from '../src/domains/packs/routes.js';

const identity: AuthIdentity = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'alice@sauci.test',
  name: 'Alice',
  avatarUrl: null,
};
const packId = '22222222-2222-4222-8222-222222222222';

function repository(): PacksRepository {
  return {
    getCatalog: vi.fn(async () => ({ categories: [], packs: [] })),
    getEnabledPacks: vi.fn(async () => ({ enabledPackIds: [packId] })),
    setPackEnabled: vi.fn(async () => ({ enabledPackIds: [packId] })),
    getPackProgress: vi.fn(async () => ({
      progress: [{ packId, totalQuestions: 4, answeredQuestions: 2 }],
    })),
    close: vi.fn(async () => undefined),
  };
}

function appWith(repository: PacksRepository) {
  const app = new Hono<{ Variables: { identity: AuthIdentity } }>();
  app.use('/v1/*', async (c, next) => {
    c.set('identity', identity);
    await next();
  });
  registerPackRoutes(app, repository);
  return app;
}

describe('pack routes', () => {
  it('derives catalog preferences and progress ownership from the authenticated identity', async () => {
    const repo = repository();
    const app = appWith(repo);

    expect((await app.request('/v1/packs?showAllIntensities=true')).status).toBe(200);
    expect(repo.getCatalog).toHaveBeenCalledWith(identity.id, true);

    expect(await (await app.request('/v1/me/pack-progress')).json()).toEqual({
      progress: [{ packId, totalQuestions: 4, answeredQuestions: 2 }],
    });
    expect(repo.getPackProgress).toHaveBeenCalledWith(identity.id);
  });

  it('updates the token owner couple and never accepts a user or couple ID from the client', async () => {
    const repo = repository();
    const app = appWith(repo);
    const response = await app.request(`/v1/me/enabled-packs/${packId}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ enabled: true }),
    });

    expect(response.status).toBe(200);
    expect(repo.setPackEnabled).toHaveBeenCalledWith(identity.id, packId, true);
  });

  it('rejects malformed pack IDs and request bodies', async () => {
    const repo = repository();
    const app = appWith(repo);

    expect((await app.request('/v1/me/enabled-packs/not-a-uuid', {
      method: 'PUT', headers: { 'content-type': 'application/json' }, body: '{"enabled":true}',
    })).status).toBe(400);
    expect((await app.request(`/v1/me/enabled-packs/${packId}`, {
      method: 'PUT', headers: { 'content-type': 'application/json' }, body: '{"enabled":"yes"}',
    })).status).toBe(400);
    expect(repo.setPackEnabled).not.toHaveBeenCalled();
  });

  it('maps couple and visibility failures without leaking another couple', async () => {
    const repo = repository();
    vi.mocked(repo.setPackEnabled).mockRejectedValueOnce(new PacksDomainError('no_couple'));
    const app = appWith(repo);
    const response = await app.request(`/v1/me/enabled-packs/${packId}`, {
      method: 'PUT', headers: { 'content-type': 'application/json' }, body: '{"enabled":false}',
    });

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: { code: 'no_couple', message: 'Join a couple before changing packs' },
    });
  });
});
