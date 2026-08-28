import type { Pool, PoolClient } from 'pg';
import type { DatabaseMigrationOptions, TableResult } from './types.js';

interface TableSpec {
  name: string;
  key: string[];
  replace?: boolean;
  /** Target-column to legacy source-column rename. */
  columnMap?: Record<string, string>;
  /** Target-column SQL expressions for legacy rows that need a derived value. */
  sourceExpressions?: Record<string, string>;
  /** Columns populated after all rows exist, for self-referential foreign keys. */
  deferredColumns?: string[];
  /** Keep a newer standalone-backend row when the same key exists in both systems. */
  preserveNewer?: boolean;
  /** Singleton runtime configuration is owned by the live target during an initial merge. */
  preserveExistingOnInitial?: boolean;
}
export const TABLES: TableSpec[] = [
  { name: 'couples', key: ['id'], sourceExpressions: { invite_code: 'upper("couples"."invite_code")' } },
  { name: 'profiles', key: ['id'], preserveNewer: true },
  { name: 'admin_users', key: ['id'] }, { name: 'master_keys', key: ['id'] },
  { name: 'categories', key: ['id'] }, { name: 'question_packs', key: ['id'] },
  { name: 'topics', key: ['id'] }, { name: 'pack_topics', key: ['pack_id', 'topic_id'] },
  { name: 'questions', key: ['id'], deferredColumns: ['inverse_of'] },
  { name: 'content_reviews', key: ['id'] },
  { name: 'app_config', key: ['id'], replace: true, preserveExistingOnInitial: true },
  { name: 'ai_config', key: ['id'], replace: true, preserveExistingOnInitial: true },
  { name: 'dare_packs', key: ['id'] }, { name: 'dares', key: ['id'] },
  { name: 'sent_dares', key: ['id'] }, { name: 'dare_messages', key: ['id'] },
  { name: 'couple_packs', key: ['couple_id', 'pack_id'] }, { name: 'responses', key: ['id'] },
  { name: 'matches', key: ['id'] }, { name: 'couple_streaks', key: ['couple_id'] },
  { name: 'messages', key: ['id'] }, { name: 'match_archives', key: ['id'] },
  { name: 'message_deletions', key: ['message_id', 'user_id'] }, { name: 'message_reports', key: ['id'] },
  { name: 'notification_preferences', key: ['user_id'] }, { name: 'feedback', key: ['id'] },
  { name: 'subscriptions', key: ['id'] }, { name: 'revenuecat_webhook_events', key: ['id'] },
  { name: 'redemption_codes', key: ['id'] }, { name: 'code_redemptions', key: ['id'] },
  { name: 'feature_interests', key: ['user_id', 'feature'], columnMap: { feature: 'feature_name' } },
  {
    name: 'live_draw_sessions', key: ['couple_id'],
    sourceExpressions: {
      updated_by: '(select p.id from profiles p where p.couple_id="live_draw_sessions"."couple_id" order by p.created_at,p.id limit 1)',
    },
  },
  { name: 'catchup_reminder_tracking', key: ['user_id'] },
  {
    name: 'audit_logs', key: ['id'],
    sourceExpressions: {
      actor_user_id: '"audit_logs"."admin_user_id"',
      admin_user_id: '(select au.id from admin_users au where au.user_id="audit_logs"."admin_user_id" limit 1)',
    },
  },
];

const quote = (value: string) => `"${value.replaceAll('"', '""')}"`;
async function columns(pool: Pool | PoolClient, table: string): Promise<string[]> {
  const result = await pool.query<{ column_name: string }>(`select column_name from information_schema.columns where table_schema=current_schema() and table_name=$1 order by ordinal_position`, [table]);
  return result.rows.map((row) => row.column_name);
}
async function jsonColumns(pool: Pool | PoolClient, table: string): Promise<Set<string>> {
  const result = await pool.query<{ column_name: string }>(`select column_name from information_schema.columns where table_schema=current_schema() and table_name=$1 and data_type in ('json','jsonb')`, [table]);
  return new Set(result.rows.map((row) => row.column_name));
}
async function count(pool: Pool | PoolClient, table: string): Promise<number> {
  return Number((await pool.query<{ count: string }>(`select count(*) count from ${quote(table)}`)).rows[0]?.count ?? 0);
}

async function upsertRows(client: PoolClient, spec: TableSpec, names: string[], rows: Record<string, unknown>[], jsonNames: Set<string>, finalSync: boolean): Promise<number> {
  if (spec.preserveExistingOnInitial && !finalSync && await count(client, spec.name)) return 0;
  if (spec.replace && finalSync) await client.query(`delete from ${quote(spec.name)}`);
  if (!rows.length) return 0;
  const deferred = new Set(spec.deferredColumns ?? []);
  const immediateNames = names.filter((name) => !deferred.has(name));
  const update = immediateNames.filter((name) => !spec.key.includes(name));
  const conflict = spec.key.map(quote).join(',');
  const freshness = spec.preserveNewer && names.includes('updated_at')
    ? ` where ${quote(spec.name)}.${quote('updated_at')} is null or (excluded.${quote('updated_at')} is not null and excluded.${quote('updated_at')}>${quote(spec.name)}.${quote('updated_at')})`
    : '';
  const action = update.length ? `do update set ${update.map((name) => `${quote(name)}=excluded.${quote(name)}`).join(',')}${freshness}` : 'do nothing';
  for (const row of rows) {
    await client.query(
      `insert into ${quote(spec.name)} (${immediateNames.map(quote).join(',')}) values (${immediateNames.map((_, index) => `$${index + 1}`).join(',')}) on conflict (${conflict}) ${action}`,
      immediateNames.map((name) => jsonNames.has(name) && row[name] !== null ? JSON.stringify(row[name]) : row[name]),
    );
  }
  if (deferred.size) {
    const deferredNames = names.filter((name) => deferred.has(name));
    for (const row of rows) {
      const values = deferredNames.map((name) => jsonNames.has(name) && row[name] !== null ? JSON.stringify(row[name]) : row[name]);
      const whereValues = spec.key.map((name) => row[name]);
      await client.query(
        `update ${quote(spec.name)} set ${deferredNames.map((name, index) => `${quote(name)}=$${index + 1}`).join(',')} where ${spec.key.map((name, index) => `${quote(name)}=$${deferredNames.length + index + 1}`).join(' and ')}`,
        [...values, ...whereValues],
      );
    }
  }
  return rows.length;
}

async function pruneRows(client: PoolClient, spec: TableSpec, sourceRows: Record<string, unknown>[]): Promise<number> {
  if (spec.replace || !spec.key.length) return 0;
  const before = await count(client, spec.name);
  if (!sourceRows.length) await client.query(`delete from ${quote(spec.name)}`);
  else {
    const values: unknown[] = [];
    const tuples = sourceRows.map((row) => `(${spec.key.map((key) => { values.push(row[key]); return `$${values.length}`; }).join(',')})`).join(',');
    const keyTuple = `(${spec.key.map(quote).join(',')})`;
    await client.query(`delete from ${quote(spec.name)} where ${keyTuple} not in (${tuples})`, values);
  }
  return before - await count(client, spec.name);
}

export async function migrateDatabase(source: Pool, target: Pool, options: DatabaseMigrationOptions): Promise<TableResult[]> {
  const results: TableResult[] = [];
  for (const spec of TABLES) {
    const [sourceColumns, targetColumns, targetJsonColumns] = await Promise.all([columns(source, spec.name), columns(target, spec.name), jsonColumns(target, spec.name)]);
    if (!sourceColumns.length || !targetColumns.length) {
      results.push({ table: spec.name, sourceRows: 0, targetRows: targetColumns.length ? await count(target, spec.name) : 0, importedRows: 0, prunedRows: 0, status: 'skipped', note: !sourceColumns.length ? 'source table absent' : 'target table absent' });
      continue;
    }
    const sourceName = (targetName: string) => spec.columnMap?.[targetName] ?? targetName;
    const common = targetColumns.filter((name) => sourceColumns.includes(sourceName(name)) || Boolean(spec.sourceExpressions?.[name]));
    const consumedSourceColumns = new Set(common.map(sourceName).filter((name) => sourceColumns.includes(name)));
    const sourceOnly = sourceColumns.filter((name) => !consumedSourceColumns.has(name));
    if (!spec.key.every((key) => common.includes(key))) throw new Error(`${spec.name} is missing required migration key columns`);
    const selections = common.map((targetName) => {
      const expression = spec.sourceExpressions?.[targetName] ?? quote(sourceName(targetName));
      return sourceName(targetName) === targetName && !spec.sourceExpressions?.[targetName]
        ? expression
        : `${expression} as ${quote(targetName)}`;
    });
    const sourceRows = (await source.query<Record<string, unknown>>(`select ${selections.join(',')} from ${quote(spec.name)}`)).rows;
    let importedRows = 0; let prunedRows = 0; let reconciledProfileCouples = 0;
    const skip = !options.finalSync && options.checkpoint.completedTables.includes(spec.name);
    if (!options.dryRun && !skip) {
      const client = await target.connect();
      try {
        await client.query('begin');
        // Historical imports must not enqueue user notifications, classification,
        // Discord events, or other operational side effects.
        await client.query("set local sauci.suppress_operations = 'on'");
        importedRows = await upsertRows(client, spec, common, sourceRows, targetJsonColumns, options.finalSync);
        if (spec.name === 'profiles' && !options.finalSync) {
          for (const row of sourceRows) {
            if (!row.couple_id) continue;
            const reconciled = await client.query(
              `update profiles p set couple_id=$2
                where p.id=$1 and p.couple_id is distinct from $2
                  and (select count(*) from profiles member where member.couple_id=p.couple_id)<=1`,
              [row.id, row.couple_id],
            );
            reconciledProfileCouples += reconciled.rowCount ?? 0;
          }
        }
        if (options.finalSync && options.prune) prunedRows = await pruneRows(client, spec, sourceRows);
        await client.query('commit');
      } catch (error) { await client.query('rollback'); throw error; } finally { client.release(); }
      options.checkpoint.completedTables = [...new Set([...options.checkpoint.completedTables, spec.name])];
      await options.saveCheckpoint?.(options.checkpoint);
    }
    const targetRows = await count(target, spec.name);
    const targetKeys = targetColumns.length
      ? (await target.query<Record<string, unknown>>(`select ${spec.key.map(quote).join(',')} from ${quote(spec.name)}`)).rows
      : [];
    const keyValue = (row: Record<string, unknown>) => JSON.stringify(spec.key.map((key) => row[key]));
    const targetKeySet = new Set(targetKeys.map(keyValue));
    const coveredSourceRows = sourceRows.filter((row) => targetKeySet.has(keyValue(row))).length;
    const preservedSingleton = Boolean(spec.preserveExistingOnInitial && !options.finalSync && targetRows && !coveredSourceRows);
    const parity = options.finalSync ? sourceRows.length === targetRows : preservedSingleton || coveredSourceRows === sourceRows.length;
    const preservedTargetRows = Math.max(0, targetRows - coveredSourceRows);
    const notes = [
      skip ? 'resumed from checkpoint' : '',
      preservedSingleton ? 'kept existing live target singleton during initial merge' : '',
      reconciledProfileCouples ? `restored ${reconciledProfileCouples} established couple membership(s) over one-person target couples` : '',
      !options.finalSync && preservedTargetRows ? `preserved ${preservedTargetRows} target-only row(s)` : '',
      sourceOnly.length ? `legacy-only columns intentionally omitted: ${sourceOnly.join(', ')}` : '',
    ].filter(Boolean);
    results.push({ table: spec.name, sourceRows: sourceRows.length, targetRows, importedRows, prunedRows, status: parity ? 'equal' : 'different', ...(notes.length ? { note: notes.join('; ') } : {}) });
  }
  return results;
}

export async function relationalParity(target: Pool): Promise<Record<string, number>> {
  const checks: Record<string, string> = {
    profiles_without_couple: 'select count(*) count from profiles p left join couples c on c.id=p.couple_id where p.couple_id is not null and c.id is null',
    responses_with_missing_owner: 'select count(*) count from responses r left join profiles p on p.id=r.user_id left join couples c on c.id=r.couple_id left join questions q on q.id=r.question_id where p.id is null or c.id is null or q.id is null',
    matches_with_missing_relation: 'select count(*) count from matches m left join couples c on c.id=m.couple_id left join questions q on q.id=m.question_id where c.id is null or q.id is null',
    messages_with_missing_relation: 'select count(*) count from messages m left join matches x on x.id=m.match_id left join profiles p on p.id=m.user_id where x.id is null or p.id is null',
    couple_mismatch_responses: 'select count(*) count from responses r join profiles p on p.id=r.user_id where p.couple_id is distinct from r.couple_id',
  };
  const result: Record<string, number> = {};
  for (const [name, sql] of Object.entries(checks)) result[name] = Number((await target.query<{ count: string }>(sql)).rows[0]?.count ?? 0);
  return result;
}
