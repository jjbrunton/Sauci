import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';
import type { AuthIdentity } from '../src/auth.js';
import type { ProfileSettingsRepository } from '../src/domains/profile-settings/repository.js';
import { registerProfileSettingsRoutes } from '../src/domains/profile-settings/routes.js';

const identity: AuthIdentity = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'alice@sauci.test',
  name: 'Alice',
  avatarUrl: null,
};

const preferences = {
  user_id: identity.id,
  matches_enabled: true,
  messages_enabled: true,
  partner_activity_enabled: true,
  nudges_enabled: true,
  pack_changes_enabled: true,
  new_packs_enabled: true,
  streak_milestones_enabled: true,
  streak_reminders_enabled: true,
  weekly_summary_enabled: true,
  unpaired_reminders_enabled: true,
  catchup_reminders_enabled: true,
  dares_enabled: true,
  created_at: '2026-08-27T10:00:00.000Z',
  updated_at: '2026-08-27T10:00:00.000Z',
};

function repository(): ProfileSettingsRepository {
  return {
    updateProfile: vi.fn(async () => undefined),
    updateLastActive: vi.fn(async () => undefined),
    getNotificationPreferences: vi.fn(async () => preferences),
    updateNotificationPreference: vi.fn(async (_userId, key, value) => ({ ...preferences, [key]: value })),
    submitFeedback: vi.fn(async () => ({
      id: '22222222-2222-4222-8222-222222222222',
      created_at: '2026-08-27T10:00:00.000Z',
    })),
    close: vi.fn(async () => undefined),
  };
}

function appWith(repo: ProfileSettingsRepository) {
  const app = new Hono<{ Variables: { identity: AuthIdentity } }>();
  app.use('/v1/*', async (c, next) => {
    c.set('identity', identity);
    await next();
  });
  registerProfileSettingsRoutes(app, repo);
  return app;
}

describe('profile settings routes', () => {
  it('derives profile ownership from auth and accepts the onboarding fields', async () => {
    const repo = repository();
    const response = await appWith(repo).request('/v1/me/profile', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'Alice',
        gender: 'female',
        usage_reason: 'deeper_connection',
        onboarding_completed: true,
        onboarding_version: 1,
        hide_nsfw: true,
        max_intensity: 2,
        show_explicit_content: false,
      }),
    });

    expect(response.status).toBe(200);
    expect(repo.updateProfile).toHaveBeenCalledWith(identity.id, expect.objectContaining({ name: 'Alice' }));
  });

  it('supports activity, public key, push token, and preference updates for only the token owner', async () => {
    const repo = repository();
    const app = appWith(repo);
    expect((await app.request('/v1/me/activity', { method: 'POST' })).status).toBe(204);
    expect(repo.updateLastActive).toHaveBeenCalledWith(identity.id);

    const profileResponse = await app.request('/v1/me/profile', {
      method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ public_key_jwk: { kty: 'RSA', n: 'abc', e: 'AQAB' }, push_token: 'ExponentPushToken[test]' }),
    });
    expect(profileResponse.status).toBe(200);
    expect(repo.updateProfile).toHaveBeenCalledWith(identity.id, expect.objectContaining({ push_token: 'ExponentPushToken[test]' }));

    const preferenceResponse = await app.request('/v1/me/notification-preferences', {
      method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ key: 'messages_enabled', value: false }),
    });
    expect(preferenceResponse.status).toBe(200);
    expect(repo.updateNotificationPreference).toHaveBeenCalledWith(identity.id, 'messages_enabled', false);
  });

  it('accepts text-only feedback and rejects media or client-supplied ownership', async () => {
    const repo = repository();
    const app = appWith(repo);
    const valid = await app.request('/v1/feedback', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'bug', title: 'Broken', description: 'Details', device_info: { os: 'ios' } }),
    });
    expect(valid.status).toBe(201);
    expect(repo.submitFeedback).toHaveBeenCalledWith(identity.id, expect.objectContaining({ title: 'Broken' }));

    for (const body of [
      { type: 'bug', title: 'Broken', description: 'Details', screenshot_url: 'https://example.test/image.png' },
      { type: 'bug', title: 'Broken', description: 'Details', user_id: '33333333-3333-4333-8333-333333333333' },
    ]) {
      expect((await app.request('/v1/feedback', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
      })).status).toBe(400);
    }
  });

  it('rejects unsupported profile and preference fields', async () => {
    const repo = repository();
    const app = appWith(repo);
    expect((await app.request('/v1/me/profile', {
      method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ is_premium: true }),
    })).status).toBe(400);
    expect((await app.request('/v1/me/notification-preferences', {
      method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ key: 'admin_enabled', value: true }),
    })).status).toBe(400);
  });
});

