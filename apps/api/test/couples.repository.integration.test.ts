import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PostgresCoupleRepository } from '../src/domains/couples/repository.js';

const databaseUrl = process.env.DATABASE_URL;
const localDatabase = databaseUrl ? ['127.0.0.1', 'localhost', '::1'].includes(new URL(databaseUrl).hostname) : false;
if (databaseUrl && !localDatabase) {
  throw new Error('Couples integration tests only permit a localhost DATABASE_URL');
}

describe.skipIf(!databaseUrl || !localDatabase)('PostgresCoupleRepository', () => {
  const adminPool = new Pool({ connectionString: databaseUrl });
  const schema = `couples_test_${randomUUID().replaceAll('-', '')}`;
  let pool: Pool;
  let repository: PostgresCoupleRepository;
  const alice = '11111111-1111-4111-8111-111111111111';
  const bob = '22222222-2222-4222-8222-222222222222';
  const charlie = '33333333-3333-4333-8333-333333333333';

  beforeAll(async () => {
    await adminPool.query(`CREATE SCHEMA "${schema}"`);
    const isolatedUrl = new URL(databaseUrl!);
    isolatedUrl.searchParams.set('options', `-c search_path=${schema}`);
    pool = new Pool({ connectionString: isolatedUrl.toString() });
    repository = new PostgresCoupleRepository(isolatedUrl.toString());

    for (const migrationName of [
      '0000_identity_and_feature_interests.sql',
      '0001_couples.sql',
      '0002_packs_catalog_progress.sql',
      '0003_answers_matches.sql',
      '0022_solo_sealed_answers.sql',
    ]) {
      const migration = await readFile(new URL(`../drizzle/${migrationName}`, import.meta.url), 'utf8');
      for (const statement of migration.split('--> statement-breakpoint')) {
        if (statement.trim()) await pool.query(statement);
      }
    }
    await pool.query(
      `insert into profiles (id, name) values ($1, 'Alice'), ($2, 'Bob'), ($3, 'Charlie')`,
      [alice, bob, charlie],
    );
  });

  afterAll(async () => {
    await repository.close();
    await pool.end();
    await adminPool.query(`DROP SCHEMA "${schema}" CASCADE`);
    await adminPool.end();
  });

  it('creates, joins, reads the partner, enforces capacity, and cancels both members atomically', async () => {
    const coupleId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    await repository.create(alice, coupleId, 'ABCD2345');
    await repository.join(bob, 'ABCD2345');

    await expect(repository.getState(alice)).resolves.toMatchObject({
      couple: { id: coupleId, invite_code: 'ABCD2345' },
      partner: { id: bob, name: 'Bob', couple_id: coupleId },
    });
    await expect(repository.join(charlie, 'ABCD2345')).rejects.toMatchObject({ code: 'couple_full' });

    await repository.cancel(alice);
    await expect(repository.getState(alice)).resolves.toEqual({ couple: null, partner: null, sealed_count: 0 });
    await expect(repository.getState(bob)).resolves.toEqual({ couple: null, partner: null, sealed_count: 0 });
    expect((await pool.query('select count(*)::int as count from couples')).rows[0].count).toBe(0);
  });

  it('reports a solo answerer\'s sealed count before any couple exists', async () => {
    const pack = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
    const solo = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
    const question = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
    await pool.query(`insert into profiles(id, name) values ($1, 'Solo')`, [solo]);
    await pool.query(`insert into question_packs(id, name) values ($1, 'Pack')`, [pack]);
    await pool.query(`insert into questions(id, pack_id, text) values ($1, $2, 'Question')`, [question, pack]);
    await pool.query(
      `insert into responses(id, user_id, question_id, couple_id, answer) values ($1, $2, $3, null, 'yes')`,
      [randomUUID(), solo, question],
    );

    await expect(repository.getState(solo)).resolves.toEqual({ couple: null, partner: null, sealed_count: 1 });
  });

  it('claims both members\' sealed answers and computes matches when the second member joins', async () => {
    const coupleId = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
    const dana = '44444444-4444-4444-8444-444444444444';
    const erin = '55555555-5555-4555-8555-555555555555';
    const pack = '66666666-6666-4666-8666-666666666666';
    const yesYesQuestion = '77777777-7777-4777-8777-777777777777';
    const yesNoQuestion = '88888888-8888-4888-8888-888888888888';
    const soloOnlyQuestion = '99999999-9999-4999-8999-999999999999';

    await pool.query(`insert into profiles(id, name) values ($1, 'Dana'), ($2, 'Erin')`, [dana, erin]);
    await pool.query(`insert into question_packs(id, name) values ($1, 'Claim pack')`, [pack]);
    await pool.query(
      `insert into questions(id, pack_id, text) values ($1, $2, 'Yes yes'), ($3, $2, 'Yes no'), ($4, $2, 'Solo only')`,
      [yesYesQuestion, pack, yesNoQuestion, soloOnlyQuestion],
    );

    // Both answer the same question before pairing (sealed, couple_id null). Dana
    // and Erin agree on one question (yes/yes), disagree on another (yes/no), and
    // Dana alone answers a third, which has no match to compute.
    const insertResponse = (userId: string, questionId: string, answer: 'yes' | 'no' | 'maybe') =>
      pool.query(
        `insert into responses(id, user_id, question_id, couple_id, answer) values ($1, $2, $3, null, $4)`,
        [randomUUID(), userId, questionId, answer],
      );
    await insertResponse(dana, yesYesQuestion, 'yes');
    await insertResponse(erin, yesYesQuestion, 'yes');
    await insertResponse(dana, yesNoQuestion, 'yes');
    await insertResponse(erin, yesNoQuestion, 'no');
    await insertResponse(dana, soloOnlyQuestion, 'maybe');

    await repository.create(dana, coupleId, 'CLAIM123');
    await repository.join(erin, 'CLAIM123');

    const claimed = await pool.query<{ couple_id: string | null; count: number }>(
      'select couple_id, count(*)::int count from responses where user_id in ($1,$2) group by couple_id',
      [dana, erin],
    );
    expect(claimed.rows).toEqual([{ couple_id: coupleId, count: 5 }]);

    // Yes/yes produces a match; yes/no produces none; the solo-only answer has no
    // partner response yet, so only one match is computed from the claim.
    const matches = await pool.query<{ question_id: string; match_type: string }>(
      'select question_id, match_type from matches where couple_id=$1 order by question_id',
      [coupleId],
    );
    expect(matches.rows).toEqual([{ question_id: yesYesQuestion, match_type: 'yes_yes' }]);
  });
});
