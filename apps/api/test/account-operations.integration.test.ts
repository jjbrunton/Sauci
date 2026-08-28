import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { PostgresAccountOperationsRepository } from '../src/domains/account-operations/repository.js';

const databaseUrl = process.env.DATABASE_URL;
const localDatabase = databaseUrl ? ['127.0.0.1', 'localhost', '::1'].includes(new URL(databaseUrl).hostname) : false;
if (databaseUrl && !localDatabase) throw new Error('Account operations integration tests only permit a localhost DATABASE_URL');

describe.skipIf(!databaseUrl || !localDatabase)('PostgresAccountOperationsRepository', () => {
  const adminPool = new Pool({ connectionString: databaseUrl });
  const schema = `account_operations_test_${randomUUID().replaceAll('-', '')}`;
  const aliceId = '11111111-1111-4111-8111-111111111111';
  const bobId = '22222222-2222-4222-8222-222222222222';
  const coupleId = '33333333-3333-4333-8333-333333333333';
  const packId = '44444444-4444-4444-8444-444444444444';
  const questionId = '55555555-5555-4555-8555-555555555555';
  let pool: Pool;
  let repository: PostgresAccountOperationsRepository;

  beforeAll(async () => {
    await adminPool.query(`CREATE SCHEMA "${schema}"`);
    const isolatedUrl = new URL(databaseUrl!);
    isolatedUrl.searchParams.set('options', `-c search_path=${schema}`);
    pool = new Pool({ connectionString: isolatedUrl.toString() });
    repository = new PostgresAccountOperationsRepository(isolatedUrl.toString());
    for (const migrationName of [
      '0000_identity_and_feature_interests.sql',
      '0001_couples.sql',
      '0002_packs_catalog_progress.sql',
      '0003_answers_matches.sql',
    ]) {
      const migration = await readFile(new URL(`../drizzle/${migrationName}`, import.meta.url), 'utf8');
      for (const statement of migration.split('--> statement-breakpoint')) {
        if (statement.trim()) await pool.query(statement);
      }
    }
  });

  beforeEach(async () => {
    await pool.query('truncate profiles, couples, question_packs, questions cascade');
    await pool.query('insert into couples (id, invite_code) values ($1, $2)', [coupleId, 'ABCD2345']);
    await pool.query(
      `insert into profiles (id, name, couple_id, push_token) values
       ($1, 'Alice', $3, null), ($2, 'Bob', $3, 'ExponentPushToken[bob]')`,
      [aliceId, bobId, coupleId],
    );
    await pool.query('insert into question_packs (id, name) values ($1, $2)', [packId, 'Core']);
    await pool.query('insert into questions (id, pack_id, text) values ($1, $2, $3)', [questionId, packId, 'Question']);
  });

  afterAll(async () => {
    await repository.close();
    await pool.end();
    await adminPool.query(`DROP SCHEMA "${schema}" CASCADE`);
    await adminPool.end();
  });

  async function addProgress(): Promise<void> {
    await pool.query(
      `insert into responses (id, user_id, question_id, couple_id, answer)
       values ($1, $2, $3, $4, 'yes')`,
      [randomUUID(), aliceId, questionId, coupleId],
    );
    await pool.query(
      `insert into matches (id, couple_id, question_id, match_type)
       values ($1, $2, $3, 'yes_yes')`,
      [randomUUID(), coupleId, questionId],
    );
  }

  it('resets only the authenticated couple progress and retains the relationship', async () => {
    await addProgress();
    await expect(repository.resetProgress(aliceId)).resolves.toEqual({ partnerPushToken: 'ExponentPushToken[bob]' });
    expect((await pool.query('select count(*)::int as count from responses')).rows[0].count).toBe(0);
    expect((await pool.query('select count(*)::int as count from matches')).rows[0].count).toBe(0);
    expect((await pool.query('select count(*)::int as count from profiles where couple_id = $1', [coupleId])).rows[0].count).toBe(2);
  });

  it('deletes shared couple data while retaining both independent profiles', async () => {
    await addProgress();
    await repository.deleteRelationship(aliceId);
    expect((await pool.query('select count(*)::int as count from couples')).rows[0].count).toBe(0);
    expect((await pool.query('select count(*)::int as count from profiles')).rows[0].count).toBe(2);
    expect((await pool.query('select count(*)::int as count from profiles where couple_id is not null')).rows[0].count).toBe(0);
  });

  it('rolls back every local account change when hosted Auth deletion fails', async () => {
    const deleteAuth = vi.fn(async () => { throw new Error('provider unavailable'); });
    await expect(repository.deleteAccount(aliceId, deleteAuth)).rejects.toThrow('provider unavailable');
    expect(deleteAuth).toHaveBeenCalledOnce();
    expect((await pool.query('select count(*)::int as count from couples')).rows[0].count).toBe(1);
    expect((await pool.query('select count(*)::int as count from profiles')).rows[0].count).toBe(2);
    expect((await pool.query('select count(*)::int as count from profiles where couple_id = $1', [coupleId])).rows[0].count).toBe(2);
  });

  it('deletes the local profile and relationship only after Auth confirms', async () => {
    const deleteAuth = vi.fn(async () => undefined);
    await repository.deleteAccount(aliceId, deleteAuth);
    expect((await pool.query('select count(*)::int as count from couples')).rows[0].count).toBe(0);
    expect((await pool.query('select id, couple_id from profiles')).rows).toEqual([{ id: bobId, couple_id: null }]);
  });

  it('updates premium status only for the authenticated profile', async () => {
    await repository.setPremium(aliceId, true);
    expect((await pool.query('select id, is_premium from profiles order by id')).rows).toEqual([
      { id: aliceId, is_premium: true },
      { id: bobId, is_premium: false },
    ]);
  });
});

