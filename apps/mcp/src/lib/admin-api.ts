export type AdminFilter = {
  column: string;
  op: 'eq' | 'neq' | 'in' | 'is' | 'gte' | 'lte' | 'ilike';
  value: unknown;
};

export type AdminQuery = {
  filters?: AdminFilter[];
  order?: { column: string; ascending?: boolean };
  limit?: number;
  offset?: number;
};

type Fetch = typeof fetch;

export class AdminApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = 'AdminApiError';
  }
}

function validatedBaseUrl(value: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('SAUCI_ADMIN_API_URL must be a valid URL');
  }
  const local = ['localhost', '127.0.0.1', '::1'].includes(url.hostname);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && local)) {
    throw new Error('SAUCI_ADMIN_API_URL must use HTTPS (HTTP is allowed only for localhost)');
  }
  url.pathname = url.pathname.replace(/\/$/, '');
  return url;
}

export class AdminApiClient {
  private readonly baseUrl: URL;

  constructor(
    baseUrl: string,
    private readonly token: string,
    private readonly fetchImpl: Fetch = fetch,
  ) {
    this.baseUrl = validatedBaseUrl(baseUrl);
    if (!token.trim()) throw new Error('SAUCI_ADMIN_API_TOKEN is required');
  }

  async query<T extends Record<string, unknown> = Record<string, unknown>>(resource: string, query: AdminQuery = {}) {
    return this.request<{ rows: T[]; count: number }>('POST', `/v1/admin/query/${resource}`, query);
  }

  async queryAll<T extends Record<string, unknown> = Record<string, unknown>>(resource: string, query: Omit<AdminQuery, 'limit' | 'offset'> = {}) {
    const rows: T[] = [];
    for (let offset = 0; ; offset += 500) {
      const page = await this.query<T>(resource, { ...query, limit: 500, offset });
      rows.push(...page.rows);
      if (rows.length >= page.count || page.rows.length < 500) return rows;
    }
  }

  async insert<T extends Record<string, unknown> = Record<string, unknown>>(resource: string, records: Record<string, unknown>[]) {
    const result = await this.request<{ rows: T[] }>('POST', `/v1/admin/data/${resource}`, { records });
    return result.rows;
  }

  async update<T extends Record<string, unknown> = Record<string, unknown>>(resource: string, id: string, values: Record<string, unknown>) {
    const result = await this.request<{ row: T }>('PATCH', `/v1/admin/data/${resource}/${encodeURIComponent(id)}`, { values });
    return result.row;
  }

  async delete(resource: string, id: string): Promise<void> {
    await this.request('DELETE', `/v1/admin/data/${resource}/${encodeURIComponent(id)}`);
  }

  async dashboard(): Promise<Record<string, number>> {
    return this.request('GET', '/v1/admin/dashboard');
  }

  async featureInterestCounts(): Promise<Array<{ feature_name: string; opt_in_count: number; opt_in_count_last_7_days: number }>> {
    const result = await this.request<{ counts: Array<{ feature_name: string; opt_in_count: number; opt_in_count_last_7_days: number }> }>(
      'GET',
      '/v1/admin/feature-interest-counts',
    );
    return result.counts;
  }

  async giftPremium(userId: string, days: number, reason?: string): Promise<{ expires_at: string }> {
    return this.request('POST', `/v1/admin/users/${encodeURIComponent(userId)}/gift-premium`, { days, reason });
  }

  async mediaUrl(mediaId: string): Promise<{ url: string; expires_at: string }> {
    return this.request('GET', `/v1/admin/media/${encodeURIComponent(mediaId)}/url`);
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const response = await this.fetchImpl(this.endpoint(path), {
      method,
      headers: {
        authorization: `Bearer ${this.token}`,
        accept: 'application/json',
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const payload = await response.json().catch(() => undefined) as { error?: { code?: string; message?: string } } | undefined;
    if (!response.ok) {
      throw new AdminApiError(payload?.error?.message ?? `Admin API request failed with status ${response.status}`, response.status, payload?.error?.code);
    }
    return payload as T;
  }

  private endpoint(path: string): URL {
    const url = new URL(this.baseUrl.origin);
    const prefix = this.baseUrl.pathname === '/' ? '' : this.baseUrl.pathname;
    url.pathname = `${prefix}${path}`;
    return url;
  }
}

let sharedClient: AdminApiClient | undefined;

export function getAdminApi(): AdminApiClient {
  if (sharedClient) return sharedClient;
  const url = process.env.SAUCI_ADMIN_API_URL;
  const token = process.env.SAUCI_ADMIN_API_TOKEN;
  if (!url || !token) {
    throw new Error('SAUCI_ADMIN_API_URL and SAUCI_ADMIN_API_TOKEN are required for MCP data access');
  }
  sharedClient = new AdminApiClient(url, token);
  return sharedClient;
}
