import type { Couple, Profile } from '@sauci/shared';
import { Pool, type PoolClient, type QueryResultRow } from 'pg';
import { CoupleError, type CoupleStateResponse } from './types.js';

interface ProfileRecord extends QueryResultRow {
  id: string;
  name: string | null;
  email: string | null;
  avatar_url: string | null;
  push_token: string | null;
  is_premium: boolean;
  couple_id: string | null;
  gender: Profile['gender'];
  show_explicit_content: boolean;
  max_intensity: Profile['max_intensity'];
  public_key_jwk: Record<string, unknown> | null;
  hide_nsfw: boolean;
  onboarding_completed: boolean;
  onboarding_version: number;
  created_at: Date;
  updated_at: Date;
}

interface CoupleRecord extends QueryResultRow {
  id: string;
  invite_code: string;
  created_at: Date;
}

export interface CoupleRepository {
  getState(userId: string): Promise<CoupleStateResponse>;
  create(userId: string, coupleId: string, inviteCode: string): Promise<Couple>;
  join(userId: string, inviteCode: string): Promise<Couple>;
  cancel(userId: string): Promise<void>;
  close(): Promise<void>;
}

function toCouple(row: CoupleRecord): Couple {
  return {
    id: row.id,
    invite_code: row.invite_code,
    created_at: row.created_at.toISOString(),
  };
}

function toProfile(row: ProfileRecord): Profile {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    avatar_url: row.avatar_url,
    push_token: row.push_token,
    is_premium: row.is_premium,
    couple_id: row.couple_id,
    gender: row.gender,
    show_explicit_content: row.show_explicit_content,
    max_intensity: row.max_intensity,
    public_key_jwk: row.public_key_jwk,
    hide_nsfw: row.hide_nsfw,
    onboarding_completed: row.onboarding_completed,
    onboarding_version: row.onboarding_version,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  };
}

async function profileForUpdate(client: PoolClient, userId: string): Promise<{ couple_id: string | null }> {
  const result = await client.query<{ couple_id: string | null }>(
    'select couple_id from profiles where id = $1 for update',
    [userId],
  );
  const profile = result.rows[0];
  if (!profile) {
    throw new CoupleError('profile_not_found', 'Profile not found. Please complete signup first.', 404);
  }
  return profile;
}

async function transaction<T>(pool: Pool, work: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('begin');
    const result = await work(client);
    await client.query('commit');
    return result;
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}

export class PostgresCoupleRepository implements CoupleRepository {
  private readonly pool: Pool;

  constructor(databaseUrl: string) {
    this.pool = new Pool({ connectionString: databaseUrl });
  }

  async getState(userId: string): Promise<CoupleStateResponse> {
    const profileResult = await this.pool.query<{ couple_id: string | null }>(
      'select couple_id from profiles where id = $1',
      [userId],
    );
    const profile = profileResult.rows[0];
    if (!profile) {
      throw new CoupleError('profile_not_found', 'Profile not found. Please complete signup first.', 404);
    }
    if (!profile.couple_id) return { couple: null, partner: null };

    const [coupleResult, partnerResult] = await Promise.all([
      this.pool.query<CoupleRecord>(
        'select id, invite_code, created_at from couples where id = $1',
        [profile.couple_id],
      ),
      this.pool.query<ProfileRecord>(
        `select id, name, email, avatar_url, push_token, is_premium, couple_id, gender,
                show_explicit_content, max_intensity, public_key_jwk, hide_nsfw,
                onboarding_completed, onboarding_version, created_at, updated_at
           from profiles
          where couple_id = $1 and id <> $2
          limit 1`,
        [profile.couple_id, userId],
      ),
    ]);
    const couple = coupleResult.rows[0];
    if (!couple) return { couple: null, partner: null };
    return {
      couple: toCouple(couple),
      partner: partnerResult.rows[0] ? toProfile(partnerResult.rows[0]) : null,
    };
  }

  async create(userId: string, coupleId: string, inviteCode: string): Promise<Couple> {
    return transaction(this.pool, async (client) => {
      const profile = await profileForUpdate(client, userId);
      if (profile.couple_id) {
        throw new CoupleError('already_paired', 'You are already in a couple', 409);
      }
      try {
        const result = await client.query<CoupleRecord>(
          'insert into couples (id, invite_code) values ($1, $2) returning id, invite_code, created_at',
          [coupleId, inviteCode],
        );
        await client.query('update profiles set couple_id = $1, updated_at = now() where id = $2', [coupleId, userId]);
        return toCouple(result.rows[0]!);
      } catch (error) {
        if (typeof error === 'object' && error !== null && 'code' in error && error.code === '23505') {
          throw new CoupleError('invite_code_collision', 'Invite code collision', 409);
        }
        throw error;
      }
    });
  }

  async join(userId: string, inviteCode: string): Promise<Couple> {
    return transaction(this.pool, async (client) => {
      const profile = await profileForUpdate(client, userId);
      if (profile.couple_id) {
        throw new CoupleError('already_paired', 'You are already in a couple', 409);
      }

      const coupleResult = await client.query<CoupleRecord>(
        'select id, invite_code, created_at from couples where invite_code = $1 for update',
        [inviteCode],
      );
      const couple = coupleResult.rows[0];
      if (!couple) {
        throw new CoupleError('invalid_invite_code', 'Invalid invite code', 404);
      }

      const memberResult = await client.query<{ count: string }>(
        'select count(*)::text as count from profiles where couple_id = $1',
        [couple.id],
      );
      if (Number(memberResult.rows[0]?.count ?? 0) >= 2) {
        throw new CoupleError('couple_full', 'This couple already has two partners', 409);
      }

      await client.query('update profiles set couple_id = $1, updated_at = now() where id = $2', [couple.id, userId]);
      return toCouple(couple);
    });
  }

  async cancel(userId: string): Promise<void> {
    await transaction(this.pool, async (client) => {
      const profile = await profileForUpdate(client, userId);
      if (!profile.couple_id) {
        throw new CoupleError('not_paired', 'You are not in a couple', 400);
      }
      await client.query('select id from couples where id = $1 for update', [profile.couple_id]);
      await client.query(
        'update profiles set couple_id = null, updated_at = now() where couple_id = $1',
        [profile.couple_id],
      );
      await client.query('delete from couples where id = $1', [profile.couple_id]);
    });
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
