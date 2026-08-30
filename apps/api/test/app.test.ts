import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import type { AuthIdentity, AuthVerifier } from '../src/auth.js';
import type {
  ApiRepository,
  MobileCompatibleProfile,
} from '../src/db/repository.js';
import { flushTelemetry, setTelemetrySinkForTests, type TelemetryRecord } from '../src/telemetry.js';

const alice: AuthIdentity = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'alice@sauci.test',
  name: 'Alice',
  avatarUrl: null,
};

class MemoryRepository implements ApiRepository {
  profiles = new Map<string, MobileCompatibleProfile>();
  interests = new Set<string>();
  ready = vi.fn(async () => undefined);
  close = vi.fn(async () => undefined);

  async upsertProfile(identity: AuthIdentity): Promise<MobileCompatibleProfile> {
    const existing = this.profiles.get(identity.id);
    if (existing) return existing;
    const now = new Date().toISOString();
    const profile: MobileCompatibleProfile = {
      id: identity.id,
      name: identity.name,
      email: identity.email,
      avatar_url: identity.avatarUrl,
      push_token: null,
      is_premium: false,
      couple_id: null,
      gender: null,
      show_explicit_content: true,
      max_intensity: 5,
      public_key_jwk: null,
      hide_nsfw: false,
      onboarding_completed: false,
      onboarding_version: 0,
      created_at: now,
      updated_at: now,
    };
    this.profiles.set(identity.id, profile);
    return profile;
  }

  async getFeatureInterest(userId: string, feature: string) {
    return { feature, interested: this.interests.has(`${userId}:${feature}`) };
  }

  async putFeatureInterest(userId: string, feature: string) {
    this.interests.add(`${userId}:${feature}`);
    return { feature, interested: true };
  }

  async deleteFeatureInterest(userId: string, feature: string) {
    this.interests.delete(`${userId}:${feature}`);
    return { feature, interested: false };
  }
}

function verifier(identity: AuthIdentity = alice): AuthVerifier {
  return {
    verify: vi.fn(async (token: string) => {
      if (token !== 'valid') throw new Error('invalid');
      return identity;
    }),
  };
}

describe('Sauci API', () => {
  it('reports liveness without touching the database and readiness with a database check', async () => {
    const repository = new MemoryRepository();
    const app = createApp({ auth: verifier(), repository });

    expect(await (await app.request('/health/live')).json()).toEqual({ status: 'ok' });
    expect(repository.ready).not.toHaveBeenCalled();
    expect((await app.request('/health/ready')).status).toBe(200);
    expect(repository.ready).toHaveBeenCalledOnce();
  });

  it('allows browser preflight requests only from configured web origins', async () => {
    const app = createApp({
      auth: verifier(),
      repository: new MemoryRepository(),
      corsAllowedOrigins: ['http://127.0.0.1:3010', 'https://sauci.app'],
    });
    const response = await app.request('/public/v1/redemptions', {
      method: 'OPTIONS',
      headers: {
        origin: 'http://127.0.0.1:3010',
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'content-type',
      },
    });

    expect(response.status).toBe(204);
    expect(response.headers.get('access-control-allow-origin')).toBe('http://127.0.0.1:3010');
    expect(response.headers.get('access-control-allow-methods')).toContain('POST');

    const rejected = await app.request('/public/v1/redemptions', {
      method: 'OPTIONS',
      headers: {
        origin: 'https://unapproved.example',
        'access-control-request-method': 'POST',
      },
    });
    expect(rejected.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('fails closed when the bearer token is missing or invalid', async () => {
    const app = createApp({ auth: verifier(), repository: new MemoryRepository() });
    expect((await app.request('/v1/me')).status).toBe(401);
    expect((await app.request('/v1/me', { headers: { authorization: 'Bearer invalid' } })).status).toBe(401);
  });

  it('idempotently bootstraps the authenticated profile', async () => {
    const repository = new MemoryRepository();
    const app = createApp({ auth: verifier(), repository });
    const request = () => app.request('/v1/me', { headers: { authorization: 'Bearer valid' } });

    const first = await (await request()).json() as { profile: MobileCompatibleProfile };
    const second = await (await request()).json() as { profile: MobileCompatibleProfile };
    expect(first.profile).toMatchObject({ id: alice.id, email: alice.email, name: 'Alice' });
    expect(second.profile).toEqual(first.profile);
    expect(repository.profiles.size).toBe(1);
  });

  it('derives feature-interest ownership exclusively from the token', async () => {
    const repository = new MemoryRepository();
    const app = createApp({ auth: verifier(), repository });
    const headers = { authorization: 'Bearer valid' };

    expect(await (await app.request('/v1/me/feature-interests/better-chat', { headers })).json())
      .toEqual({ feature: 'better-chat', interested: false });
    expect(await (await app.request('/v1/me/feature-interests/better-chat', { method: 'PUT', headers })).json())
      .toEqual({ feature: 'better-chat', interested: true });
    expect(repository.interests.has(`${alice.id}:better-chat`)).toBe(true);
    expect(await (await app.request('/v1/me/feature-interests/better-chat', { method: 'DELETE', headers })).json())
      .toEqual({ feature: 'better-chat', interested: false });
  });

  it('rejects non-canonical feature names', async () => {
    const app = createApp({ auth: verifier(), repository: new MemoryRepository() });
    const response = await app.request('/v1/me/feature-interests/Not%20Safe', {
      headers: { authorization: 'Bearer valid' },
    });
    expect(response.status).toBe(400);
  });

  it('logs only a route template and status class, never raw UUIDs or auth values', async () => {
    const records: TelemetryRecord[] = []; const restore = setTelemetrySinkForTests((record) => records.push(record));
    const app = createApp({ auth: verifier(), repository: new MemoryRepository() });
    await app.request('/v1/me/11111111-1111-4111-8111-111111111111?token=private-token', { headers: { authorization: 'Bearer private-token' } });
    flushTelemetry(); restore();
    const serialized = JSON.stringify(records);
    expect(records).toContainEqual(expect.objectContaining({ event: 'request', status_class: '4xx' }));
    expect(serialized).not.toContain('11111111-1111-4111-8111-111111111111');
    expect(serialized).not.toContain('private-token');
  });
});
