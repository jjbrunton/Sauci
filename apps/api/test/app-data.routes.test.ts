import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';
import type { AuthIdentity } from '../src/auth.js';
import type { AppDataRepository } from '../src/domains/app-data/repository.js';
import { registerAppDataRoutes } from '../src/domains/app-data/routes.js';

const identity: AuthIdentity = { id: '11111111-1111-4111-8111-111111111111', email: null, name: null, avatarUrl: null };
const pack = '22222222-2222-4222-8222-222222222222';
const match = '33333333-3333-4333-8333-333333333333';
const message = '44444444-4444-4444-8444-444444444444';
function repository(): AppDataRepository {
  return {
    packContext: vi.fn(async () => ({ id: pack, name: 'Pack', icon: null })),
    packQuestions: vi.fn(async () => []), packTeaser: vi.fn(async () => []),
    matchContext: vi.fn(async () => ({ id: match, question_id: pack, couple_id: pack, match_type: 'yes_yes', created_at: 'now', response_summary: null, question: { id: pack, text: 'Q', partner_text: null }, responses: [] })),
    markMediaViewed: vi.fn(async () => ({ media_viewed_at: 'now', media_expires_at: null })),
    nudgeStatus: vi.fn(async () => ({ last_nudge_sent_at: null })),
    sendNudge: vi.fn(async () => ({ success: true as const, notification_sent: false, reason: 'no_push_token', next_nudge_available_at: 'later' })),
    getLiveDraw: vi.fn(async () => ({ strokes: [], revision: 0, updated_at: null, updated_by: null })),
    putLiveDraw: vi.fn(async () => ({ strokes: [], revision: 1, updated_at: 'now', updated_by: identity.id })),
    close: vi.fn(async () => undefined),
  };
}
function appWith(repo: AppDataRepository) { const app = new Hono<{ Variables: { identity: AuthIdentity } }>(); app.use('/v1/*', async (c, next) => { c.set('identity', identity); await next(); }); registerAppDataRoutes(app, repo); return app; }

describe('app data routes', () => {
  it('derives all ownership from the authenticated identity', async () => {
    const repo = repository(); const app = appWith(repo);
    expect((await app.request(`/v1/packs/${pack}/questions`)).status).toBe(200);
    expect(repo.packQuestions).toHaveBeenCalledWith(identity.id, pack);
    expect((await app.request(`/v1/matches/${match}/context`)).status).toBe(200);
    expect(repo.matchContext).toHaveBeenCalledWith(identity.id, match);
    expect((await app.request('/v1/live-draw')).status).toBe(200);
    expect(repo.getLiveDraw).toHaveBeenCalledWith(identity.id);
    expect((await app.request('/v1/me/nudge', { method: 'POST' })).status).toBe(200);
    expect(repo.sendNudge).toHaveBeenCalledWith(identity.id);
  });
  it('validates IDs, media metadata, and complete drawing shape', async () => {
    const repo = repository(); const app = appWith(repo);
    expect((await app.request('/v1/packs/no/questions')).status).toBe(400);
    expect((await app.request(`/v1/messages/${message}/media-viewed`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: '{}' })).status).toBe(400);
    expect((await app.request('/v1/live-draw', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: '{"strokes":[{"id":"x"}]}' })).status).toBe(400);
    expect(repo.putLiveDraw).not.toHaveBeenCalled();
  });
  it('accepts normalized drawing state without a client supplied couple ID', async () => {
    const repo = repository(); const app = appWith(repo);
    const stroke = { id: 's1', userId: identity.id, points: [{ x: 0.2, y: 0.8 }], color: '#fff', width: 2, timestamp: 1, isEraser: false };
    const response = await app.request('/v1/live-draw', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ strokes: [stroke], base_revision: 0 }) });
    expect(response.status).toBe(200);
    expect(repo.putLiveDraw).toHaveBeenCalledWith(identity.id, [stroke], 0);
  });
});
