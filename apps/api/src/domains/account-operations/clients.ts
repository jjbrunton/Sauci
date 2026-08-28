import { z } from 'zod';
import { AccountOperationError } from './types.js';

export interface AuthAdminClient {
  deleteUser(userId: string): Promise<void>;
}

export interface RevenueCatClient {
  isEntitled(userId: string): Promise<boolean>;
}

export interface PartnerNotifier {
  relationshipDeleted(pushToken: string): Promise<void>;
  progressReset(pushToken: string): Promise<void>;
  partnerAccountDeleted(pushToken: string): Promise<void>;
}

type Fetch = typeof globalThis.fetch;

const revenueCatResponse = z.object({
  subscriber: z.object({
    entitlements: z.record(z.object({ expires_date: z.string().datetime().nullable() }).passthrough()),
  }).passthrough(),
}).passthrough();

export class SupabaseAuthAdminClient implements AuthAdminClient {
  constructor(
    private readonly authUrl: string | undefined,
    private readonly serviceRoleKey: string | undefined,
    private readonly request: Fetch = globalThis.fetch,
  ) {}

  async deleteUser(userId: string): Promise<void> {
    if (!this.authUrl || !this.serviceRoleKey) {
      throw new AccountOperationError(
        'account_deletion_unavailable',
        'Account deletion is temporarily unavailable',
        503,
      );
    }

    const configuredUrl = this.authUrl.replace(/\/$/, '');
    const authApiUrl = configuredUrl.endsWith('/auth/v1') ? configuredUrl : `${configuredUrl}/auth/v1`;
    const response = await this.request(
      `${authApiUrl}/admin/users/${encodeURIComponent(userId)}`,
      {
        method: 'DELETE',
        headers: {
          apikey: this.serviceRoleKey,
          authorization: `Bearer ${this.serviceRoleKey}`,
        },
        signal: AbortSignal.timeout(10_000),
      },
    ).catch(() => {
      throw new AccountOperationError('auth_provider_unavailable', 'Authentication provider is unavailable', 502);
    });

    if (!response.ok) {
      throw new AccountOperationError('auth_delete_failed', 'Failed to delete authentication record', 502);
    }
  }
}

export class HttpRevenueCatClient implements RevenueCatClient {
  constructor(
    private readonly apiKey: string | undefined,
    private readonly entitlementId = 'Sauci Pro',
    private readonly request: Fetch = globalThis.fetch,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async isEntitled(userId: string): Promise<boolean> {
    if (!this.apiKey) {
      throw new AccountOperationError(
        'subscription_sync_unavailable',
        'Subscription verification is temporarily unavailable',
        503,
      );
    }

    const response = await this.request(
      `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(userId)}`,
      {
        headers: {
          authorization: `Bearer ${this.apiKey}`,
          accept: 'application/json',
        },
        signal: AbortSignal.timeout(10_000),
      },
    ).catch(() => {
      throw new AccountOperationError('revenuecat_unavailable', 'Subscription provider is unavailable', 502);
    });

    if (!response.ok) {
      throw new AccountOperationError('subscription_verification_failed', 'Failed to verify subscription', 502);
    }

    const parsed = revenueCatResponse.safeParse(await response.json().catch(() => null));
    if (!parsed.success) {
      throw new AccountOperationError('invalid_subscription_response', 'Subscription provider returned invalid data', 502);
    }

    const entitlement = parsed.data.subscriber.entitlements[this.entitlementId];
    if (!entitlement) return false;
    return entitlement.expires_date === null || new Date(entitlement.expires_date) > this.now();
  }
}

export class ExpoPartnerNotifier implements PartnerNotifier {
  constructor(private readonly request: Fetch = globalThis.fetch) {}

  relationshipDeleted(pushToken: string): Promise<void> {
    return this.send(pushToken, 'Relationship Deleted',
      'Your partner has deleted all shared data. You can start fresh with a new partner anytime.',
      'relationship_deleted');
  }

  progressReset(pushToken: string): Promise<void> {
    return this.send(pushToken, 'Progress Reset',
      'Your partner has reset all progress. Your matches and chats have been cleared to start fresh.',
      'progress_reset');
  }

  partnerAccountDeleted(pushToken: string): Promise<void> {
    return this.send(pushToken, 'Partner Left',
      'Your partner has deleted their account. You can start fresh with a new partner anytime.',
      'partner_account_deleted');
  }

  private async send(to: string, title: string, body: string, type: string): Promise<void> {
    const response = await this.request('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ to, title, body, sound: 'default', data: { type } }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`Expo push failed with status ${response.status}`);
  }
}
