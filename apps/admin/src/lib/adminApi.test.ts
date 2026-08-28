import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getSession } = vi.hoisted(() => ({ getSession: vi.fn() }));
vi.mock('@/config', () => ({
    apiUrl: 'http://127.0.0.1:3003',
    authClient: { auth: { getSession } },
}));

import { AdminApiError, adminRequest, getAdminResponseMedia, queryAdminRows } from './adminApi';

describe('admin API transport', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        getSession.mockResolvedValue({ data: { session: { access_token: 'hosted-auth-token' } }, error: null });
    });

    it('sends the hosted Auth bearer token to the standalone API', async () => {
        const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ rows: [], count: 0 }), {
            status: 200, headers: { 'content-type': 'application/json' },
        }));

        await queryAdminRows('profiles', { limit: 25 });

        const [url, init] = fetchMock.mock.calls[0];
        expect(url).toBe('http://127.0.0.1:3003/v1/admin/query/profiles');
        expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer hosted-auth-token');
        expect(init?.body).toBe(JSON.stringify({ limit: 25 }));
    });

    it('fails closed when there is no authenticated session', async () => {
        getSession.mockResolvedValue({ data: { session: null }, error: null });
        await expect(adminRequest('/v1/admin/me')).rejects.toMatchObject({ status: 401 } satisfies Partial<AdminApiError>);
    });

    it('surfaces the API error message', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ error: { message: 'Administrator access denied' } }), {
            status: 403, headers: { 'content-type': 'application/json' },
        }));
        await expect(adminRequest('/v1/admin/me')).rejects.toThrow('Administrator access denied');
    });

    it('loads protected response media from the standalone API with hosted Auth', async () => {
        const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('response-media', {
            status: 200, headers: { 'content-type': 'image/jpeg' },
        }));
        const responseId = '11111111-1111-4111-8111-111111111111';

        const blob = await getAdminResponseMedia(responseId);

        expect(await blob.text()).toBe('response-media');
        const [url, init] = fetchMock.mock.calls[0];
        expect(url).toBe(`http://127.0.0.1:3003/v1/admin/responses/${responseId}/media`);
        expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer hosted-auth-token');
        expect(init?.body).toBeUndefined();
    });
});
