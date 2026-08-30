import { z } from 'zod';

const optionalString = z.preprocess((value) => value === '' ? undefined : value, z.string().min(1).optional());
const optionalUuid = z.preprocess((value) => value === '' ? undefined : value, z.string().uuid().optional());
const corsOrigins = z.string().default('https://sauci.app').transform((value, ctx) => {
  const origins = value.split(',').map((origin) => origin.trim()).filter(Boolean);
  if (origins.length === 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'CORS_ALLOWED_ORIGINS must contain at least one origin' });
    return z.NEVER;
  }
  for (const origin of origins) {
    try {
      const parsed = new URL(origin);
      if (parsed.origin !== origin || parsed.username || parsed.password || parsed.pathname !== '/') {
        throw new Error('not an origin');
      }
    } catch {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Invalid CORS origin: ${origin}` });
      return z.NEVER;
    }
  }
  return origins;
});

const baseSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3003),
  CORS_ALLOWED_ORIGINS: corsOrigins,
  DATABASE_URL: z.string().url(),
  DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(200).default(10),
  DATABASE_POOL_IDLE_TIMEOUT_MS: z.coerce.number().int().min(0).max(3_600_000).default(30_000),
  DATABASE_POOL_CONNECTION_TIMEOUT_MS: z.coerce.number().int().min(0).max(60_000).default(10_000),
  SUPABASE_AUTH_URL: z.string().url().optional(),
  SUPABASE_AUTH_ISSUER: z.string().url().optional(),
  SUPABASE_AUTH_JWKS_URL: z.string().url().optional(),
  SUPABASE_AUTH_AUDIENCE: z.string().min(1).default('authenticated'),
  AUTH_TEST_JWKS: z.string().optional(),
  MEDIA_ROOT: z.string().min(1).default('/data/media'),
  MEDIA_SIGNING_SECRET: z.string().min(32).optional(),
  MEDIA_PUBLIC_BASE_URL: z.string().url().optional(),
  SUPABASE_AUTH_SERVICE_ROLE_KEY: optionalString,
  REVENUECAT_API_KEY: optionalString,
  REVENUECAT_ENTITLEMENT_ID: z.string().min(1).default('Sauci Pro'),
  REVENUECAT_WEBHOOK_SECRET: optionalString,
  ADMIN_API_SERVICE_TOKEN: z.preprocess((value) => value === '' ? undefined : value, z.string().min(32).optional()),
  ADMIN_API_SERVICE_USER_ID: optionalUuid,
  ADMIN_PRIVATE_KEY_JWK: optionalString,
});

export interface AppConfig {
  nodeEnv: 'development' | 'test' | 'production';
  port: number;
  corsAllowedOrigins: string[];
  databaseUrl: string;
  databasePool: { max: number; idleTimeoutMillis: number; connectionTimeoutMillis: number };
  authIssuer: string;
  authJwksUrl?: string;
  authAudience: string;
  authTestJwks?: string;
  mediaRoot: string;
  mediaSigningSecret: string;
  mediaPublicBaseUrl: string;
  supabaseAuthServiceRoleKey?: string;
  revenueCatApiKey?: string;
  revenueCatEntitlementId: string;
  revenueCatWebhookSecret?: string;
  adminApiServiceToken?: string;
  adminApiServiceUserId?: string;
  adminPrivateKeyJwk?: string;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = baseSchema.parse(env);
  if (Boolean(parsed.ADMIN_API_SERVICE_TOKEN) !== Boolean(parsed.ADMIN_API_SERVICE_USER_ID)) {
    throw new Error('ADMIN_API_SERVICE_TOKEN and ADMIN_API_SERVICE_USER_ID must be configured together');
  }
  if (parsed.ADMIN_PRIVATE_KEY_JWK) {
    try { JSON.parse(parsed.ADMIN_PRIVATE_KEY_JWK); } catch { throw new Error('ADMIN_PRIVATE_KEY_JWK must be valid JSON'); }
  }
  if (parsed.AUTH_TEST_JWKS && parsed.NODE_ENV !== 'test') {
    throw new Error('AUTH_TEST_JWKS is forbidden outside NODE_ENV=test');
  }

  const authUrl = parsed.SUPABASE_AUTH_URL?.replace(/\/$/, '');
  const authIssuer = parsed.SUPABASE_AUTH_ISSUER ?? (authUrl ? `${authUrl}/auth/v1` : undefined);
  const authJwksUrl = parsed.SUPABASE_AUTH_JWKS_URL ??
    (authUrl ? `${authUrl}/auth/v1/.well-known/jwks.json` : undefined);

  if (!authIssuer || (!authJwksUrl && !parsed.AUTH_TEST_JWKS)) {
    throw new Error('Supabase Auth issuer and JWKS configuration are required');
  }
  if (parsed.NODE_ENV === 'production' &&
      (new URL(authIssuer).protocol !== 'https:' ||
       (authJwksUrl && new URL(authJwksUrl).protocol !== 'https:'))) {
    throw new Error('Supabase Auth issuer and JWKS URLs must use HTTPS in production');
  }
  if (parsed.NODE_ENV === 'production' && !parsed.MEDIA_SIGNING_SECRET) {
    throw new Error('MEDIA_SIGNING_SECRET is required in production');
  }
  const mediaPublicBaseUrl = parsed.MEDIA_PUBLIC_BASE_URL ?? `http://127.0.0.1:${parsed.PORT}`;
  if (parsed.NODE_ENV === 'production' && new URL(mediaPublicBaseUrl).protocol !== 'https:') {
    throw new Error('MEDIA_PUBLIC_BASE_URL must use HTTPS in production');
  }

  return {
    nodeEnv: parsed.NODE_ENV,
    port: parsed.PORT,
    corsAllowedOrigins: parsed.CORS_ALLOWED_ORIGINS,
    databaseUrl: parsed.DATABASE_URL,
    databasePool: {
      max: parsed.DATABASE_POOL_MAX,
      idleTimeoutMillis: parsed.DATABASE_POOL_IDLE_TIMEOUT_MS,
      connectionTimeoutMillis: parsed.DATABASE_POOL_CONNECTION_TIMEOUT_MS,
    },
    authIssuer,
    authJwksUrl,
    authAudience: parsed.SUPABASE_AUTH_AUDIENCE,
    authTestJwks: parsed.AUTH_TEST_JWKS,
    mediaRoot: parsed.MEDIA_ROOT,
    mediaSigningSecret: parsed.MEDIA_SIGNING_SECRET ?? 'local-media-signing-secret-change-me-123456',
    mediaPublicBaseUrl: mediaPublicBaseUrl.replace(/\/$/, ''),
    supabaseAuthServiceRoleKey: parsed.SUPABASE_AUTH_SERVICE_ROLE_KEY,
    revenueCatApiKey: parsed.REVENUECAT_API_KEY,
    revenueCatEntitlementId: parsed.REVENUECAT_ENTITLEMENT_ID,
    revenueCatWebhookSecret: parsed.REVENUECAT_WEBHOOK_SECRET,
    adminApiServiceToken: parsed.ADMIN_API_SERVICE_TOKEN,
    adminApiServiceUserId: parsed.ADMIN_API_SERVICE_USER_ID,
    adminPrivateKeyJwk: parsed.ADMIN_PRIVATE_KEY_JWK,
  };
}
