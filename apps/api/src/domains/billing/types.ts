import { z } from 'zod';

export const revenueCatWebhookSchema = z.object({
  api_version: z.string().min(1),
  event: z.object({
    type: z.string().min(1),
    id: z.string().min(1).max(255),
    app_user_id: z.string().uuid(),
    original_app_user_id: z.string().min(1),
    product_id: z.string().min(1),
    entitlement_ids: z.array(z.string()),
    purchased_at_ms: z.number().int().nonnegative(),
    expiration_at_ms: z.number().int().nonnegative().optional(),
    original_transaction_id: z.string().min(1),
    store: z.string().min(1),
    environment: z.string().min(1),
    cancel_reason: z.string().optional(),
    grace_period_expiration_at_ms: z.number().int().nonnegative().optional(),
  }).passthrough(),
}).passthrough();

export type RevenueCatWebhook = z.infer<typeof revenueCatWebhookSchema>;
export type SubscriptionStatus = 'active' | 'cancelled' | 'expired' | 'billing_issue' | 'paused';

export interface BillingResult {
  success: true;
  message?: string;
}

export type RedemptionResult =
  | { success: true; message: string }
  | { success: false; error: string };

export class BillingError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: 400 | 401 | 404 | 429 | 503,
  ) {
    super(message);
    this.name = 'BillingError';
  }
}
