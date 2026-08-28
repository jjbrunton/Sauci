import { AdminApiError, getAdminApi, type AdminFilter, type AdminQuery } from './admin-api.js';

type Row = Record<string, any>;
type Result = { data: any; error: { message: string } | null; count: number | null };
type Action = 'select' | 'insert' | 'update' | 'delete';

class AdminQueryBuilder implements PromiseLike<Result> {
  private action: Action = 'select';
  private filters: AdminFilter[] = [];
  private orderBy?: AdminQuery['order'];
  private pageLimit?: number;
  private pageOffset?: number;
  private input?: Row | Row[];
  private selection = '*';
  private localPredicates: Array<(row: Row) => boolean> = [];
  private cardinality: 'many' | 'single' | 'maybeSingle' = 'many';

  constructor(private readonly resource: string) {}

  select(columns = '*', _options?: { count?: 'exact'; head?: boolean }) { this.selection = columns; return this; }
  insert(values: Row | Row[]) { this.action = 'insert'; this.input = values; return this; }
  update(values: Row) { this.action = 'update'; this.input = values; return this; }
  delete() { this.action = 'delete'; return this; }
  eq(column: string, value: unknown) { this.filters.push({ column, op: 'eq', value }); return this; }
  neq(column: string, value: unknown) { this.filters.push({ column, op: 'neq', value }); return this; }
  in(column: string, value: unknown[]) { this.filters.push({ column, op: 'in', value }); return this; }
  is(column: string, value: unknown) { this.filters.push({ column, op: 'is', value }); return this; }
  not(column: string, operator: string, value: unknown) {
    if (operator === 'is' && value === null) this.localPredicates.push((row) => row[column] !== null && row[column] !== undefined);
    else throw new Error(`Unsupported admin query: not(${column}, ${operator})`);
    return this;
  }
  or(expression: string) {
    const conditions = expression.split(',').map((part) => {
      const match = part.match(/^([a-z_][a-z0-9_]*)\.ilike\.(.*)$/i);
      if (!match) throw new Error('Only ilike OR expressions are supported by the MCP admin client');
      const pattern = match[2].replace(/^%|%$/g, '').toLocaleLowerCase();
      return (row: Row) => String(row[match[1]] ?? '').toLocaleLowerCase().includes(pattern);
    });
    this.localPredicates.push((row) => conditions.some((condition) => condition(row)));
    return this;
  }
  order(column: string, options?: { ascending?: boolean }) { this.orderBy = { column, ascending: options?.ascending }; return this; }
  range(from: number, to: number) { this.pageOffset = from; this.pageLimit = Math.max(to - from + 1, 0); return this; }
  limit(limit: number) { this.pageLimit = limit; return this; }
  single() { this.cardinality = 'single'; return this.execute(); }
  maybeSingle() { this.cardinality = 'maybeSingle'; return this.execute(); }

  then<TResult1 = Result, TResult2 = never>(
    onfulfilled?: ((value: Result) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }

  private async execute(): Promise<Result> {
    try {
      const api = getAdminApi();
      if (this.action === 'insert') {
        const rows = await api.insert(this.resource, Array.isArray(this.input) ? this.input : [this.input!]);
        return this.success(rows);
      }
      if (this.action === 'update') {
        const id = this.mutationIds()[0];
        const row = await api.update(this.resource, id, this.input as Row);
        return this.success([row]);
      }
      if (this.action === 'delete') {
        await Promise.all(this.mutationIds().map((id) => api.delete(this.resource, id)));
        return { data: null, error: null, count: null };
      }

      let rows: Row[];
      let count: number;
      if (this.localPredicates.length) {
        rows = await api.queryAll(this.resource, { filters: this.filters, order: this.orderBy });
        rows = rows.filter((row) => this.localPredicates.every((predicate) => predicate(row)));
        count = rows.length;
        rows = rows.slice(this.pageOffset ?? 0, (this.pageOffset ?? 0) + (this.pageLimit ?? rows.length));
      } else {
        const result = await api.query(this.resource, {
          filters: this.filters,
          order: this.orderBy,
          limit: this.pageLimit,
          offset: this.pageOffset,
        });
        rows = result.rows;
        count = result.count;
      }
      rows = await enrich(this.resource, this.selection, rows);
      return this.success(rows, count);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Unknown admin API error';
      return { data: null, error: { message }, count: null };
    }
  }

  private mutationIds(): string[] {
    const idFilter = this.filters.find((filter) => filter.column === 'id' && (filter.op === 'eq' || filter.op === 'in'));
    if (!idFilter) throw new Error('Admin mutations require an id filter');
    return (Array.isArray(idFilter.value) ? idFilter.value : [idFilter.value]).map(String);
  }

  private success(rows: Row[], count: number | null = null): Result {
    if (this.cardinality === 'single' && rows.length !== 1) return { data: null, error: { message: `Expected one row, received ${rows.length}` }, count };
    if (this.cardinality === 'maybeSingle' && rows.length > 1) return { data: null, error: { message: `Expected at most one row, received ${rows.length}` }, count };
    return { data: this.cardinality === 'many' ? rows : rows[0] ?? null, error: null, count };
  }
}

async function rowsByIds(resource: string, ids: unknown[]): Promise<Map<string, Row>> {
  const unique = [...new Set(ids.filter(Boolean).map(String))];
  if (!unique.length) return new Map();
  const rows = await getAdminApi().queryAll(resource, { filters: [{ column: 'id', op: 'in', value: unique }] });
  return new Map(rows.map((row) => [String(row.id), row]));
}

async function enrich(resource: string, selection: string, rows: Row[]): Promise<Row[]> {
  if (!rows.length || selection.trim() === '*') return rows;
  if (resource === 'categories' && selection.includes('question_packs')) {
    const packs = await getAdminApi().queryAll('question_packs');
    return rows.map((row) => ({ ...row, question_packs: [{ count: packs.filter((pack) => pack.category_id === row.id).length }] }));
  }
  if (resource === 'question_packs' && selection.includes('questions')) {
    const questions = await getAdminApi().queryAll('questions');
    return rows.map((row) => ({ ...row, questions: [{ count: questions.filter((question) => question.pack_id === row.id).length }] }));
  }
  const relations = relationsFor(resource, selection);
  let enriched = rows;
  for (const relation of relations) {
    const related = await rowsByIds(relation.resource, enriched.map((row) => row[relation.foreignKey]));
    enriched = enriched.map((row) => {
      const value = related.get(String(row[relation.foreignKey]));
      const projected = value && relation.fields
        ? Object.fromEntries(relation.fields.map((field) => [field, value[field]]))
        : value;
      return { ...row, [relation.alias]: projected ?? null };
    });
  }
  return enriched;
}

function relationsFor(resource: string, selection: string): Array<{ alias: string; resource: string; foreignKey: string; fields?: string[] }> {
  const candidates: Record<string, Array<{ marker: string; alias: string; resource: string; foreignKey: string; fields?: string[] }>> = {
    admin_users: [{ marker: 'user:user_id', alias: 'user', resource: 'profiles', foreignKey: 'user_id', fields: ['name', 'email', 'avatar_url'] }],
    code_redemptions: [{ marker: 'user:user_id', alias: 'user', resource: 'profiles', foreignKey: 'user_id', fields: ['name', 'email'] }],
    profiles: [{ marker: 'couple:couple_id', alias: 'couple', resource: 'couples', foreignKey: 'couple_id' }],
    responses: [{ marker: 'question:question_id', alias: 'question', resource: 'questions', foreignKey: 'question_id', fields: ['text', 'intensity'] }],
    matches: [{ marker: 'question:question_id', alias: 'question', resource: 'questions', foreignKey: 'question_id', fields: ['text'] }],
    feedback: [
      { marker: 'question:question_id', alias: 'question', resource: 'questions', foreignKey: 'question_id', fields: ['text'] },
      { marker: 'user:user_id', alias: 'user', resource: 'profiles', foreignKey: 'user_id', fields: ['name', 'email'] },
    ],
    message_reports: [
      { marker: 'message:message_id', alias: 'message', resource: 'messages', foreignKey: 'message_id' },
      { marker: 'reporter:reporter_id', alias: 'reporter', resource: 'profiles', foreignKey: 'reporter_id', fields: ['name', 'email'] },
    ],
  };
  return candidates[resource]?.filter((candidate) => selection.includes(candidate.marker)) ?? [];
}

export const adminData = {
  from(resource: string) { return new AdminQueryBuilder(resource); },
  async featureInterestCounts(): Promise<Result> {
    try {
      const counts = await getAdminApi().featureInterestCounts();
      return { data: counts, error: null, count: counts.length };
    } catch (cause) {
      return { data: null, error: { message: cause instanceof AdminApiError ? cause.message : String(cause) }, count: null };
    }
  },
};
