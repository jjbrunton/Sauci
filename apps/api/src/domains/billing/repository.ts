import { Pool, type PoolClient, type QueryResultRow } from 'pg';
import { BillingError, type RedemptionResult, type RevenueCatWebhook, type SubscriptionStatus } from './types.js';

interface ProfileRecord extends QueryResultRow {
  id: string;
  couple_id: string | null;
  is_premium: boolean;
}

interface CodeRecord extends QueryResultRow {
  id: string;
  max_uses: number | null;
  current_uses: number;
  expires_at: Date | null;
  is_active: boolean;
}

export interface WebhookResult {
  duplicate: boolean;
  handled: boolean;
}

export interface BillingRepository {
  processRevenueCatEvent(payload: RevenueCatWebhook, status: SubscriptionStatus | null): Promise<WebhookResult>;
  redeem(email: string, code: string): Promise<RedemptionResult>;
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

export class PostgresBillingRepository implements BillingRepository {
  private readonly pool: Pool;

  constructor(databaseUrl: string) {
    this.pool = new Pool({ connectionString: databaseUrl });
  }

  async processRevenueCatEvent(
    payload: RevenueCatWebhook,
    status: SubscriptionStatus | null,
  ): Promise<WebhookResult> {
    return transaction(this.pool, async (client) => {
      const event = payload.event;
      const inserted = await client.query(
        `insert into revenuecat_webhook_events (event_id, event_type, app_user_id, payload)
         values ($1, $2, $3, $4::jsonb)
         on conflict (event_id) do nothing`,
        [event.id, event.type, event.app_user_id, JSON.stringify(payload)],
      );
      if (inserted.rowCount === 0) return { duplicate: true, handled: status !== null };
      if (status === null) return { duplicate: false, handled: false };

      const profileResult = await client.query<ProfileRecord>(
        'select id, couple_id, is_premium from profiles where id = $1 for update',
        [event.app_user_id],
      );
      const profile = profileResult.rows[0];
      if (!profile) throw new BillingError('user_not_found', 'User not found', 404);

      await client.query(
        `insert into subscriptions (
           user_id, revenuecat_app_user_id, product_id, status, entitlement_ids,
           purchased_at, expires_at, original_transaction_id, store, is_sandbox,
           cancel_reason, grace_period_expires_at
         ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         on conflict (user_id, original_transaction_id) do update set
           revenuecat_app_user_id = excluded.revenuecat_app_user_id,
           product_id = excluded.product_id,
           status = excluded.status,
           entitlement_ids = excluded.entitlement_ids,
           purchased_at = excluded.purchased_at,
           expires_at = excluded.expires_at,
           store = excluded.store,
           is_sandbox = excluded.is_sandbox,
           cancel_reason = excluded.cancel_reason,
           grace_period_expires_at = excluded.grace_period_expires_at,
           updated_at = now()`,
        [
          event.app_user_id,
          event.app_user_id,
          event.product_id,
          status,
          event.entitlement_ids,
          new Date(event.purchased_at_ms),
          event.expiration_at_ms === undefined ? null : new Date(event.expiration_at_ms),
          event.original_transaction_id,
          event.store,
          event.environment !== 'PRODUCTION',
          event.cancel_reason ?? null,
          event.grace_period_expiration_at_ms === undefined ? null : new Date(event.grace_period_expiration_at_ms),
        ],
      );

      const premiumResult = await client.query<{ premium: boolean }>(
        `select exists (
           select 1 from subscriptions
            where user_id = $1 and status = 'active'
              and (expires_at is null or expires_at > now())
         ) as premium`,
        [event.app_user_id],
      );
      const isPremium = premiumResult.rows[0]?.premium ?? false;
      await client.query(
        'update profiles set is_premium = $2, updated_at = now() where id = $1',
        [event.app_user_id, isPremium],
      );

      if (profile.is_premium && !isPremium && profile.couple_id) {
        const partnerPremium = await client.query<{ premium: boolean }>(
          `select exists (
             select 1 from profiles
              where couple_id = $1 and id <> $2 and is_premium = true
           ) as premium`,
          [profile.couple_id, event.app_user_id],
        );
        if (!partnerPremium.rows[0]?.premium) {
          await client.query(
            `update couple_packs cp set enabled = false
               from question_packs qp
              where cp.pack_id = qp.id and qp.is_premium = true
                and cp.couple_id = $1 and cp.enabled = true`,
            [profile.couple_id],
          );
        }
      }

      return { duplicate: false, handled: true };
    });
  }

  async redeem(email: string, code: string): Promise<RedemptionResult> {
    return transaction(this.pool, async (client) => {
      const allowance = await client.query(
        `insert into redemption_rate_limits (bucket, attempts)
         values (date_trunc('minute', now()), 1)
         on conflict (bucket) do update
           set attempts = redemption_rate_limits.attempts + 1
           where redemption_rate_limits.attempts < 60
         returning attempts`,
      );
      if (allowance.rowCount === 0) {
        throw new BillingError('redemption_rate_limited', 'Too many redemption attempts. Please try again shortly.', 429);
      }
      await client.query(
        `delete from redemption_rate_limits where bucket < date_trunc('minute', now()) - interval '1 day'`,
      );

      const profileResult = await client.query<ProfileRecord>(
        `select id, couple_id, is_premium from profiles
          where lower(email) = lower($1)
          order by created_at asc
          limit 1
          for update`,
        [email],
      );
      const profile = profileResult.rows[0];
      if (!profile) return { success: false, error: 'No account found with this email address' };

      const codeResult = await client.query<CodeRecord>(
        `select id, max_uses, current_uses, expires_at, is_active
           from redemption_codes where upper(code) = upper($1) for update`,
        [code],
      );
      const redemptionCode = codeResult.rows[0];
      if (!redemptionCode) return { success: false, error: 'Invalid redemption code' };
      if (!redemptionCode.is_active) return { success: false, error: 'This code is no longer active' };
      if (redemptionCode.expires_at && redemptionCode.expires_at < new Date()) {
        return { success: false, error: 'This code has expired' };
      }
      if (redemptionCode.max_uses !== null && redemptionCode.current_uses >= redemptionCode.max_uses) {
        return { success: false, error: 'This code has reached its maximum number of uses' };
      }

      const existing = await client.query(
        'select 1 from code_redemptions where code_id = $1 and user_id = $2',
        [redemptionCode.id, profile.id],
      );
      if (existing.rowCount) return { success: false, error: 'You have already redeemed this code' };

      await client.query(
        'insert into code_redemptions (code_id, user_id) values ($1, $2)',
        [redemptionCode.id, profile.id],
      );
      await client.query(
        'update redemption_codes set current_uses = current_uses + 1, updated_at = now() where id = $1',
        [redemptionCode.id],
      );
      await client.query(
        'update profiles set is_premium = true, updated_at = now() where id = $1',
        [profile.id],
      );
      return { success: true, message: 'Code redeemed successfully! You now have premium access.' };
    });
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
