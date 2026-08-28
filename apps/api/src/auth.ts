import {
  createLocalJWKSet,
  createRemoteJWKSet,
  jwtVerify,
  type JSONWebKeySet,
  type JWTVerifyGetKey,
  type JWTPayload,
} from 'jose';
import { z } from 'zod';
import type { AppConfig } from './config.js';

const uuidSchema = z.string().uuid();

export interface AuthIdentity {
  id: string;
  email: string | null;
  name: string | null;
  avatarUrl: string | null;
}

export interface AuthVerifier {
  verify(token: string): Promise<AuthIdentity>;
}

function optionalString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null;
}

function identityFromClaims(claims: JWTPayload): AuthIdentity {
  const id = uuidSchema.parse(claims.sub);
  const metadata = claims.user_metadata && typeof claims.user_metadata === 'object'
    ? claims.user_metadata as Record<string, unknown>
    : {};

  return {
    id,
    email: optionalString(claims.email),
    name: optionalString(metadata.full_name) ?? optionalString(metadata.name),
    avatarUrl: optionalString(metadata.avatar_url) ?? optionalString(metadata.picture),
  };
}

export function createAuthVerifier(config: AppConfig): AuthVerifier {
  let keySet: JWTVerifyGetKey;
  if (config.authTestJwks) {
    if (config.nodeEnv !== 'test') {
      throw new Error('Local JWKS verification is forbidden outside test');
    }
    const jwks = JSON.parse(config.authTestJwks) as JSONWebKeySet;
    keySet = createLocalJWKSet(jwks);
  } else {
    if (!config.authJwksUrl) {
      throw new Error('A remote Supabase Auth JWKS URL is required');
    }
    keySet = createRemoteJWKSet(new URL(config.authJwksUrl));
  }

  return {
    async verify(token: string): Promise<AuthIdentity> {
      const { payload } = await jwtVerify(token, keySet, {
        issuer: config.authIssuer,
        audience: config.authAudience,
        algorithms: ['ES256', 'RS256'],
      });
      return identityFromClaims(payload);
    },
  };
}

export function bearerToken(header: string | undefined): string | null {
  if (!header) return null;
  const match = /^Bearer\s+(\S+)$/i.exec(header);
  return match?.[1] ?? null;
}
