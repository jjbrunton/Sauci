import { Pool, type PoolClient, type QueryResultRow } from 'pg';
import { closeResolvedPool, resolvePool, type DatabaseConnection } from '../../db/pool.js';
import { readFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { AdminError, type AdminPrincipal, type AdminQuery } from './types.js';
import type { AdminAuthDirectory } from './auth-directory.js';

type Permission =
  | 'manage_packs' | 'manage_questions' | 'manage_categories' | 'view_users'
  | 'view_chats' | 'view_media' | 'view_matches' | 'view_responses' | 'view_activity'
  | 'manage_feedback' | 'gift_premium' | 'manage_codes' | 'manage_admins'
  | 'manage_ai_config' | 'manage_app_config' | 'view_audit_logs';

interface ResourceRule { read: Permission | Permission[]; write?: Permission; idColumn?: string }
const resources: Record<string, ResourceRule> = {
  categories: { read: ['manage_categories', 'manage_packs', 'manage_questions', 'view_activity', 'view_users'], write: 'manage_categories' },
  question_packs: { read: ['manage_packs', 'manage_questions', 'view_activity', 'view_users'], write: 'manage_packs' },
  questions: { read: ['manage_questions', 'view_activity', 'view_responses', 'view_matches', 'view_users', 'manage_ai_config'], write: 'manage_questions' },
  topics: { read: 'manage_packs', write: 'manage_packs' },
  pack_topics: { read: 'manage_packs', write: 'manage_packs', idColumn: 'pack_id' },
  profiles: { read: ['view_users', 'view_activity', 'manage_admins', 'manage_feedback', 'manage_ai_config', 'manage_codes'] }, couples: { read: ['view_users', 'view_activity'] },
  responses: { read: ['view_responses', 'view_activity', 'view_users'] }, matches: { read: ['view_matches', 'view_activity', 'view_users'] },
  messages: { read: ['view_chats', 'view_activity'], write: 'view_chats' },
  message_reports: { read: 'view_chats', write: 'view_chats' },
  feedback: { read: 'manage_feedback', write: 'manage_feedback' },
  admin_users: { read: 'manage_admins', write: 'manage_admins' },
  audit_logs: { read: 'view_audit_logs' },
  redemption_codes: { read: 'manage_codes', write: 'manage_codes' },
  code_redemptions: { read: 'manage_codes' },
  ai_config: { read: 'manage_ai_config', write: 'manage_ai_config' },
  app_config: { read: 'manage_app_config', write: 'manage_app_config' },
  feature_interests: { read: 'view_users' }, couple_packs: { read: 'view_users' },
  couple_streaks: { read: 'view_users' }, live_draw_sessions: { read: 'view_users' },
  subscriptions: { read: 'view_users' },
  media_objects: { read: 'view_media' },
  dare_packs: { read: 'manage_packs', write: 'manage_packs' },
  dares: { read: 'manage_questions', write: 'manage_questions' },
};

function identifier(value: string): string {
  if (!/^[a-z_][a-z0-9_]*$/.test(value)) throw new AdminError('invalid_identifier', 'Invalid field name', 400);
  return `"${value}"`;
}

function rule(resource: string): ResourceRule {
  const value = resources[resource];
  if (!value) throw new AdminError('unsupported_resource', 'Resource is not available to the admin API', 404);
  return value;
}

function requirePermission(principal: AdminPrincipal, permission: Permission): void {
  if (principal.role !== 'super_admin' && !principal.permissions.includes(permission)) {
    throw new AdminError('forbidden', 'This administrator lacks the required permission', 403);
  }
}

function requireAnyPermission(principal: AdminPrincipal, permissions: Permission | Permission[]): void {
  const choices = Array.isArray(permissions) ? permissions : [permissions];
  if (principal.role !== 'super_admin' && !choices.some((permission) => principal.permissions.includes(permission))) {
    throw new AdminError('forbidden', 'This administrator lacks the required permission', 403);
  }
}

function whereParts(query: AdminQuery): { sql: string; values: unknown[] } {
  const values: unknown[] = [];
  const clauses: string[] = [];
  for (const filter of query.filters ?? []) {
    const column = identifier(filter.column);
    const position = values.length + 1;
    if (filter.op === 'is' && filter.value === null) clauses.push(`${column} is null`);
    else if (filter.op === 'neq' && filter.value === null) clauses.push(`${column} is not null`);
    else if (filter.op === 'in') {
      if (!Array.isArray(filter.value)) throw new AdminError('invalid_filter', 'in filters require an array', 400);
      values.push(filter.value); clauses.push(`${column} = any($${position})`);
    } else {
      const operators = { eq: '=', neq: '<>', gte: '>=', lte: '<=', ilike: 'ilike' } as const;
      const operator = operators[filter.op as keyof typeof operators];
      if (!operator) throw new AdminError('invalid_filter', 'Unsupported filter', 400);
      values.push(filter.value); clauses.push(`${column} ${operator} $${position}`);
    }
  }
  return { sql: clauses.length ? ` where ${clauses.join(' and ')}` : '', values };
}

const restrictedReadColumns: Record<string, ReadonlySet<string>> = {
  profiles: new Set(['push_token', 'public_key_jwk']),
  messages: new Set(['encrypted_content', 'encryption_iv', 'keys_metadata']),
  media_objects: new Set(['storage_key']),
};

function projection(resource: string, columns: string[] | undefined): string {
  if (!columns) return '*';
  const restricted = restrictedReadColumns[resource] ?? new Set<string>();
  if (columns.some((column) => restricted.has(column))) {
    throw new AdminError('restricted_column', 'The requested field is not available through generic admin queries', 403);
  }
  return columns.map(identifier).join(',');
}

function sanitizeRows(resource: string, rows: QueryResultRow[]): QueryResultRow[] {
  const restricted = restrictedReadColumns[resource];
  if (!restricted) return rows;
  return rows.map((row) => Object.fromEntries(Object.entries(row).filter(([column]) => !restricted.has(column))));
}

async function transaction<T>(pool: Pool, operation: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try { await client.query('begin'); const value = await operation(client); await client.query('commit'); return value; }
  catch (error) { await client.query('rollback'); throw error; }
  finally { client.release(); }
}

function redactAudit(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactAudit);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => [
    key,
    /(key|secret|token|password|credential)/i.test(key) ? '[REDACTED]' : redactAudit(item),
  ]));
}

export interface AdminRepository {
  principal(userId: string): Promise<AdminPrincipal>;
  query(principal: AdminPrincipal, resource: string, query: AdminQuery): Promise<{ rows: Record<string, unknown>[]; count: number }>;
  insert(principal: AdminPrincipal, resource: string, records: Record<string, unknown>[]): Promise<Record<string, unknown>[]>;
  update(principal: AdminPrincipal, resource: string, id: string, values: Record<string, unknown>): Promise<Record<string, unknown>>;
  delete(principal: AdminPrincipal, resource: string, id: string): Promise<void>;
  dashboard(principal: AdminPrincipal): Promise<Record<string, number>>;
  giftPremium(principal: AdminPrincipal, userId: string, days: number | null, reason?: string): Promise<{ subscription_id: string; expires_at: string | null }>;
  featureInterestCounts(principal: AdminPrincipal): Promise<Array<{
    feature_name: string; opt_in_count: number; opt_in_count_last_7_days: number;
  }>>;
  users(principal: AdminPrincipal, userId?: string): Promise<Record<string, unknown>[]>;
  authorizeMedia(principal: AdminPrincipal, mediaId: string): Promise<void>;
  responseMedia(principal: AdminPrincipal, responseId: string): Promise<{ storageKey: string; mimeType: string }>;
  decryptMessage(principal: AdminPrincipal, messageId: string): Promise<{ content: string | null }>;
  decryptMedia(principal: AdminPrincipal, messageId: string): Promise<{ bytes: Buffer; mimeType: string }>;
  close(): Promise<void>;
}

export class PostgresAdminRepository implements AdminRepository {
  private readonly pool: Pool;
  private readonly ownsPool: boolean;
  constructor(connection: DatabaseConnection, private readonly options: {
    adminPrivateKeyJwk?: string; mediaRoot?: string; authDirectory?: AdminAuthDirectory;
  } = {}) { const resolved = resolvePool(connection); this.pool = resolved.pool; this.ownsPool = resolved.owned; }

  async principal(userId: string): Promise<AdminPrincipal> {
    const result = await this.pool.query<{ id: string; user_id: string; role: AdminPrincipal['role']; permissions: string[] }>(
      'select id, user_id, role, permissions from admin_users where user_id=$1 and is_active=true', [userId],
    );
    const row = result.rows[0];
    if (!row) throw new AdminError('admin_access_denied', 'Administrator access denied', 403);
    return { adminId: row.id, userId: row.user_id, role: row.role, permissions: row.permissions ?? [] };
  }

  async query(principal: AdminPrincipal, resource: string, query: AdminQuery) {
    requireAnyPermission(principal, rule(resource).read);
    const where = whereParts(query);
    const table = identifier(resource);
    const selected = projection(resource, query.columns);
    let pageSql = where.sql;
    if (query.order) pageSql += ` order by ${identifier(query.order.column)} ${query.order.ascending === false ? 'desc' : 'asc'}`;
    const pageValues = [...where.values, Math.min(Math.max(query.limit ?? 100, 1), 500)];
    pageSql += ` limit $${pageValues.length}`;
    if (query.offset) { pageValues.push(Math.max(query.offset, 0)); pageSql += ` offset $${pageValues.length}`; }
    const [rows, count] = await Promise.all([
      this.pool.query<QueryResultRow>(`select ${selected} from ${table}${pageSql}`, pageValues),
      this.pool.query<{ count: string }>(`select count(*)::text count from ${table}${where.sql}`, where.values),
    ]);
    return { rows: sanitizeRows(resource, rows.rows), count: Number(count.rows[0]?.count ?? 0) };
  }

  async insert(principal: AdminPrincipal, resource: string, records: Record<string, unknown>[]) {
    const permission = rule(resource).write;
    if (!permission) throw new AdminError('forbidden', 'Resource is read-only', 403);
    requirePermission(principal, permission);
    if (!records.length) throw new AdminError('invalid_records', 'At least one record is required', 400);
    return transaction(this.pool, async (client) => {
      const inserted: Record<string, unknown>[] = [];
      for (const record of records) {
        const keys = Object.keys(record); if (!keys.length) throw new AdminError('invalid_record', 'Record cannot be empty', 400);
        const result = await client.query<QueryResultRow>(
          `insert into ${identifier(resource)} (${keys.map(identifier).join(',')}) values (${keys.map((_, index) => `$${index + 1}`).join(',')}) returning *`,
          keys.map((key) => record[key]),
        );
        const row = result.rows[0]!; inserted.push(row);
        await this.audit(client, principal, resource, 'INSERT', String(row.id ?? row[rule(resource).idColumn ?? 'id'] ?? ''), null, row);
      }
      return inserted;
    });
  }

  async update(principal: AdminPrincipal, resource: string, id: string, values: Record<string, unknown>) {
    const resourceRule = rule(resource); if (!resourceRule.write) throw new AdminError('forbidden', 'Resource is read-only', 403);
    requirePermission(principal, resourceRule.write);
    const keys = Object.keys(values); if (!keys.length) throw new AdminError('invalid_record', 'Updates cannot be empty', 400);
    const idColumn = resourceRule.idColumn ?? 'id';
    return transaction(this.pool, async (client) => {
      const old = await client.query<QueryResultRow>(`select * from ${identifier(resource)} where ${identifier(idColumn)}=$1 for update`, [id]);
      if (!old.rows.length) throw new AdminError('not_found', 'Record not found', 404);
      const updated = await client.query<QueryResultRow>(
        `update ${identifier(resource)} set ${keys.map((key, index) => `${identifier(key)}=$${index + 2}`).join(',')} where ${identifier(idColumn)}=$1 returning *`,
        [id, ...keys.map((key) => values[key])],
      );
      for (let index = 0; index < updated.rows.length; index += 1) {
        const oldRow = old.rows[index]; const updatedRow = updated.rows[index]!;
        await this.audit(client, principal, resource, 'UPDATE', String(updatedRow.id ?? id), oldRow, updatedRow);
      }
      return updated.rows[0]!;
    });
  }

  async delete(principal: AdminPrincipal, resource: string, id: string): Promise<void> {
    const resourceRule = rule(resource); if (!resourceRule.write) throw new AdminError('forbidden', 'Resource is read-only', 403);
    requirePermission(principal, resourceRule.write);
    const idColumn = resourceRule.idColumn ?? 'id';
    await transaction(this.pool, async (client) => {
      const deleted = await client.query<QueryResultRow>(`delete from ${identifier(resource)} where ${identifier(idColumn)}=$1 returning *`, [id]);
      if (!deleted.rows.length) throw new AdminError('not_found', 'Record not found', 404);
      for (const row of deleted.rows) {
        await this.audit(client, principal, resource, 'DELETE', String(row.id ?? id), row, null);
      }
    });
  }

  async dashboard(principal: AdminPrincipal): Promise<Record<string, number>> {
    const result = await this.pool.query<{ categories: number; packs: number; questions: number; users: number }>(
      'select (select count(*)::int from categories) categories, (select count(*)::int from question_packs) packs, (select count(*)::int from questions) questions, (select count(*)::int from profiles) users',
    );
    return result.rows[0] ?? { categories: 0, packs: 0, questions: 0, users: 0 };
  }

  async giftPremium(principal: AdminPrincipal, userId: string, days: number | null, reason?: string) {
    requirePermission(principal, 'gift_premium');
    return transaction(this.pool, async (client) => {
      const profile = await client.query('select id from profiles where id=$1 for update', [userId]);
      if (!profile.rows[0]) throw new AdminError('user_not_found', 'User not found', 404);
      const expiresAt = days === null ? null : new Date(Date.now() + days * 86_400_000);
      const inserted = await client.query<{ id: string }>(
        `insert into subscriptions(user_id,revenuecat_app_user_id,product_id,status,entitlement_ids,purchased_at,expires_at,store)
         values($1,$2,'admin_premium','active',array['premium'],now(),$3,'manual') returning id`,
        [userId, `admin_grant:${userId}`, expiresAt],
      );
      await client.query('update profiles set is_premium=true,updated_at=now() where id=$1', [userId]);
      await client.query(
        `insert into audit_logs(admin_user_id,actor_user_id,table_name,action,record_id,new_values)
         values($1,$2,'subscriptions','ACTION',$3,$4)`,
        [principal.adminId, principal.userId, inserted.rows[0]!.id, { action: 'gift_premium', target_user_id: userId, days, reason: reason ?? null, expires_at: expiresAt?.toISOString() ?? null }],
      );
      return { subscription_id: inserted.rows[0]!.id, expires_at: expiresAt?.toISOString() ?? null };
    });
  }

  async featureInterestCounts(principal: AdminPrincipal) {
    requirePermission(principal, 'view_users');
    const result = await this.pool.query<{
      feature_name: string; opt_in_count: number; opt_in_count_last_7_days: number;
    }>(`select feature as feature_name,
               count(*)::int as opt_in_count,
               count(*) filter (where created_at >= now() - interval '7 days')::int as opt_in_count_last_7_days
          from feature_interests group by feature order by feature`);
    return result.rows;
  }

  async users(principal: AdminPrincipal, userId?: string) {
    requirePermission(principal, 'view_users');
    const result = await this.pool.query<QueryResultRow & { id: string }>(
      `select p.*,coalesce(sum(mo.byte_size) filter(where mo.deleted_at is null),0)::bigint::text as storage_bytes
         from profiles p left join media_objects mo on mo.owner_id=p.id
        ${userId ? 'where p.id=$1' : ''} group by p.id order by p.created_at desc limit 500`,
      userId ? [userId] : [],
    );
    const authUsers = await this.options.authDirectory?.users(userId).catch(() => []) ?? [];
    const authById = new Map(authUsers.map((user) => [user.id, user]));
    return result.rows.map((profile) => {
      const authUser = authById.get(profile.id);
      return {
        ...profile,
        email: authUser?.email ?? profile.email ?? null,
        last_sign_in_at: authUser?.last_sign_in_at ?? null,
        email_confirmed_at: authUser?.email_confirmed_at ?? null,
      };
    });
  }

  async authorizeMedia(principal: AdminPrincipal, mediaId: string): Promise<void> {
    requirePermission(principal, 'view_media');
    const result = await this.pool.query('select 1 from media_objects where id=$1 and deleted_at is null', [mediaId]);
    if (!result.rows[0]) throw new AdminError('media_not_found', 'Media not found', 404);
  }

  async responseMedia(principal: AdminPrincipal, responseId: string): Promise<{ storageKey: string; mimeType: string }> {
    requirePermission(principal, 'view_responses');
    const result = await this.pool.query<{ storage_key: string; mime_type: string }>(
      `select mo.storage_key,mo.mime_type
         from responses r
         join media_objects mo
           on r.response_data->>'media_path'='media:'||mo.id::text
          and mo.kind='response'
          and mo.owner_id=r.user_id
          and mo.couple_id=r.couple_id
          and (mo.question_id is null or mo.question_id=r.question_id)
        where r.id=$1 and mo.deleted_at is null and (mo.expires_at is null or mo.expires_at>now())`,
      [responseId],
    );
    const row = result.rows[0];
    if (!row) throw new AdminError('response_media_not_found', 'Response media not found', 404);
    return { storageKey: row.storage_key, mimeType: row.mime_type };
  }

  private async messageForDecryption(messageId: string) {
    const result = await this.pool.query<{
      content: string | null; encrypted_content: string | null; encryption_iv: string | null;
      keys_metadata: { admin_wrapped_key?: string } | null; version: number; media_path: string | null;
      storage_key: string | null; mime_type: string | null;
    }>(
      `select m.content,m.encrypted_content,m.encryption_iv,m.keys_metadata,m.version,m.media_path,mo.storage_key,mo.mime_type
         from messages m left join media_objects mo on m.media_path='media:'||mo.id::text where m.id=$1`, [messageId],
    );
    const row = result.rows[0]; if (!row) throw new AdminError('message_not_found', 'Message not found', 404); return row;
  }

  private async messageKey(row: { keys_metadata: { admin_wrapped_key?: string } | null }): Promise<CryptoKey> {
    const wrapped = row.keys_metadata?.admin_wrapped_key;
    if (!wrapped || !this.options.adminPrivateKeyJwk) throw new AdminError('decryption_unavailable', 'Admin decryption key is unavailable', 403);
    const privateKey = await crypto.subtle.importKey('jwk', JSON.parse(this.options.adminPrivateKeyJwk) as JsonWebKey, { name: 'RSA-OAEP', hash: 'SHA-256' }, false, ['decrypt']);
    const raw = await crypto.subtle.decrypt({ name: 'RSA-OAEP' }, privateKey, Buffer.from(wrapped, 'base64'));
    return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['decrypt']);
  }

  async decryptMessage(principal: AdminPrincipal, messageId: string) {
    requirePermission(principal, 'view_chats');
    const row = await this.messageForDecryption(messageId);
    if (row.version !== 2 || !row.encrypted_content) return { content: row.content };
    if (!row.encryption_iv) throw new AdminError('invalid_encrypted_message', 'Message encryption metadata is incomplete', 409);
    const key = await this.messageKey(row);
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: Buffer.from(row.encryption_iv, 'base64') }, key, Buffer.from(row.encrypted_content, 'base64'));
    return { content: new TextDecoder().decode(plain) };
  }

  async decryptMedia(principal: AdminPrincipal, messageId: string) {
    requirePermission(principal, 'view_media');
    const row = await this.messageForDecryption(messageId);
    if (!row.storage_key || !row.mime_type) throw new AdminError('media_not_found', 'Message media not found', 404);
    const root = resolve(this.options.mediaRoot ?? '/data/media'); const path = resolve(root, row.storage_key);
    if (!path.startsWith(`${root}${sep}`)) throw new AdminError('invalid_media_path', 'Invalid media path', 400);
    let bytes = await readFile(path);
    if (row.version === 2) {
      if (!row.encryption_iv) throw new AdminError('invalid_encrypted_message', 'Message encryption metadata is incomplete', 409);
      const key = await this.messageKey(row);
      bytes = Buffer.from(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: Buffer.from(row.encryption_iv, 'base64') }, key, bytes));
    }
    return { bytes, mimeType: row.mime_type };
  }

  private async audit(client: PoolClient, principal: AdminPrincipal, table: string, action: 'INSERT' | 'UPDATE' | 'DELETE', recordId: string, oldValues: unknown, newValues: unknown) {
    await client.query('insert into audit_logs(admin_user_id,actor_user_id,table_name,action,record_id,old_values,new_values) values($1,$2,$3,$4,$5,$6,$7)', [principal.adminId, principal.userId, table, action, recordId || null, redactAudit(oldValues), redactAudit(newValues)]);
  }

  async close(): Promise<void> { await closeResolvedPool(this.pool, this.ownsPool); }
}
