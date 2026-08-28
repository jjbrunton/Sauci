import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PostgresPacksRepository } from '../src/domains/packs/repository.js';

const databaseUrl = process.env.DATABASE_URL;
const isLocal = databaseUrl
  ? ['127.0.0.1', 'localhost', '::1'].includes(new URL(databaseUrl).hostname)
  : false;
if (databaseUrl && !isLocal) throw new Error('Pack integration tests only permit a localhost DATABASE_URL');

describe.skipIf(!databaseUrl || !isLocal)('packs repository + PostgreSQL', () => {
  const adminPool = new Pool({ connectionString: databaseUrl });
  const schema = `packs_test_${randomUUID().replaceAll('-', '')}`;
  const userId = '11111111-1111-4111-8111-111111111111';
  const otherUserId = '22222222-2222-4222-8222-222222222222';
  const coupleId = '33333333-3333-4333-8333-333333333333';
  const otherCoupleId = '44444444-4444-4444-8444-444444444444';
  const categoryId = '55555555-5555-4555-8555-555555555555';
  const packId = '66666666-6666-4666-8666-666666666666';
  const explicitPackId = '77777777-7777-4777-8777-777777777777';
  const questionId = '88888888-8888-4888-8888-888888888888';
  let pool: Pool;
  let repository: PostgresPacksRepository;

  beforeAll(async () => {
    await adminPool.query(`create schema "${schema}"`);
    const isolatedUrl = new URL(databaseUrl!);
    isolatedUrl.searchParams.set('options', `-c search_path=${schema}`);
    pool = new Pool({ connectionString: isolatedUrl.toString() });
    repository = new PostgresPacksRepository(isolatedUrl.toString());
    for (const migrationName of [
      '0000_identity_and_feature_interests.sql',
      '0001_couples.sql',
      '0002_packs_catalog_progress.sql',
      '0011_question_pack_average_precision.sql',
    ]) {
      const migration = await readFile(new URL(`../drizzle/${migrationName}`, import.meta.url), 'utf8');
      for (const statement of migration.split('--> statement-breakpoint')) {
        if (statement.trim()) await pool.query(statement);
      }
    }
    await pool.query(`
      create table pack_change_calls (couple_id uuid not null, user_id uuid not null);
      create function queue_pack_change(p_couple_id uuid, p_user_id uuid) returns void
      language sql as $$
        insert into pack_change_calls (couple_id, user_id) values (p_couple_id, p_user_id)
      $$;
    `);
    await pool.query(
      'insert into couples (id, invite_code) values ($1, $2), ($3, $4)',
      [coupleId, 'PACKTEST', otherCoupleId, 'PACKTST2'],
    );
    await pool.query(
      'insert into profiles (id, couple_id, hide_nsfw) values ($1, $2, true), ($3, $4, false)',
      [userId, coupleId, otherUserId, otherCoupleId],
    );
    await pool.query(
      "insert into categories (id, name, sort_order) values ($1, 'Conversation', 1)",
      [categoryId],
    );
    await pool.query(`
      insert into question_packs (id, name, category_id, sort_order, max_intensity, avg_intensity) values
        ($1, 'Starter', $3, 1, 2, 3.36),
        ($2, 'Explicit', $3, 2, 5, null)
    `, [packId, explicitPackId, categoryId]);
    await pool.query('update question_packs set is_explicit = true where id = $1', [explicitPackId]);
    await pool.query(
      "insert into questions (id, pack_id, text) values ($1, $2, 'Question')",
      [questionId, packId],
    );
    await pool.query(`
      insert into responses (id, user_id, question_id, couple_id, answer)
      values ($1, $2, $3, $4, 'yes')
    `, ['99999999-9999-4999-8999-999999999999', userId, questionId, coupleId]);
    await pool.query(
      'insert into couple_packs (couple_id, pack_id, enabled) values ($1, $2, true)',
      [otherCoupleId, packId],
    );
  });

  afterAll(async () => {
    await repository.close();
    await pool.end();
    await adminPool.query(`drop schema "${schema}" cascade`);
    await adminPool.end();
  });

  it('filters explicit catalog content using server-side profile preferences', async () => {
    const hidden = await repository.getCatalog(userId, false);
    const visible = await repository.getCatalog(otherUserId, true);
    expect(hidden.packs.map((pack) => pack.id)).toEqual([packId]);
    expect(hidden.packs[0]?.avg_intensity).toBe(3.36);
    expect(visible.packs.map((pack) => pack.id)).toEqual([packId, explicitPackId]);
    expect(hidden.packs[0]?.questions).toEqual([{ count: 1 }]);
  });

  it('isolates enabled packs by the token user couple', async () => {
    expect(await repository.getEnabledPacks(userId)).toEqual({ enabledPackIds: [] });
    expect(await repository.getEnabledPacks(otherUserId)).toEqual({ enabledPackIds: [packId] });

    await repository.setPackEnabled(userId, packId, true);
    expect(await repository.getEnabledPacks(userId)).toEqual({ enabledPackIds: [packId] });
    await repository.setPackEnabled(userId, packId, true);
    await repository.setPackEnabled(userId, packId, false);
    expect((await pool.query('select * from pack_change_calls')).rows).toEqual([
      { couple_id: coupleId, user_id: userId },
    ]);
  });

  it('counts only the token user responses', async () => {
    const own = await repository.getPackProgress(userId);
    const other = await repository.getPackProgress(otherUserId);
    expect(own.progress.find((item) => item.packId === packId)).toMatchObject({
      totalQuestions: 1, answeredQuestions: 1,
    });
    expect(other.progress.find((item) => item.packId === packId)).toMatchObject({
      totalQuestions: 1, answeredQuestions: 0,
    });
  });
});
