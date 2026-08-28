import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';
import type { AuthIdentity } from '../src/auth.js';
import type { ChatRepository } from '../src/domains/chat/repository.js';
import { registerChatRoutes } from '../src/domains/chat/routes.js';

const identity: AuthIdentity = { id: '11111111-1111-4111-8111-111111111111', email: null, name: null, avatarUrl: null };
const matchId = '22222222-2222-4222-8222-222222222222';
const messageId = '33333333-3333-4333-8333-333333333333';
const message = { id: messageId, match_id: matchId, user_id: identity.id, content: 'hello', created_at: new Date().toISOString(), read_at: null, delivered_at: null, deleted_at: null, media_path: null, media_type: null, media_expires_at: null, media_expired: false, media_viewed_at: null, version: 1, encrypted_content: null, encryption_iv: null, keys_metadata: null, moderation_status: null, flag_reason: null, category: null };

function setup() {
  const repository: ChatRepository = {
    listMessages: vi.fn(async () => [message]), sendText: vi.fn(async () => message),
    unreadCounts: vi.fn(async () => ({ total: 1, by_match: { [matchId]: 1 } })),
    markMatchRead: vi.fn(async () => ({ updated: 1, read_at: new Date().toISOString() })),
    markDelivered: vi.fn(async () => message), deleteForSelf: vi.fn(async () => undefined),
    deleteForEveryone: vi.fn(async () => ({ ...message, deleted_at: new Date().toISOString() })),
    report: vi.fn(async () => undefined), setTyping: vi.fn(async () => undefined),
    getPartnerTyping: vi.fn(async () => ({ typing: true, expires_at: new Date().toISOString() })),
    close: vi.fn(async () => undefined),
  };
  const app = new Hono<{ Variables: { identity: AuthIdentity } }>();
  app.use('/v1/*', async (c, next) => { c.set('identity', identity); await next(); });
  registerChatRoutes(app, repository);
  return { app, repository };
}

describe('chat routes', () => {
  it('derives sender and read ownership from the bearer identity', async () => {
    const { app, repository } = setup();
    const sent = await app.request(`/v1/matches/${matchId}/messages`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ content: ' hello ' }) });
    expect(sent.status).toBe(201);
    expect(repository.sendText).toHaveBeenCalledWith(identity.id, matchId, 'hello');
    await app.request(`/v1/matches/${matchId}/read`, { method: 'POST' });
    expect(repository.markMatchRead).toHaveBeenCalledWith(identity.id, matchId);
  });

  it('rejects client-supplied ownership fields', async () => {
    const { app, repository } = setup();
    const response = await app.request(`/v1/matches/${matchId}/messages`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ content: 'hello', user_id: 'attacker' }) });
    expect(response.status).toBe(400);
    expect(repository.sendText).not.toHaveBeenCalled();
  });

  it('supports unread, typing, deletion and reporting actions', async () => {
    const { app, repository } = setup();
    expect((await app.request('/v1/chat/unread')).status).toBe(200);
    await app.request(`/v1/matches/${matchId}/typing`, { method: 'PUT' });
    await app.request(`/v1/messages/${messageId}?scope=self`, { method: 'DELETE' });
    await app.request(`/v1/messages/${messageId}/reports`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ reason: 'spam' }) });
    expect(repository.setTyping).toHaveBeenCalledWith(identity.id, matchId, 4_000);
    expect(repository.deleteForSelf).toHaveBeenCalledWith(identity.id, messageId);
    expect(repository.report).toHaveBeenCalledWith(identity.id, messageId, 'spam');
  });
});

