import type { Couple, Profile } from '@sauci/shared';
import { Pool, type PoolClient, type QueryResultRow } from 'pg';
import { closeResolvedPool, resolvePool, type DatabaseConnection } from '../../db/pool.js';
import { calculateMatchType, type Answer } from '../answers/types.js';
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

/**
 * A user answering solo banks each answer with couple_id NULL ("sealed"). Once
 * pairing reaches two members, every sealed answer belonging to either member is
 * claimed into the couple, and any question both members now have an answer for
 * gets its match computed and upserted, reusing the same match-type rules the
 * live answer flow uses. This only runs from join(), the one place membership can
 * go from one to two, so it only ever fires once per couple.
 */
async function claimSealedAnswers(client: PoolClient, coupleId: string): Promise<void> {
  await client.query(
    `update responses set couple_id = $1
       where couple_id is null and user_id in (select id from profiles where couple_id = $1)`,
    [coupleId],
  );

  const pairs = await client.query<{
    question_id: string;
    question_type: string;
    a_user: string;
    a_answer: Answer;
    a_data: Record<string, unknown> | null;
    b_user: string;
    b_answer: Answer;
    b_data: Record<string, unknown> | null;
  }>(
    `select r1.question_id, q.question_type,
            r1.user_id a_user, r1.answer a_answer, r1.response_data a_data,
            r2.user_id b_user, r2.answer b_answer, r2.response_data b_data
       from responses r1
       join responses r2 on r2.question_id = r1.question_id and r2.couple_id = r1.couple_id and r2.user_id > r1.user_id
       join questions q on q.id = r1.question_id
      where r1.couple_id = $1`,
    [coupleId],
  );

  for (const pair of pairs.rows) {
    const matchType = calculateMatchType({ id: pair.question_id, question_type: pair.question_type as never }, pair.a_answer, pair.b_answer);
    if (!matchType) {
      await client.query('delete from matches where couple_id = $1 and question_id = $2', [coupleId, pair.question_id]);
      continue;
    }
    const responseSummary = matchType === 'both_answered'
      ? { [pair.a_user]: pair.a_data, [pair.b_user]: pair.b_data }
      : null;
    await client.query(
      `insert into matches(couple_id, question_id, match_type, is_new, response_summary)
       values($1, $2, $3, true, $4)
       on conflict(couple_id, question_id) do update set
         match_type = excluded.match_type, response_summary = excluded.response_summary, is_new = true`,
      [coupleId, pair.question_id, matchType, responseSummary],
    );
  }
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
  private readonly ownsPool: boolean;

  constructor(connection: DatabaseConnection) {
    const resolved = resolvePool(connection);
    this.pool = resolved.pool;
    this.ownsPool = resolved.owned;
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
    const sealedCount = await this.sealedCount(userId);
    if (!profile.couple_id) return { couple: null, partner: null, sealed_count: sealedCount };

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
    if (!couple) return { couple: null, partner: null, sealed_count: sealedCount };
    return {
      couple: toCouple(couple),
      partner: partnerResult.rows[0] ? toProfile(partnerResult.rows[0]) : null,
      sealed_count: sealedCount,
    };
  }

  private async sealedCount(userId: string): Promise<number> {
    const result = await this.pool.query<{ count: number }>(
      'select count(*)::int count from responses where user_id = $1 and couple_id is null',
      [userId],
    );
    return result.rows[0]?.count ?? 0;
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
      await claimSealedAnswers(client, couple.id);
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
    await closeResolvedPool(this.pool, this.ownsPool);
  }
}
