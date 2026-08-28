import { apiUrl, authClient } from '@/config';

export class AdminApiError extends Error {
    constructor(message: string, readonly status: number, readonly details?: unknown) {
        super(message);
        this.name = 'AdminApiError';
    }
}

type RequestOptions = Omit<RequestInit, 'body'> & { body?: unknown };

async function accessToken(): Promise<string> {
    const { data, error } = await authClient.auth.getSession();
    const token = data.session?.access_token;
    if (error || !token) throw new AdminApiError('An authenticated admin session is required', 401, error);
    return token;
}

export async function adminRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const token = await accessToken();
    const headers = new Headers(options.headers);
    headers.set('Accept', 'application/json');
    headers.set('Authorization', `Bearer ${token}`);
    const body = options.body === undefined ? undefined : JSON.stringify(options.body);
    if (body !== undefined) headers.set('Content-Type', 'application/json');
    const response = await fetch(`${apiUrl}${path.startsWith('/') ? path : `/${path}`}`, { ...options, headers, body });
    const text = await response.text();
    let parsed: unknown;
    try { parsed = text ? JSON.parse(text) : undefined; } catch { parsed = text; }
    if (!response.ok) {
        const nested = parsed && typeof parsed === 'object' && 'error' in parsed ? (parsed as { error: unknown }).error : undefined;
        const message = nested && typeof nested === 'object' && 'message' in nested
            ? String((nested as { message: unknown }).message)
            : `Admin API request failed with status ${response.status}`;
        throw new AdminApiError(message, response.status, parsed);
    }
    return parsed as T;
}

export async function adminBinaryRequest(path: string, options: RequestOptions = {}): Promise<Blob> {
    const token = await accessToken();
    const headers = new Headers(options.headers);
    headers.set('Authorization', `Bearer ${token}`);
    const body = options.body === undefined ? undefined : JSON.stringify(options.body);
    if (body !== undefined) headers.set('Content-Type', 'application/json');
    const response = await fetch(`${apiUrl}${path.startsWith('/') ? path : `/${path}`}`, { ...options, headers, body });
    if (!response.ok) throw new AdminApiError(`Admin media request failed with status ${response.status}`, response.status);
    return response.blob();
}

export function getAdminResponseMedia(responseId: string): Promise<Blob> {
    return adminBinaryRequest(`/v1/admin/responses/${encodeURIComponent(responseId)}/media`);
}

export type AdminFilter = { column: string; op: 'eq' | 'neq' | 'in' | 'is' | 'gte' | 'lte' | 'ilike'; value: unknown };
export type AdminQuery = {
    filters?: AdminFilter[];
    order?: { column: string; ascending?: boolean };
    limit?: number;
    offset?: number;
};

export async function queryAdminRows<T>(resource: string, query: AdminQuery = {}): Promise<{ rows: T[]; count: number }> {
    return adminRequest(`/v1/admin/query/${encodeURIComponent(resource)}`, { method: 'POST', body: query });
}

function uniqueValues(rows: Record<string, unknown>[], key: string): unknown[] {
    return [...new Set(rows.map((row) => row[key]).filter((value) => value !== null && value !== undefined))];
}

async function relatedRows(resource: string, column: string, values: unknown[]): Promise<Record<string, unknown>[]> {
    if (values.length === 0) return [];
    return (await queryAdminRows<Record<string, unknown>>(resource, {
        filters: [{ column, op: 'in', value: values }], limit: 500,
    })).rows;
}

async function hydrateAdminRows(resource: string, selection: string, input: any[]): Promise<any[]> {
    const rows = input as Record<string, unknown>[];
    if (rows.length === 0) return input;
    if (resource === 'question_packs' && selection.includes('categor')) {
        const categories = await relatedRows('categories', 'id', uniqueValues(rows, 'category_id'));
        const byId = new Map(categories.map((row) => [row.id, row]));
        rows.forEach((row) => { row.category = byId.get(row.category_id) ?? null; });
    }
    if (resource === 'pack_topics' && selection.includes('topics')) {
        const topics = await relatedRows('topics', 'id', uniqueValues(rows, 'topic_id'));
        const byId = new Map(topics.map((row) => [row.id, row]));
        rows.forEach((row) => { row.topics = byId.get(row.topic_id) ?? null; });
    }
    if (resource === 'feedback' && selection.includes('profile')) {
        const profiles = await relatedRows('profiles', 'id', uniqueValues(rows, 'user_id'));
        const byId = new Map(profiles.map((row) => [row.id, row]));
        rows.forEach((row) => { row.profile = byId.get(row.user_id) ?? null; });
    }
    if (resource === 'message_reports') {
        if (selection.includes('message:')) {
            const messages = await relatedRows('messages', 'id', uniqueValues(rows, 'message_id'));
            const byId = new Map(messages.map((row) => [row.id, row]));
            rows.forEach((row) => { row.message = byId.get(row.message_id) ?? null; });
        }
        if (selection.includes('reporter_profile')) {
            const profiles = await relatedRows('profiles', 'id', uniqueValues(rows, 'reporter_id'));
            const byId = new Map(profiles.map((row) => [row.id, row]));
            rows.forEach((row) => { row.reporter_profile = byId.get(row.reporter_id) ?? null; });
        }
    }
    if (resource === 'responses') {
        if (selection.includes('profile:')) {
            const profiles = await relatedRows('profiles', 'id', uniqueValues(rows, 'user_id'));
            const byId = new Map(profiles.map((row) => [row.id, row]));
            rows.forEach((row) => { row.profile = byId.get(row.user_id) ?? null; });
        }
        if (selection.includes('question:')) {
            const questions = await relatedRows('questions', 'id', uniqueValues(rows, 'question_id'));
            if (selection.includes('pack:question_packs')) {
                const packs = await relatedRows('question_packs', 'id', uniqueValues(questions, 'pack_id'));
                const packsById = new Map(packs.map((row) => [row.id, row]));
                questions.forEach((row) => { row.pack = packsById.get(row.pack_id) ?? null; });
            }
            const byId = new Map(questions.map((row) => [row.id, row]));
            rows.forEach((row) => { row.question = byId.get(row.question_id) ?? null; });
        }
    }
    if (resource === 'matches' && selection.includes('question:')) {
        const questions = await relatedRows('questions', 'id', uniqueValues(rows, 'question_id'));
        const byId = new Map(questions.map((row) => [row.id, row]));
        rows.forEach((row) => { row.question = byId.get(row.question_id) ?? null; });
    }
    if (resource === 'messages' && selection.includes('match:')) {
        const matches = await relatedRows('matches', 'id', uniqueValues(rows, 'match_id'));
        const questions = await relatedRows('questions', 'id', uniqueValues(matches, 'question_id'));
        const questionsById = new Map(questions.map((row) => [row.id, row]));
        matches.forEach((row) => { row.question = questionsById.get(row.question_id) ?? null; });
        const byId = new Map(matches.map((row) => [row.id, row]));
        rows.forEach((row) => { row.match = byId.get(row.match_id) ?? null; });
    }
    return input;
}

type QueryResult<T> = { data: T | null; error: Error | null; count: number | null };
type QueryMode = 'many' | 'single' | 'maybeSingle';

class AdminQueryBuilder<T = any> implements PromiseLike<QueryResult<T[]>> {
    private readonly filters: AdminFilter[] = [];
    private ordering?: { column: string; ascending?: boolean };
    private maxRows?: number;
    private offset?: number;
    private head = false;
    private selection = '*';
    private orFilters?: AdminFilter[];
    private mode: QueryMode = 'many';
    private mutation?: { type: 'insert'; records: Record<string, unknown>[] } | { type: 'update'; values: Record<string, unknown> } | { type: 'delete' };

    constructor(private readonly resource: string) {}

    select(columns = '*', options?: { count?: 'exact'; head?: boolean }): this {
        this.selection = columns;
        this.head = options?.head === true;
        return this;
    }
    eq(column: string, value: unknown): this { this.filters.push({ column, op: 'eq', value }); return this; }
    neq(column: string, value: unknown): this { this.filters.push({ column, op: 'neq', value }); return this; }
    in(column: string, value: unknown[]): this { this.filters.push({ column, op: 'in', value }); return this; }
    is(column: string, value: unknown): this { this.filters.push({ column, op: 'is', value }); return this; }
    gte(column: string, value: unknown): this { this.filters.push({ column, op: 'gte', value }); return this; }
    lte(column: string, value: unknown): this { this.filters.push({ column, op: 'lte', value }); return this; }
    ilike(column: string, value: string): this { this.filters.push({ column, op: 'ilike', value }); return this; }
    or(expression: string): this {
        this.orFilters = expression.split(',').map((part) => {
            const match = /^([a-z_][a-z0-9_]*)\.ilike\.(.+)$/.exec(part);
            if (!match) throw new Error('Unsupported admin OR filter');
            return { column: match[1], op: 'ilike' as const, value: match[2] };
        });
        return this;
    }
    not(column: string, operator: string, value: unknown): this {
        if (operator !== 'is' || value !== null) throw new Error(`Unsupported admin filter: not ${operator}`);
        this.filters.push({ column, op: 'neq', value: null });
        return this;
    }
    order(column: string, options?: { ascending?: boolean }): this { this.ordering = { column, ascending: options?.ascending }; return this; }
    limit(value: number): this { this.maxRows = value; return this; }
    range(from: number, to: number): this { this.offset = from; this.maxRows = to - from + 1; return this; }
    single<TResult = T>(): PromiseLike<QueryResult<TResult>> { this.mode = 'single'; return this as unknown as PromiseLike<QueryResult<TResult>>; }
    maybeSingle<TResult = T>(): PromiseLike<QueryResult<TResult>> { this.mode = 'maybeSingle'; return this as unknown as PromiseLike<QueryResult<TResult>>; }
    insert(records: Record<string, unknown> | Record<string, unknown>[]): this {
        this.mutation = { type: 'insert', records: Array.isArray(records) ? records : [records] };
        return this;
    }
    update(values: Record<string, unknown>): this { this.mutation = { type: 'update', values }; return this; }
    delete(): this { this.mutation = { type: 'delete' }; return this; }

    then<TResult1 = QueryResult<T[]>, TResult2 = never>(
        onfulfilled?: ((value: QueryResult<T[]>) => TResult1 | PromiseLike<TResult1>) | null,
        onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
    ): PromiseLike<TResult1 | TResult2> {
        return this.execute().then(onfulfilled, onrejected);
    }

    private async execute(): Promise<QueryResult<T[]>> {
        try {
            if (this.mutation?.type === 'insert') {
                const result = await adminRequest<{ rows: T[] }>(`/v1/admin/data/${this.resource}`, { method: 'POST', body: { records: this.mutation.records } });
                return this.shape(result.rows, result.rows.length);
            }
            if (this.mutation) {
                const matching = await queryAdminRows<Record<string, unknown>>(this.resource, { filters: this.filters, limit: 500 });
                const ids = [...new Set(matching.rows.map((row) => String(row.id ?? row.pack_id ?? '')).filter(Boolean))];
                if (this.mutation.type === 'update') {
                    const rows = await Promise.all(ids.map((id) => adminRequest<{ row: T }>(`/v1/admin/data/${this.resource}/${encodeURIComponent(id)}`, { method: 'PATCH', body: { values: this.mutation!.type === 'update' ? this.mutation!.values : {} } }).then((value) => value.row)));
                    return this.shape(rows, rows.length);
                }
                await Promise.all(ids.map((id) => adminRequest(`/v1/admin/data/${this.resource}/${encodeURIComponent(id)}`, { method: 'DELETE' })));
                return this.shape([], ids.length);
            }
            const result = this.orFilters?.length
                ? await this.executeOrQuery()
                : await queryAdminRows<T>(this.resource, { filters: this.filters, order: this.ordering, limit: this.maxRows, offset: this.offset });
            if (!this.head) result.rows = await hydrateAdminRows(this.resource, this.selection, result.rows);
            return this.shape(result.rows, result.count);
        } catch (cause) {
            return { data: null, error: cause instanceof Error ? cause : new Error(String(cause)), count: null };
        }
    }

    private async executeOrQuery(): Promise<{ rows: T[]; count: number }> {
        const results = await Promise.all(this.orFilters!.map((filter) => queryAdminRows<T>(this.resource, {
            filters: [...this.filters, filter], order: this.ordering, limit: 500,
        })));
        const unique = new Map<string, T>();
        for (const result of results) result.rows.forEach((row, index) => {
            const record = row as Record<string, unknown>;
            unique.set(String(record.id ?? `${record.pack_id ?? ''}:${record.topic_id ?? ''}:${index}`), row);
        });
        let rows = [...unique.values()];
        if (this.offset) rows = rows.slice(this.offset);
        if (this.maxRows) rows = rows.slice(0, this.maxRows);
        return { rows, count: unique.size };
    }

    private shape(rows: T[], count: number): QueryResult<T[]> {
        if (this.head) return { data: null, error: null, count };
        if (this.mode === 'single') {
            if (rows.length !== 1) return { data: null, error: new Error(`Expected one ${this.resource} record, received ${rows.length}`), count };
            return { data: rows[0] as unknown as T[], error: null, count };
        }
        if (this.mode === 'maybeSingle') {
            if (rows.length > 1) return { data: null, error: new Error(`Expected at most one ${this.resource} record, received ${rows.length}`), count };
            return { data: (rows[0] ?? null) as unknown as T[], error: null, count };
        }
        return { data: rows, error: null, count };
    }
}

export const adminData = {
    from<T = any>(resource: string): AdminQueryBuilder<T> { return new AdminQueryBuilder<T>(resource); },
};
