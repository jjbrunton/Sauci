import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import { describe, expect, it } from 'vitest';
import { createAuthVerifier } from '../src/auth.js';
import { loadConfig } from '../src/config.js';

const issuer = 'https://auth.sauci.test/auth/v1';

async function signedToken(audience = 'authenticated') {
  const { publicKey, privateKey } = await generateKeyPair('ES256');
  const publicJwk = await exportJWK(publicKey);
  publicJwk.kid = 'test-key';
  const token = await new SignJWT({
    email: 'user@sauci.test',
    user_metadata: { full_name: 'Test User', avatar_url: 'https://example.test/avatar.png' },
  })
    .setProtectedHeader({ alg: 'ES256', kid: 'test-key' })
    .setSubject('22222222-2222-4222-8222-222222222222')
    .setIssuer(issuer)
    .setAudience(audience)
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(privateKey);
  return { token, jwks: JSON.stringify({ keys: [publicJwk] }) };
}

describe('Supabase Auth JWT verification', () => {
  it('verifies issuer, audience, signature and maps identity claims', async () => {
    const { token, jwks } = await signedToken();
    const config = loadConfig({
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://localhost/sauci_test',
      SUPABASE_AUTH_ISSUER: issuer,
      AUTH_TEST_JWKS: jwks,
    });

    await expect(createAuthVerifier(config).verify(token)).resolves.toEqual({
      id: '22222222-2222-4222-8222-222222222222',
      email: 'user@sauci.test',
      name: 'Test User',
      avatarUrl: 'https://example.test/avatar.png',
    });
  });

  it('rejects a token for another audience', async () => {
    const { token, jwks } = await signedToken('another-service');
    const config = loadConfig({
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://localhost/sauci_test',
      SUPABASE_AUTH_ISSUER: issuer,
      AUTH_TEST_JWKS: jwks,
    });
    await expect(createAuthVerifier(config).verify(token)).rejects.toThrow();
  });

  it('refuses test JWKS configuration outside the test environment', async () => {
    const { jwks } = await signedToken();
    expect(() => loadConfig({
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://localhost/sauci',
      SUPABASE_AUTH_ISSUER: issuer,
      AUTH_TEST_JWKS: jwks,
    })).toThrow('AUTH_TEST_JWKS is forbidden');
  });

  it('treats empty optional deployment integrations as disabled', async () => {
    const { jwks } = await signedToken();
    const config = loadConfig({
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://localhost/sauci_test',
      SUPABASE_AUTH_ISSUER: issuer,
      AUTH_TEST_JWKS: jwks,
      SUPABASE_AUTH_SERVICE_ROLE_KEY: '',
      REVENUECAT_API_KEY: '',
      REVENUECAT_WEBHOOK_SECRET: '',
      ADMIN_API_SERVICE_TOKEN: '',
      ADMIN_API_SERVICE_USER_ID: '',
      ADMIN_PRIVATE_KEY_JWK: '',
    });
    expect(config).toMatchObject({
      supabaseAuthServiceRoleKey: undefined,
      revenueCatApiKey: undefined,
      revenueCatWebhookSecret: undefined,
      adminApiServiceToken: undefined,
      adminApiServiceUserId: undefined,
      adminPrivateKeyJwk: undefined,
    });
  });
});
