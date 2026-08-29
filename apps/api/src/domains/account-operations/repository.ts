import { Pool, type PoolClient, type QueryResultRow } from 'pg';
import { closeResolvedPool, resolvePool, type DatabaseConnection } from '../../db/pool.js';
import { AccountOperationError } from './types.js';

interface ProfileOperationRecord extends QueryResultRow {
  couple_id: string | null;
}

interface PartnerRecord extends QueryResultRow {
  push_token: string | null;
}

export interface DestructiveOperationResult {
  partnerPushToken: string | null;
}

export interface AccountOperationsRepository {
  deleteRelationship(userId: string): Promise<DestructiveOperationResult>;
  resetProgress(userId: string): Promise<DestructiveOperationResult>;
  deleteAccount(userId: string, deleteAuthUser: () => Promise<void>): Promise<DestructiveOperationResult>;
  setPremium(userId: string, isPremium: boolean): Promise<void>;
  close(): Promise<void>;
}

async function transaction<T>(pool: Pool, operation: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('begin');
    const result = await operation(client);
    await client.query('commit');
    return result;
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}

async function lockedProfile(client: PoolClient, userId: string): Promise<ProfileOperationRecord> {
  const result = await client.query<ProfileOperationRecord>(
    'select couple_id from profiles where id = $1 for update',
    [userId],
  );
  const profile = result.rows[0];
  if (!profile) throw new AccountOperationError('profile_not_found', 'Profile not found', 404);
  return profile;
}

async function lockCoupleAndPartner(
  client: PoolClient,
  userId: string,
  coupleId: string,
): Promise<PartnerRecord | undefined> {
  await client.query('select id from couples where id = $1 for update', [coupleId]);
  const partner = await client.query<PartnerRecord>(
    `select push_token from profiles
      where couple_id = $1 and id <> $2
      for update`,
    [coupleId, userId],
  );
  return partner.rows[0];
}

export class PostgresAccountOperationsRepository implements AccountOperationsRepository {
  private readonly pool: Pool;
  private readonly ownsPool: boolean;

  constructor(connection: DatabaseConnection) {
    const resolved = resolvePool(connection);
    this.pool = resolved.pool;
    this.ownsPool = resolved.owned;
  }

  async deleteRelationship(userId: string): Promise<DestructiveOperationResult> {
    return transaction(this.pool, async (client) => {
      const profile = await lockedProfile(client, userId);
      if (!profile.couple_id) {
        throw new AccountOperationError('not_paired', 'You are not in a relationship', 400);
      }
      const partner = await lockCoupleAndPartner(client, userId, profile.couple_id);
      await client.query(
        'update profiles set couple_id = null, updated_at = now() where couple_id = $1',
        [profile.couple_id],
      );
      await client.query('delete from couples where id = $1', [profile.couple_id]);
      return { partnerPushToken: partner?.push_token ?? null };
    });
  }

  async resetProgress(userId: string): Promise<DestructiveOperationResult> {
    return transaction(this.pool, async (client) => {
      const profile = await lockedProfile(client, userId);
      if (!profile.couple_id) {
        throw new AccountOperationError('not_paired', 'You are not in a relationship', 400);
      }
      const partner = await lockCoupleAndPartner(client, userId, profile.couple_id);
      // Matches cascade to messages and per-user match archives. Responses are separate.
      await client.query('delete from matches where couple_id = $1', [profile.couple_id]);
      await client.query('delete from responses where couple_id = $1', [profile.couple_id]);
      return { partnerPushToken: partner?.push_token ?? null };
    });
  }

  async deleteAccount(
    userId: string,
    deleteAuthUser: () => Promise<void>,
  ): Promise<DestructiveOperationResult> {
    return transaction(this.pool, async (client) => {
      const profileResult = await client.query<ProfileOperationRecord>(
        'select couple_id from profiles where id = $1 for update',
        [userId],
      );
      const profile = profileResult.rows[0];
      let partner: PartnerRecord | undefined;
      if (profile?.couple_id) {
        partner = await lockCoupleAndPartner(client, userId, profile.couple_id);
        await client.query(
          'update profiles set couple_id = null, updated_at = now() where couple_id = $1 and id <> $2',
          [profile.couple_id, userId],
        );
        await client.query('delete from couples where id = $1', [profile.couple_id]);
      }
      if (profile) await client.query('delete from profiles where id = $1', [userId]);

      // Keep local deletion uncommitted until hosted Auth confirms deletion. A provider
      // failure therefore rolls the entire local transaction back for a safe retry.
      await deleteAuthUser();
      return { partnerPushToken: partner?.push_token ?? null };
    });
  }

  async setPremium(userId: string, isPremium: boolean): Promise<void> {
    const result = await this.pool.query(
      'update profiles set is_premium = $2, updated_at = now() where id = $1',
      [userId, isPremium],
    );
    if (result.rowCount === 0) throw new AccountOperationError('profile_not_found', 'Profile not found', 404);
  }

  async close(): Promise<void> {
    await closeResolvedPool(this.pool, this.ownsPool);
  }
}

