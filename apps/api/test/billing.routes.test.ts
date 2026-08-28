import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';
import type { AuthIdentity } from '../src/auth.js';
import type { BillingRepository } from '../src/domains/billing/repository.js';
import { registerBillingRoutes } from '../src/domains/billing/routes.js';
import { BillingService } from '../src/domains/billing/service.js';
import { BillingError, type RevenueCatWebhook } from '../src/domains/billing/types.js';

const payload: RevenueCatWebhook = {
  api_version: '1.0',
  event: {
    type: 'INITIAL_PURCHASE',
    id: 'event-1',
    app_user_id: '11111111-1111-4111-8111-111111111111',
    original_app_user_id: '11111111-1111-4111-8111-111111111111',
    product_id: 'sauci.pro.monthly',
    entitlement_ids: ['Sauci Pro'],
    purchased_at_ms: 1_787_824_800_000,
    expiration_at_ms: 1_790_503_200_000,
    original_transaction_id: 'transaction-1',
    store: 'APP_STORE',
    environment: 'SANDBOX',
  },
};

function repository(): BillingRepository {
  return {
    processRevenueCatEvent: vi.fn(async () => ({ duplicate: false, handled: true })),
    redeem: vi.fn(async () => ({ success: true as const, message: 'redeemed' })),
    close: vi.fn(async () => undefined),
  };
}

function appWith(service: BillingService) {
  const app = new Hono<{ Variables: { identity: AuthIdentity } }>();
  registerBillingRoutes(app, service);
  return app;
}

describe('billing routes', () => {
  it('fails closed when the webhook secret is missing or incorrect', async () => {
    const repo = repository();
    const missing = await appWith(new BillingService(repo, undefined)).request('/webhooks/revenuecat', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload),
    });
    expect(missing.status).toBe(503);
    const wrong = await appWith(new BillingService(repo, 'correct')).request('/webhooks/revenuecat', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer wrong' },
      body: JSON.stringify(payload),
    });
    expect(wrong.status).toBe(401);
    expect(repo.processRevenueCatEvent).not.toHaveBeenCalled();
  });

  it('rejects malformed webhook payloads before persistence', async () => {
    const repo = repository();
    const response = await appWith(new BillingService(repo, 'secret')).request('/webhooks/revenuecat', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer secret' },
      body: JSON.stringify({ event: { id: 'missing-fields' } }),
    });
    expect(response.status).toBe(400);
    expect(repo.processRevenueCatEvent).not.toHaveBeenCalled();
  });

  it('rejects webhook authorization before attempting to parse JSON', async () => {
    const repo = repository();
    const response = await appWith(new BillingService(repo, 'secret')).request('/webhooks/revenuecat', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer wrong' },
      body: '{not-json',
    });
    expect(response.status).toBe(401);
    expect(repo.processRevenueCatEvent).not.toHaveBeenCalled();
  });

  it('bounds webhook and public redemption bodies', async () => {
    const repo = repository();
    const app = appWith(new BillingService(repo, 'secret'));
    const webhook = await app.request('/webhooks/revenuecat', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer secret' },
      body: JSON.stringify({ padding: 'x'.repeat(1024 * 1024) }),
    });
    expect(webhook.status).toBe(413);

    const redemption = await app.request('/public/v1/redemptions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'alice@example.test', code: 'x'.repeat(16 * 1024) }),
    });
    expect(redemption.status).toBe(413);
    expect(repo.processRevenueCatEvent).not.toHaveBeenCalled();
    expect(repo.redeem).not.toHaveBeenCalled();
  });

  it('maps known events and acknowledges authenticated delivery', async () => {
    const repo = repository();
    const response = await appWith(new BillingService(repo, 'secret')).request('/webhooks/revenuecat', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer secret' },
      body: JSON.stringify(payload),
    });
    expect(response.status).toBe(200);
    expect(repo.processRevenueCatEvent).toHaveBeenCalledWith(payload, 'active');
  });

  it('validates public redemptions and preserves product error responses', async () => {
    const repo = repository();
    const app = appWith(new BillingService(repo, 'secret'));
    expect((await app.request('/public/v1/redemptions', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: '', code: '' }),
    })).status).toBe(400);
    vi.mocked(repo.redeem).mockResolvedValueOnce({ success: false, error: 'Invalid redemption code' });
    const response = await app.request('/public/v1/redemptions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: ' alice@example.test ', code: ' promo ' }),
    });
    expect(response.status).toBe(400);
    expect(repo.redeem).toHaveBeenCalledWith('alice@example.test', 'promo');
  });

  it('returns a bounded-throttle response without leaking internals', async () => {
    const repo = repository();
    vi.mocked(repo.redeem).mockRejectedValueOnce(
      new BillingError('redemption_rate_limited', 'Too many redemption attempts. Please try again shortly.', 429),
    );
    const response = await appWith(new BillingService(repo, 'secret')).request('/public/v1/redemptions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'alice@example.test', code: 'PROMO' }),
    });
    expect(response.status).toBe(429);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: 'Too many redemption attempts. Please try again shortly.',
    });
  });
});
