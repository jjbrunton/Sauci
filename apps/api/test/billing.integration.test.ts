import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PostgresBillingRepository } from '../src/domains/billing/repository.js';
import type { RevenueCatWebhook } from '../src/domains/billing/types.js';

const databaseUrl = process.env.DATABASE_URL;
const localDatabase = databaseUrl ? ['127.0.0.1', 'localhost', '::1'].includes(new URL(databaseUrl).hostname) : false;
if (databaseUrl && !localDatabase) throw new Error('Billing integration tests only permit a localhost DATABASE_URL');

describe.skipIf(!databaseUrl || !localDatabase)('PostgresBillingRepository', () => {
  const adminPool = new Pool({ connectionString: databaseUrl });
  const schema = `billing_test_${randomUUID().replaceAll('-', '')}`;
  const aliceId = '11111111-1111-4111-8111-111111111111';
  const bobId = '22222222-2222-4222-8222-222222222222';
  const coupleId = '33333333-3333-4333-8333-333333333333';
  const packId = '44444444-4444-4444-8444-444444444444';
  let pool: Pool;
  let repository: PostgresBillingRepository;

  beforeAll(async () => {
    await adminPool.query(`CREATE SCHEMA "${schema}"`);
    const isolatedUrl = new URL(databaseUrl!);
    isolatedUrl.searchParams.set('options', `-c search_path=${schema}`);
    pool = new Pool({ connectionString: isolatedUrl.toString() });
    repository = new PostgresBillingRepository(isolatedUrl.toString());
    for (const migrationName of [
      '0000_identity_and_feature_interests.sql',
      '0001_couples.sql',
      '0002_packs_catalog_progress.sql',
      '0007_billing_redemption.sql',
    ]) {
      const migration = await readFile(new URL(`../drizzle/${migrationName}`, import.meta.url), 'utf8');
      for (const statement of migration.split('--> statement-breakpoint')) {
        if (statement.trim()) await pool.query(statement);
      }
    }
  });

  beforeEach(async () => {
    await pool.query('truncate profiles, couples, question_packs, subscriptions, revenuecat_webhook_events, redemption_codes, redemption_rate_limits cascade');
    await pool.query('insert into couples (id, invite_code) values ($1, $2)', [coupleId, 'ABCD2345']);
    await pool.query(
      `insert into profiles (id, email, couple_id) values
       ($1, 'alice@example.test', $3), ($2, 'bob@example.test', $3)`,
      [aliceId, bobId, coupleId],
    );
    await pool.query(
      `insert into question_packs (id, name, is_premium) values ($1, 'Premium', true)`,
      [packId],
    );
    await pool.query(
      'insert into couple_packs (couple_id, pack_id, enabled) values ($1, $2, true)',
      [coupleId, packId],
    );
  });

  afterAll(async () => {
    await repository.close();
    await pool.end();
    await adminPool.query(`DROP SCHEMA "${schema}" CASCADE`);
    await adminPool.end();
  });

  function webhook(overrides: Partial<RevenueCatWebhook['event']> = {}): RevenueCatWebhook {
    return {
      api_version: '1.0',
      event: {
        type: 'INITIAL_PURCHASE',
        id: randomUUID(),
        app_user_id: aliceId,
        original_app_user_id: aliceId,
        product_id: 'sauci.pro.monthly',
        entitlement_ids: ['Sauci Pro'],
        purchased_at_ms: Date.now(),
        expiration_at_ms: Date.now() + 86_400_000,
        original_transaction_id: 'transaction-1',
        store: 'APP_STORE',
        environment: 'SANDBOX',
        ...overrides,
      },
    };
  }

  it('persists a webhook exactly once and grants premium', async () => {
    const event = webhook({ id: 'event-once' });
    await expect(repository.processRevenueCatEvent(event, 'active')).resolves.toEqual({ duplicate: false, handled: true });
    await expect(repository.processRevenueCatEvent(event, 'active')).resolves.toEqual({ duplicate: true, handled: true });
    expect((await pool.query('select count(*)::int as count from revenuecat_webhook_events')).rows[0].count).toBe(1);
    expect((await pool.query('select count(*)::int as count from subscriptions')).rows[0].count).toBe(1);
    expect((await pool.query('select is_premium from profiles where id = $1', [aliceId])).rows[0].is_premium).toBe(true);
  });

  it('rolls back a known event for an unknown user so a provider retry remains possible', async () => {
    const event = webhook({ id: 'unknown-user', app_user_id: '99999999-9999-4999-8999-999999999999' });
    await expect(repository.processRevenueCatEvent(event, 'active')).rejects.toMatchObject({ code: 'user_not_found' });
    expect((await pool.query('select count(*)::int as count from revenuecat_webhook_events')).rows[0].count).toBe(0);
  });

  it('removes premium and disables premium packs only when neither partner remains premium', async () => {
    await repository.processRevenueCatEvent(webhook({ id: 'purchase' }), 'active');
    await repository.processRevenueCatEvent(webhook({ id: 'expiry', type: 'EXPIRATION' }), 'expired');
    expect((await pool.query('select is_premium from profiles where id = $1', [aliceId])).rows[0].is_premium).toBe(false);
    expect((await pool.query('select enabled from couple_packs where couple_id = $1', [coupleId])).rows[0].enabled).toBe(false);
  });

  it('serializes limited redemption uses and grants exactly one account', async () => {
    await pool.query(
      `insert into redemption_codes (id, code, max_uses) values ($1, 'PROMO', 1)`,
      [randomUUID()],
    );
    const results = await Promise.all([
      repository.redeem('alice@example.test', 'promo'),
      repository.redeem('bob@example.test', 'PROMO'),
    ]);
    expect(results.filter((result) => result.success)).toHaveLength(1);
    expect((await pool.query('select count(*)::int as count from code_redemptions')).rows[0].count).toBe(1);
    expect((await pool.query('select count(*)::int as count from profiles where is_premium')).rows[0].count).toBe(1);
    expect((await pool.query('select current_uses from redemption_codes')).rows[0].current_uses).toBe(1);
  });

  it('enforces the database-backed redemption ceiling before code lookup', async () => {
    await pool.query(
      `insert into redemption_rate_limits (bucket, attempts) values (date_trunc('minute', now()), 60)`,
    );
    await expect(repository.redeem('alice@example.test', 'ANYTHING')).rejects.toMatchObject({
      code: 'redemption_rate_limited',
      status: 429,
    });
    expect((await pool.query('select count(*)::int as count from code_redemptions')).rows[0].count).toBe(0);
  });
});
