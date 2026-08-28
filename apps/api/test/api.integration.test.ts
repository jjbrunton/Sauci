import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { createAuthVerifier } from '../src/auth.js';
import { loadConfig } from '../src/config.js';
import { PostgresRepository } from '../src/db/repository.js';

const databaseUrl = process.env.DATABASE_URL;
const localDatabase = databaseUrl ? ['127.0.0.1', 'localhost', '::1'].includes(new URL(databaseUrl).hostname) : false;
if (databaseUrl && !localDatabase) {
  throw new Error('API integration tests only permit a localhost DATABASE_URL');
}

describe.skipIf(!databaseUrl || !localDatabase)('API + PostgreSQL integration', () => {
  const adminPool = new Pool({ connectionString: databaseUrl });
  const schema = `api_test_${randomUUID().replaceAll('-', '')}`;
  let pool: Pool;
  let repository: PostgresRepository;
  let token: string;
  let app: ReturnType<typeof createApp>;

  beforeAll(async () => {
    await adminPool.query(`CREATE SCHEMA "${schema}"`);
    const isolatedUrl = new URL(databaseUrl!);
    isolatedUrl.searchParams.set('options', `-c search_path=${schema}`);
    pool = new Pool({ connectionString: isolatedUrl.toString() });
    repository = new PostgresRepository(isolatedUrl.toString());
    const migration = (await Promise.all(['0000_identity_and_feature_interests.sql','0014_daily_limit_local_reset.sql']
      .map((name) => readFile(new URL(`../drizzle/${name}`, import.meta.url), 'utf8')))).join('\n--> statement-breakpoint\n');
    for (const statement of migration.split('--> statement-breakpoint')) {
      if (statement.trim()) await pool.query(statement);
    }

    const { publicKey, privateKey } = await generateKeyPair('ES256');
    const publicJwk = await exportJWK(publicKey);
    publicJwk.kid = 'integration-key';
    const issuer = 'https://auth.sauci.test/auth/v1';
    token = await new SignJWT({ email: 'integration@sauci.test', user_metadata: { name: 'Integration' } })
      .setProtectedHeader({ alg: 'ES256', kid: 'integration-key' })
      .setSubject('33333333-3333-4333-8333-333333333333')
      .setIssuer(issuer)
      .setAudience('authenticated')
      .setIssuedAt()
      .setExpirationTime('5m')
      .sign(privateKey);
    const config = loadConfig({
      NODE_ENV: 'test',
      DATABASE_URL: databaseUrl,
      SUPABASE_AUTH_ISSUER: issuer,
      AUTH_TEST_JWKS: JSON.stringify({ keys: [publicJwk] }),
    });
    app = createApp({ auth: createAuthVerifier(config), repository });
  });

  afterAll(async () => {
    await repository.close();
    await pool.end();
    await adminPool.query(`DROP SCHEMA "${schema}" CASCADE`);
    await adminPool.end();
  });

  it('bootstraps identity and persists an isolated interest round-trip', async () => {
    const headers = { authorization: `Bearer ${token}` };
    const me = await app.request('/v1/me', { headers });
    expect(me.status).toBe(200);
    expect(await me.json()).toMatchObject({
      profile: {
        id: '33333333-3333-4333-8333-333333333333',
        email: 'integration@sauci.test',
        name: 'Integration',
        max_intensity: 5,
      },
    });

    expect((await app.request('/v1/me/feature-interests/better-chat', { method: 'PUT', headers })).status).toBe(200);
    expect(await (await app.request('/v1/me/feature-interests/better-chat', { headers })).json())
      .toEqual({ feature: 'better-chat', interested: true });
    expect(await (await app.request('/v1/me/feature-interests/better-chat', { method: 'DELETE', headers })).json())
      .toEqual({ feature: 'better-chat', interested: false });
  });
});
