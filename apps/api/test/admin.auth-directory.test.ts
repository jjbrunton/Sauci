import { describe, expect, it, vi } from 'vitest';
import { SupabaseAdminAuthDirectory } from '../src/domains/admin/auth-directory.js';

describe('admin hosted-auth directory', () => {
  it('returns explicit empty enrichment when server credentials are absent', async () => {
    const request = vi.fn();
    await expect(new SupabaseAdminAuthDirectory(undefined, undefined, request).users()).resolves.toEqual([]);
    expect(request).not.toHaveBeenCalled();
  });

  it('reads hosted Auth metadata with server-only credentials', async () => {
    const request = vi.fn(async () => Response.json({ users: [{
      id: '11111111-1111-4111-8111-111111111111', email: 'admin@example.test',
      last_sign_in_at: '2026-08-27T12:00:00.000Z', confirmed_at: '2026-08-26T12:00:00.000Z',
    }] }));
    const directory = new SupabaseAdminAuthDirectory('https://auth.example.test/auth/v1', 'server-secret', request);
    await expect(directory.users()).resolves.toEqual([{
      id: '11111111-1111-4111-8111-111111111111', email: 'admin@example.test',
      last_sign_in_at: '2026-08-27T12:00:00.000Z', email_confirmed_at: '2026-08-26T12:00:00.000Z',
    }]);
    expect(request).toHaveBeenCalledWith(
      'https://auth.example.test/auth/v1/admin/users?page=1&per_page=1000',
      expect.objectContaining({ headers: { apikey: 'server-secret', authorization: 'Bearer server-secret' } }),
    );
  });

  it('does not expose hosted Auth provider failures', async () => {
    const directory = new SupabaseAdminAuthDirectory('https://auth.example.test', 'server-secret', async () =>
      new Response('sensitive provider detail', { status: 401 }));
    await expect(directory.users()).resolves.toEqual([]);
  });
});
