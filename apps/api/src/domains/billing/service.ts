import { timingSafeEqual } from 'node:crypto';
import type { BillingRepository } from './repository.js';
import {
  BillingError,
  type BillingResult,
  type RedemptionResult,
  revenueCatWebhookSchema,
  type SubscriptionStatus,
} from './types.js';

const statusByEvent: Record<string, SubscriptionStatus> = {
  INITIAL_PURCHASE: 'active',
  RENEWAL: 'active',
  UNCANCELLATION: 'active',
  PRODUCT_CHANGE: 'active',
  CANCELLATION: 'cancelled',
  EXPIRATION: 'expired',
  BILLING_ISSUE: 'billing_issue',
  SUBSCRIPTION_PAUSED: 'paused',
};

function secureEqual(actual: string, expected: string): boolean {
  const actualBytes = Buffer.from(actual);
  const expectedBytes = Buffer.from(expected);
  return actualBytes.length === expectedBytes.length && timingSafeEqual(actualBytes, expectedBytes);
}

export class BillingService {
  constructor(
    private readonly repository: BillingRepository,
    private readonly revenueCatWebhookSecret: string | undefined,
  ) {}

  assertWebhookAuthorization(authorization: string | undefined): void {
    if (!this.revenueCatWebhookSecret) {
      throw new BillingError('webhook_unavailable', 'Webhook is not configured', 503);
    }
    if (!authorization || !secureEqual(authorization, `Bearer ${this.revenueCatWebhookSecret}`)) {
      throw new BillingError('unauthorized', 'Unauthorized', 401);
    }
  }

  async processWebhook(authorization: string | undefined, rawPayload: unknown): Promise<BillingResult> {
    this.assertWebhookAuthorization(authorization);

    const parsed = revenueCatWebhookSchema.safeParse(rawPayload);
    if (!parsed.success) throw new BillingError('invalid_payload', 'Invalid webhook payload', 400);
    const payload = parsed.data;

    const status = statusByEvent[payload.event.type] ?? null;
    const result = await this.repository.processRevenueCatEvent(payload, status);
    if (result.duplicate) return { success: true, message: 'Duplicate event' };
    if (payload.event.type === 'TEST') return { success: true, message: 'Test event received' };
    if (!result.handled) return { success: true, message: 'Event type not handled' };
    return { success: true };
  }

  redeem(email: string, code: string): Promise<RedemptionResult> {
    return this.repository.redeem(email.trim(), code.trim());
  }
}
