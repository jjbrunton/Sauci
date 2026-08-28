import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { adminData } from './admin-data.js';

const originalUrl = process.env.SAUCI_ADMIN_API_URL;
const originalToken = process.env.SAUCI_ADMIN_API_TOKEN;

beforeAll(() => {
  process.env.SAUCI_ADMIN_API_URL = 'http://localhost:3010';
  process.env.SAUCI_ADMIN_API_TOKEN = 'test-service-token';
  vi.stubGlobal('fetch', vi.fn(async (input: URL | RequestInfo, init?: RequestInit) => {
    const url = new URL(String(input));
    const body = init?.body ? JSON.parse(String(init.body)) : {};
    if (url.pathname === '/v1/admin/query/feedback') {
      return Response.json({ rows: [{ id: 'f1', user_id: 'u1', question_id: 'q1' }], count: 1 });
    }
    if (url.pathname === '/v1/admin/query/questions') {
      return Response.json({ rows: [{ id: 'q1', text: 'Question', intensity: 3, private: 'not returned in relation' }], count: 1 });
    }
    if (url.pathname === '/v1/admin/query/profiles') {
      const rows = body.filters?.length
        ? [{ id: 'u1', name: 'User One', email: 'one@example.test', push_token: 'private' }]
        : [
            { id: 'u1', name: 'Alex', email: 'one@example.test' },
            { id: 'u2', name: 'Sam', email: 'sam@example.test' },
            { id: 'u3', name: 'No match', email: 'none@example.test' },
          ];
      return Response.json({ rows, count: rows.length });
    }
    if (url.pathname === '/v1/admin/data/categories/c1' && init?.method === 'PATCH') {
      return Response.json({ row: { id: 'c1', name: body.values.name } });
    }
    return Response.json({ error: { code: 'unexpected', message: `${init?.method} ${url.pathname}` } }, { status: 500 });
  }));
});

afterAll(() => {
  vi.unstubAllGlobals();
  if (originalUrl === undefined) delete process.env.SAUCI_ADMIN_API_URL;
  else process.env.SAUCI_ADMIN_API_URL = originalUrl;
  if (originalToken === undefined) delete process.env.SAUCI_ADMIN_API_TOKEN;
  else process.env.SAUCI_ADMIN_API_TOKEN = originalToken;
});

describe('adminData compatibility behavior', () => {
  it('preserves requested relationship shapes without exposing unrelated profile fields', async () => {
    const result = await adminData.from('feedback').select(`
      *,
      user:user_id (name, email),
      question:question_id (text)
    `).eq('id', 'f1').single();

    expect(result.error).toBeNull();
    expect(result.data).toMatchObject({
      id: 'f1',
      user: { name: 'User One', email: 'one@example.test' },
      question: { text: 'Question' },
    });
    expect(result.data.user).not.toHaveProperty('push_token');
    expect(result.data.question).not.toHaveProperty('private');
  });

  it('preserves OR search, pagination and union counts client-side', async () => {
    const result = await adminData.from('profiles')
      .select('*', { count: 'exact' })
      .or('name.ilike.%sam%,email.ilike.%sam%')
      .order('created_at', { ascending: false })
      .range(0, 9);

    expect(result.error).toBeNull();
    expect(result.count).toBe(1);
    expect(result.data.map((row: Record<string, unknown>) => row.id)).toEqual(['u2']);
  });

  it('routes mutations through the audited standalone endpoint', async () => {
    const result = await adminData.from('categories').update({ name: 'Changed' }).eq('id', 'c1').select().single();
    expect(result).toEqual({ data: { id: 'c1', name: 'Changed' }, error: null, count: null });

    const fetchMock = vi.mocked(fetch);
    const mutation = fetchMock.mock.calls.find(([input]) => String(input).endsWith('/v1/admin/data/categories/c1'));
    expect(mutation?.[1]).toMatchObject({ method: 'PATCH' });
    expect(mutation?.[1]?.headers).toMatchObject({ authorization: 'Bearer test-service-token' });
  });
});
