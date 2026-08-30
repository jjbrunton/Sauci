import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';
import type { AuthIdentity } from '../src/auth.js';
import { DaresError, type DaresRepository, type SentDare } from '../src/domains/dares/repository.js';
import { registerDareRoutes } from '../src/domains/dares/routes.js';

const identity: AuthIdentity = { id: '11111111-1111-4111-8111-111111111111', email: null, name: null, avatarUrl: null };
const partner = '22222222-2222-4222-8222-222222222222';
const dareId = '33333333-3333-4333-8333-333333333333';
const packId = '44444444-4444-4444-8444-444444444444';
const catalogueDareId = '55555555-5555-4555-8555-555555555555';

const dare: SentDare = {
  id: dareId, couple_id: '66666666-6666-4666-8666-666666666666', dare_id: catalogueDareId,
  text: 'A dare', intensity: 2, is_custom: false, sender_id: identity.id, recipient_id: partner,
  direction: 'outgoing', status: 'pending', sender_notes: null, proof_type: 'none', proof_media_id: null,
  sent_at: new Date().toISOString(), accepted_at: null, submitted_at: null, completed_at: null, expires_at: null,
};

const proofMediaId = '77777777-7777-4777-8777-777777777777';

function setup(overrides: Partial<DaresRepository> = {}) {
  const repository: DaresRepository = {
    getCatalog: vi.fn(async () => ({
      entitlement: { is_premium: false, can_send_custom: false, weekly_send_limit: 3, sends_remaining: 3 },
      packs: [],
    })),
    listPackDares: vi.fn(async () => []),
    listDares: vi.fn(async () => [dare]),
    send: vi.fn(async () => dare),
    respond: vi.fn(async () => ({ ...dare, status: 'active' as const })),
    submit: vi.fn(async () => ({ ...dare, status: 'submitted' as const })),
    complete: vi.fn(async () => ({ ...dare, status: 'completed' as const })),
    cancel: vi.fn(async () => ({ ...dare, status: 'cancelled' as const })),
    stats: vi.fn(async () => ({ sent: 1, received: 0, completed_together: 0, active: 1, completed_by_me: 0, completed_by_partner: 0 })),
    close: vi.fn(async () => undefined),
    ...overrides,
  };
  const app = new Hono<{ Variables: { identity: AuthIdentity } }>();
  app.use('/v1/*', async (c, next) => { c.set('identity', identity); await next(); });
  registerDareRoutes(app, repository);
  return { app, repository };
}

function post(app: Hono<{ Variables: { identity: AuthIdentity } }>, path: string, body?: unknown) {
  return app.request(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe('dare routes', () => {
  it('derives the actor from the bearer identity, never the body', async () => {
    const { app, repository } = setup();
    const response = await post(app, '/v1/dares', {
      dare_id: catalogueDareId,
      sender_notes: '  be brave  ',
    });
    expect(response.status).toBe(201);
    expect(repository.send).toHaveBeenCalledWith(identity.id, expect.objectContaining({ dare_id: catalogueDareId }));
  });

  it('rejects client-supplied ownership fields', async () => {
    const { app } = setup();
    const response = await post(app, '/v1/dares', { dare_id: catalogueDareId, sender_id: partner });
    expect(response.status).toBe(400);
  });

  it('requires exactly one of dare_id or custom text', async () => {
    const { app } = setup();
    expect((await post(app, '/v1/dares', {})).status).toBe(400);
    expect((await post(app, '/v1/dares', { dare_id: catalogueDareId, custom_dare_text: 'both' })).status).toBe(400);
    expect((await post(app, '/v1/dares', { custom_dare_text: 'just text' })).status).toBe(201);
  });

  it('accepts only preset durations', async () => {
    const { app } = setup();
    expect((await post(app, '/v1/dares', { dare_id: catalogueDareId, duration_hours: 24 })).status).toBe(201);
    expect((await post(app, '/v1/dares', { dare_id: catalogueDareId, duration_hours: 5 })).status).toBe(400);
  });

  it('validates identifiers and filters', async () => {
    const { app } = setup();
    expect((await app.request('/v1/dares?filter=nonsense')).status).toBe(400);
    expect((await app.request('/v1/dares/packs/not-a-uuid/dares')).status).toBe(400);
    expect((await post(app, '/v1/dares/not-a-uuid/submit')).status).toBe(400);
    expect((await post(app, `/v1/dares/${dareId}/respond`, { action: 'maybe' })).status).toBe(400);
  });

  it('routes each transition to its repository method', async () => {
    const { app, repository } = setup();
    await post(app, `/v1/dares/${dareId}/respond`, { action: 'decline' });
    expect(repository.respond).toHaveBeenCalledWith(identity.id, dareId, 'decline');
    await post(app, `/v1/dares/${dareId}/submit`);
    expect(repository.submit).toHaveBeenCalledWith(identity.id, dareId, null);
    await post(app, `/v1/dares/${dareId}/complete`);
    expect(repository.complete).toHaveBeenCalledWith(identity.id, dareId);
    await post(app, `/v1/dares/${dareId}/cancel`);
    expect(repository.cancel).toHaveBeenCalledWith(identity.id, dareId);
  });

  it('surfaces domain errors with their status codes', async () => {
    const { app } = setup({
      send: vi.fn(async () => { throw new DaresError('premium_required', 'Custom dares require premium', 402); }),
      submit: vi.fn(async () => { throw new DaresError('invalid_transition', 'A pending dare cannot change to submitted', 409); }),
    });
    const paywalled = await post(app, '/v1/dares', { custom_dare_text: 'mine' });
    expect(paywalled.status).toBe(402);
    expect(await paywalled.json()).toMatchObject({ error: { code: 'premium_required' } });
    expect((await post(app, `/v1/dares/${dareId}/submit`)).status).toBe(409);
  });

  it('accepts a proof requirement on send and rejects unknown ones', async () => {
    const { app, repository } = setup();
    const response = await post(app, '/v1/dares', { dare_id: catalogueDareId, proof_type: 'photo' });
    expect(response.status).toBe(201);
    expect(repository.send).toHaveBeenCalledWith(identity.id, expect.objectContaining({ proof_type: 'photo' }));
    expect((await post(app, '/v1/dares', { dare_id: catalogueDareId, proof_type: 'video' })).status).toBe(400);
  });

  it('passes proof media through on submit and validates its shape', async () => {
    const { app, repository } = setup();
    await post(app, `/v1/dares/${dareId}/submit`, { proof_media_id: proofMediaId });
    expect(repository.submit).toHaveBeenCalledWith(identity.id, dareId, proofMediaId);
    expect((await post(app, `/v1/dares/${dareId}/submit`, { proof_media_id: 'not-a-uuid' })).status).toBe(400);
    expect((await post(app, `/v1/dares/${dareId}/submit`, { extra_field: true })).status).toBe(400);
  });

  it('exposes the duration presets the send sheet offers', async () => {
    const { app } = setup();
    const response = await app.request('/v1/dares/durations');
    expect(await response.json()).toEqual({ presets: [1, 6, 12, 24, 72, 168] });
  });
});
