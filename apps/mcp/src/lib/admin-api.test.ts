import { afterEach, describe, expect, it, vi } from 'vitest';
import { AdminApiClient, AdminApiError } from './admin-api.js';

afterEach(() => vi.restoreAllMocks());

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('AdminApiClient', () => {
  it('queries the standalone API with the server bearer credential', async () => {
    const fetchImpl = vi.fn(async (_input: URL | RequestInfo, _init?: RequestInit) => response({ rows: [{ id: '1' }], count: 1 }));
    const client = new AdminApiClient('http://127.0.0.1:3010', 'server-secret', fetchImpl as typeof fetch);

    await expect(client.query('profiles', {
      filters: [{ column: 'id', op: 'eq', value: '1' }],
      limit: 20,
    })).resolves.toEqual({ rows: [{ id: '1' }], count: 1 });

    const [url, init] = fetchImpl.mock.calls[0];
    expect(String(url)).toBe('http://127.0.0.1:3010/v1/admin/query/profiles');
    expect(init?.headers).toMatchObject({ authorization: 'Bearer server-secret' });
    expect(JSON.parse(String(init?.body))).toEqual({
      filters: [{ column: 'id', op: 'eq', value: '1' }],
      limit: 20,
    });
  });

  it('maps inserts, updates, deletes, gifts and private media URLs', async () => {
    const fetchImpl = vi.fn<(_input: URL | RequestInfo, _init?: RequestInit) => Promise<Response>>()
      .mockResolvedValueOnce(response({ rows: [{ id: 'new' }] }, 201))
      .mockResolvedValueOnce(response({ row: { id: 'new', name: 'changed' } }))
      .mockResolvedValueOnce(response({ deleted: true }))
      .mockResolvedValueOnce(response({ expires_at: '2027-01-01T00:00:00.000Z' }))
      .mockResolvedValueOnce(response({ url: 'https://media.test/signed', expires_at: '2026-08-28T00:00:00.000Z' }));
    const client = new AdminApiClient('https://api.sauci.test/base/', 'token', fetchImpl as typeof fetch);

    await expect(client.insert('categories', [{ name: 'New' }])).resolves.toEqual([{ id: 'new' }]);
    await expect(client.update('categories', 'new', { name: 'changed' })).resolves.toMatchObject({ name: 'changed' });
    await expect(client.delete('categories', 'new')).resolves.toBeUndefined();
    await expect(client.giftPremium('user/id', 30, 'thanks')).resolves.toEqual({ expires_at: '2027-01-01T00:00:00.000Z' });
    await expect(client.mediaUrl('media/id')).resolves.toEqual({ url: 'https://media.test/signed', expires_at: '2026-08-28T00:00:00.000Z' });

    expect(fetchImpl.mock.calls.map(([url, init]) => [String(url), init?.method])).toEqual([
      ['https://api.sauci.test/base/v1/admin/data/categories', 'POST'],
      ['https://api.sauci.test/base/v1/admin/data/categories/new', 'PATCH'],
      ['https://api.sauci.test/base/v1/admin/data/categories/new', 'DELETE'],
      ['https://api.sauci.test/base/v1/admin/users/user%2Fid/gift-premium', 'POST'],
      ['https://api.sauci.test/base/v1/admin/media/media%2Fid/url', 'GET'],
    ]);
  });

  it('paginates queryAll until the reported count is reached', async () => {
    const first = Array.from({ length: 500 }, (_, id) => ({ id }));
    const fetchImpl = vi.fn<(_input: URL | RequestInfo, _init?: RequestInit) => Promise<Response>>()
      .mockResolvedValueOnce(response({ rows: first, count: 501 }))
      .mockResolvedValueOnce(response({ rows: [{ id: 500 }], count: 501 }));
    const client = new AdminApiClient('http://localhost:3010', 'token', fetchImpl as typeof fetch);

    await expect(client.queryAll('questions')).resolves.toHaveLength(501);
    expect(JSON.parse(String(fetchImpl.mock.calls[1][1]?.body))).toMatchObject({ limit: 500, offset: 500 });
  });

  it('uses the aggregate feature-interest endpoint instead of exporting user rows', async () => {
    const counts = [{ feature_name: 'live_draw', opt_in_count: 4, opt_in_count_last_7_days: 2 }];
    const fetchImpl = vi.fn(async (_input: URL | RequestInfo, _init?: RequestInit) => response({ counts }));
    const client = new AdminApiClient('https://api.sauci.test', 'token', fetchImpl as typeof fetch);

    await expect(client.featureInterestCounts()).resolves.toEqual(counts);
    expect(String(fetchImpl.mock.calls[0][0])).toBe('https://api.sauci.test/v1/admin/feature-interest-counts');
    expect(fetchImpl.mock.calls[0][1]?.method).toBe('GET');
  });

  it('returns structured API failures without exposing the credential', async () => {
    const fetchImpl = vi.fn(async (_input: URL | RequestInfo, _init?: RequestInit) => response({ error: { code: 'forbidden', message: 'Missing permission' } }, 403));
    const client = new AdminApiClient('https://api.sauci.test', 'never-print-me', fetchImpl as typeof fetch);

    const error = await client.query('profiles').catch((cause) => cause);
    expect(error).toBeInstanceOf(AdminApiError);
    expect(error).toMatchObject({ status: 403, code: 'forbidden', message: 'Missing permission' });
    expect(String(error)).not.toContain('never-print-me');
  });

  it('rejects credentials sent over non-local cleartext HTTP', () => {
    expect(() => new AdminApiClient('http://api.sauci.test', 'token')).toThrow(/HTTPS/);
    expect(() => new AdminApiClient('http://localhost:3010', '')).toThrow(/TOKEN/);
  });
});
