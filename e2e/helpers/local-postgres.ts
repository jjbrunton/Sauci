import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';

function localDatabaseUrl(): string {
  const raw = process.env.E2E_DATABASE_URL;
  if (!raw) throw new Error('Run E2E through npm run verify:e2e');

  const url = new URL(raw);
  if (url.protocol !== 'postgresql:' || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) {
    throw new Error(`E2E refuses non-loopback PostgreSQL: ${url.origin}`);
  }
  return raw;
}

export interface RedemptionFixture {
  email: string;
  code: string;
  userId: string;
  codeId: string;
  assertRedeemed(): Promise<void>;
  cleanup(): Promise<void>;
}

export async function createRedemptionFixture(): Promise<RedemptionFixture> {
  const pool = new Pool({ connectionString: localDatabaseUrl() });
  const nonce = randomUUID();
  const userId = randomUUID();
  const email = `redeem-${nonce}@example.test`;
  const code = `E2E-${nonce}`.toUpperCase();

  let codeId: string | undefined;
  try {
    const codeResult = await pool.query<{ id: string }>(
      `insert into redemption_codes (code, description, max_uses, is_active, expires_at)
       values ($1, 'Playwright loopback fixture', 1, true, now() + interval '1 hour')
       returning id`,
      [code],
    );
    codeId = codeResult.rows[0]?.id;
    if (!codeId) throw new Error('Failed to create redemption code fixture');

    await pool.query(
      `insert into profiles (id, email, name)
       values ($1, $2, 'Playwright Redemption Fixture')`,
      [userId, email],
    );
  } catch (cause) {
    if (codeId) await pool.query('delete from redemption_codes where id = $1', [codeId]);
    await pool.end();
    throw cause;
  }

  return {
    email,
    code,
    userId,
    codeId,
    async assertRedeemed() {
      const profile = await pool.query<{ is_premium: boolean }>(
        'select is_premium from profiles where id = $1',
        [userId],
      );
      if (profile.rows[0]?.is_premium !== true) {
        throw new Error('Redemption fixture profile was not marked premium');
      }

      const redemptions = await pool.query<{ count: number }>(
        `select count(*)::int as count from code_redemptions
         where code_id = $1 and user_id = $2`,
        [codeId, userId],
      );
      if (redemptions.rows[0]?.count !== 1) {
        throw new Error('Redemption fixture did not record exactly one redemption');
      }
    },
    async cleanup() {
      await pool.query('delete from redemption_codes where id = $1', [codeId]);
      await pool.query('delete from profiles where id = $1', [userId]);
      await pool.end();
    },
  };
}
