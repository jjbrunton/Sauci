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

    for (const migrationName of ['0000_identity_and_feature_interests.sql', '0001_couples.sql']) {
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
    await expect(repository.getState(alice)).resolves.toEqual({ couple: null, partner: null });
    await expect(repository.getState(bob)).resolves.toEqual({ couple: null, partner: null });
    expect((await pool.query('select count(*)::int as count from couples')).rows[0].count).toBe(0);
  });
});
