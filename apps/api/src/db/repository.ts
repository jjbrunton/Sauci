import type { FeatureInterestResponse, Profile } from '@sauci/shared';
import { and, eq, sql } from 'drizzle-orm';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { closeResolvedPool, resolvePool, type DatabaseConnection } from './pool.js';
import type { AuthIdentity } from '../auth.js';
import { featureInterests, profiles, type ProfileRow } from './schema.js';

export type MobileCompatibleProfile = Profile & {
  email: string | null;
  gender: 'male' | 'female' | 'non-binary' | 'prefer-not-to-say' | null;
  show_explicit_content: boolean;
  max_intensity: 1 | 2 | 3 | 4 | 5;
};

export interface ApiRepository {
  ready(): Promise<void>;
  upsertProfile(identity: AuthIdentity): Promise<MobileCompatibleProfile>;
  getFeatureInterest(userId: string, feature: string): Promise<FeatureInterestResponse>;
  putFeatureInterest(userId: string, feature: string): Promise<FeatureInterestResponse>;
  deleteFeatureInterest(userId: string, feature: string): Promise<FeatureInterestResponse>;
  close(): Promise<void>;
}

function toProfile(row: ProfileRow): MobileCompatibleProfile {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    avatar_url: row.avatarUrl,
    push_token: row.pushToken,
    is_premium: row.isPremium,
    couple_id: row.coupleId,
    gender: row.gender,
    usage_reason: row.usageReason,
    show_explicit_content: row.showExplicitContent,
    max_intensity: row.maxIntensity as 1 | 2 | 3 | 4 | 5,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
    public_key_jwk: row.publicKeyJwk,
    hide_nsfw: row.hideNsfw,
    onboarding_completed: row.onboardingCompleted,
    onboarding_version: row.onboardingVersion,
  };
}

export class PostgresRepository implements ApiRepository {
  private readonly pool: Pool;
  private readonly ownsPool: boolean;
  private readonly db: NodePgDatabase;

  constructor(connection: DatabaseConnection) {
    const resolved = resolvePool(connection);
    this.pool = resolved.pool;
    this.ownsPool = resolved.owned;
    this.db = drizzle(this.pool);
  }

  async ready(): Promise<void> {
    await this.db.select({ id: profiles.id }).from(profiles).limit(1);
  }

  /**
   * Idempotent for the common case. `GET /v1/me` runs on every app start and on
   * every session refresh, and the previous unconditional upsert made each of
   * those a write that advanced `auth_synced_at` and produced dead row versions
   * for autovacuum. The only fields this sync can actually change are the ones
   * the conflict clause sets, so a profile that already carries the identity's
   * email is returned as read and nothing is written. First-use creation and
   * email enrichment keep their existing behaviour.
   */
  async upsertProfile(identity: AuthIdentity): Promise<MobileCompatibleProfile> {
    const [existing] = await this.db.select().from(profiles).where(eq(profiles.id, identity.id)).limit(1);
    if (existing && (identity.email === null || identity.email === undefined || existing.email === identity.email)) {
      return toProfile(existing);
    }

    const [row] = await this.db.insert(profiles).values({
      id: identity.id,
      name: identity.name,
      avatarUrl: identity.avatarUrl,
      email: identity.email,
    }).onConflictDoUpdate({
      target: profiles.id,
      set: {
        email: sql`coalesce(excluded.email, ${profiles.email})`,
        // Keep the write on the same clock as the column default. API and
        // PostgreSQL hosts can differ slightly, which must not move this
        // monotonic sync marker backwards.
        authSyncedAt: sql`now()`,
      },
    }).returning();

    if (!row) throw new Error('Profile upsert returned no row');
    return toProfile(row);
  }

  async getFeatureInterest(userId: string, feature: string): Promise<FeatureInterestResponse> {
    const [row] = await this.db.select({ feature: featureInterests.feature })
      .from(featureInterests)
      .where(and(eq(featureInterests.userId, userId), eq(featureInterests.feature, feature)))
      .limit(1);
    return { feature, interested: Boolean(row) };
  }

  async putFeatureInterest(userId: string, feature: string): Promise<FeatureInterestResponse> {
    await this.db.insert(featureInterests).values({ userId, feature }).onConflictDoNothing();
    return { feature, interested: true };
  }

  async deleteFeatureInterest(userId: string, feature: string): Promise<FeatureInterestResponse> {
    await this.db.delete(featureInterests)
      .where(and(eq(featureInterests.userId, userId), eq(featureInterests.feature, feature)));
    return { feature, interested: false };
  }

  async close(): Promise<void> {
    await closeResolvedPool(this.pool, this.ownsPool);
  }
}
