import { describe, expect, it, vi } from 'vitest';
import { HttpRevenueCatClient, SupabaseAuthAdminClient } from '../src/domains/account-operations/clients.js';

describe('account operation provider clients', () => {
  it('fails closed before account deletion when Auth Admin credentials are absent', async () => {
    const request = vi.fn();
    const client = new SupabaseAuthAdminClient(undefined, undefined, request);
    await expect(client.deleteUser('11111111-1111-4111-8111-111111111111'))
      .rejects.toMatchObject({ code: 'account_deletion_unavailable', status: 503 });
    expect(request).not.toHaveBeenCalled();
  });

  it('uses only the server-side service role against the hosted Auth admin endpoint', async () => {
    const request = vi.fn(async () => new Response(null, { status: 204 }));
    const client = new SupabaseAuthAdminClient('https://auth.example.test', 'server-secret', request);
    await client.deleteUser('11111111-1111-4111-8111-111111111111');
    expect(request).toHaveBeenCalledWith(
      'https://auth.example.test/auth/v1/admin/users/11111111-1111-4111-8111-111111111111',
      expect.objectContaining({
        method: 'DELETE',
        headers: { apikey: 'server-secret', authorization: 'Bearer server-secret' },
      }),
    );
  });

  it.each([
    [{}, false],
    [{ expires_date: '2026-08-26T12:00:00.000Z' }, false],
    [{ expires_date: '2026-08-28T12:00:00.000Z' }, true],
    [{ expires_date: null }, true],
  ])('derives premium from the configured RevenueCat entitlement', async (entitlement, expected) => {
    const request = vi.fn(async () => Response.json({
      subscriber: { entitlements: Object.keys(entitlement).length ? { pro: entitlement } : {} },
    }));
    const client = new HttpRevenueCatClient(
      'rc-secret',
      'pro',
      request,
      () => new Date('2026-08-27T12:00:00.000Z'),
    );
    await expect(client.isEntitled('user/id')).resolves.toBe(expected);
    expect(request).toHaveBeenCalledWith(
      'https://api.revenuecat.com/v1/subscribers/user%2Fid',
      expect.objectContaining({ headers: expect.objectContaining({ authorization: 'Bearer rc-secret' }) }),
    );
  });

  it('does not leak provider response content when RevenueCat rejects verification', async () => {
    const client = new HttpRevenueCatClient('rc-secret', 'pro', async () =>
      new Response('provider secret detail', { status: 401 }));
    await expect(client.isEntitled('user')).rejects.toEqual(expect.objectContaining({
      code: 'subscription_verification_failed',
      message: 'Failed to verify subscription',
      status: 502,
    }));
  });
});
