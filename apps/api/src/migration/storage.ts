import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import { createHash } from 'node:crypto';
import type { Pool } from 'pg';
import type { StorageMigrationOptions, StorageResult } from './types.js';

interface StorageObject {
  id: string;
  bucket_id: string;
  name: string;
  owner_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string | null;
}
const BUCKET_KIND: Record<string, 'avatar' | 'response' | 'chat' | 'feedback'> = {
  avatars: 'avatar', 'response-media': 'response', 'chat-media': 'chat', 'feedback-screenshots': 'feedback',
};
// PostgreSQL's uuid type accepts legacy UUID-shaped identifiers whose version
// nibble is not RFC 4122 (the production fixture profile uses version 0).
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const quote = (value: string) => `"${value.replaceAll('"', '""')}"`;

function safeStorageKey(bucket: string, name: string): string {
  const normalized = `${bucket}/${name}`.replaceAll('\\', '/');
  if (!BUCKET_KIND[bucket] || normalized.startsWith('/') || normalized.split('/').some((part) => !part || part === '.' || part === '..')) throw new Error(`Unsafe storage object path: ${bucket}/${name}`);
  return normalized;
}
function destination(rootValue: string, key: string): string {
  const root = resolve(rootValue); const path = resolve(root, key);
  if (!path.startsWith(`${root}${sep}`)) throw new Error(`Storage path escapes MEDIA_ROOT: ${key}`);
  return path;
}
function metadataString(metadata: Record<string, unknown> | null, ...keys: string[]): string | null {
  for (const key of keys) if (typeof metadata?.[key] === 'string') return metadata[key] as string;
  return null;
}
function metadataSize(metadata: Record<string, unknown> | null): number {
  const value = metadata?.size ?? metadata?.contentLength;
  return typeof value === 'number' && value >= 0 ? value : Number(value ?? 0) || 0;
}

export function createSupabaseDownloader(baseUrl: string, serviceRoleKey: string): (bucket: string, name: string) => Promise<Uint8Array> {
  const base = baseUrl.replace(/\/$/, '');
  if (!/^https:\/\//.test(base) && !/^http:\/\/(localhost|127\.0\.0\.1)(:|\/)/.test(base)) throw new Error('SOURCE_STORAGE_URL must use HTTPS unless it is localhost');
  if (!serviceRoleKey) throw new Error('SOURCE_STORAGE_SERVICE_ROLE_KEY is required for storage copy');
  return async (bucket, name) => {
    const path = [bucket, ...name.split('/')].map(encodeURIComponent).join('/');
    const response = await fetch(`${base}/storage/v1/object/authenticated/${path}`, { headers: { authorization: `Bearer ${serviceRoleKey}`, apikey: serviceRoleKey } });
    if (!response.ok) throw new Error(`Storage download failed for ${bucket}/${name}: HTTP ${response.status}`);
    return new Uint8Array(await response.arrayBuffer());
  };
}

const legacyPredicate = (column: string) => `(
  ${column}=$1 or ${column}=$2 or
  (right(${column},length($1))=$1 and position('/'||$3||'/' in ${column})>0)
)`;

async function sourceReference(source: Pool, object: StorageObject) {
  const values = [object.name, `${object.bucket_id}/${object.name}`, object.bucket_id];
  if (object.bucket_id === 'avatars') {
    return (await source.query<{ owner_id: string; match_id: null; question_id: null }>(
      `select id owner_id,null::uuid match_id,null::uuid question_id from profiles where ${legacyPredicate('avatar_url')} limit 1`, values,
    )).rows[0] ?? null;
  }
  if (object.bucket_id === 'chat-media') {
    return (await source.query<{ owner_id: string; match_id: string; question_id: null }>(
      `select user_id owner_id,match_id,null::uuid question_id from messages where ${legacyPredicate('media_path')} limit 1`, values,
    )).rows[0] ?? null;
  }
  if (object.bucket_id === 'feedback-screenshots') {
    return (await source.query<{ owner_id: string; match_id: null; question_id: null }>(
      `select user_id owner_id,null::uuid match_id,null::uuid question_id from feedback where ${legacyPredicate('screenshot_url')} limit 1`, values,
    )).rows[0] ?? null;
  }
  return (await source.query<{ owner_id: string; match_id: null; question_id: string }>(
    `select user_id owner_id,null::uuid match_id,question_id from responses
      where response_data is not null and ${legacyPredicate("response_data->>'media_path'")} limit 1`, values,
  )).rows[0] ?? null;
}

async function mediaRelation(source: Pool, target: Pool, object: StorageObject) {
  const first = object.name.split('/')[0];
  const reference = await sourceReference(source, object);
  const ownerCandidates = [object.owner_id, reference?.owner_id, object.bucket_id === 'chat-media' ? null : first]
    .filter((value): value is string => Boolean(value && uuidPattern.test(value)));
  let ownerId: string | null = null; let coupleId: string | null = null;
  for (const candidate of ownerCandidates) {
    const profile = await target.query<{ couple_id: string | null }>('select couple_id from profiles where id=$1', [candidate]);
    if (profile.rows[0]) { ownerId = candidate; coupleId = profile.rows[0].couple_id; break; }
  }
  let matchId = reference?.match_id && uuidPattern.test(reference.match_id) ? reference.match_id : null;
  if (!matchId && object.bucket_id === 'chat-media' && uuidPattern.test(first)) matchId = first;
  if (matchId && !(await target.query('select 1 from matches where id=$1', [matchId])).rowCount) matchId = null;
  let questionId = reference?.question_id && uuidPattern.test(reference.question_id) ? reference.question_id : null;
  if (object.bucket_id === 'response-media') {
    const candidate = object.name.split('/').at(-1)?.split('_')[0] ?? '';
    if (!questionId && uuidPattern.test(candidate)) questionId = candidate;
  }
  if (questionId && !(await target.query('select 1 from questions where id=$1', [questionId])).rowCount) questionId = null;
  return { ownerId, coupleId, matchId, questionId };
}

async function rewriteLegacyReference(source: Pool, target: Pool, object: StorageObject): Promise<void> {
  const reference = `media:${object.id}`;
  const legacyName = object.name;
  const legacyKey = `${object.bucket_id}/${legacyName}`;
  const matchesLegacy = (column: string) => `(
    ${column}=$2 or ${column}=$3 or
    (right(${column},length($2))=$2 and position('/${object.bucket_id}/' in ${column})>0)
  )`;
  if (object.bucket_id === 'avatars') {
    await target.query(`update profiles set avatar_url=$1 where ${matchesLegacy('avatar_url')}`, [reference, legacyName, legacyKey]);
  } else if (object.bucket_id === 'chat-media') {
    await target.query(`update messages set media_path=$1 where ${matchesLegacy('media_path')}`, [reference, legacyName, legacyKey]);
  } else if (object.bucket_id === 'feedback-screenshots') {
    const sourceRows = await source.query<{ id: string }>(
      `select id from feedback where ${legacyPredicate('screenshot_url')}`,
      [legacyName, legacyKey, object.bucket_id],
    );
    if (sourceRows.rows.length) await target.query('update feedback set screenshot_media_id=$1 where id=any($2::uuid[])', [object.id, sourceRows.rows.map((row) => row.id)]);
  } else if (object.bucket_id === 'response-media') {
    await target.query(`
      update responses
         set response_data=jsonb_set(response_data,'{media_path}',to_jsonb($1::text),true)
       where response_data is not null and ${matchesLegacy("response_data->>'media_path'")}
    `, [reference, legacyName, legacyKey]);
  }
}

export async function migrateStorage(source: Pool, target: Pool, options: StorageMigrationOptions): Promise<StorageResult> {
  const schema = options.storageSchema ?? 'storage';
  if (!/^[a-z_][a-z0-9_]*$/i.test(schema)) throw new Error('Invalid storage schema');
  const objects = await source.query<StorageObject>(`select id,bucket_id,name,owner_id,metadata,created_at,updated_at from ${quote(schema)}.objects where bucket_id=any($1::text[]) order by bucket_id,name`, [Object.keys(BUCKET_KIND)]);
  const result: StorageResult = { sourceFiles: objects.rowCount ?? objects.rows.length, targetFiles: 0, preservedTargetFiles: 0, copiedFiles: 0, quarantinedFiles: 0, skippedFiles: 0, prunedFiles: 0, failedFiles: 0, sourceBytes: 0, copiedBytes: 0, missingOnDisk: [], failures: [] };
  const sourceKeys = new Set<string>();
  for (const object of objects.rows) {
    const key = safeStorageKey(object.bucket_id, object.name); const expectedSize = metadataSize(object.metadata); result.sourceBytes += expectedSize;
    sourceKeys.add(key);
    const updatedAt = object.updated_at ? new Date(object.updated_at).toISOString() : null;
    const marker = options.checkpoint.storage[key];
    if (marker && marker.updatedAt === updatedAt && (!expectedSize || marker.byteSize === expectedSize)) {
      if (options.dryRun) { result.skippedFiles += 1; continue; }
      const registered = await target.query(`select 1 from media_objects where id=$1 and storage_key=$2 and byte_size=$3
        union all select 1 from legacy_media_quarantine where id=$1 and original_storage_key=$2 and byte_size=$3`, [object.id, key, marker.byteSize]);
      try {
        if (registered.rowCount && (await stat(destination(options.mediaRoot, key))).size === marker.byteSize) {
          await rewriteLegacyReference(source, target, object);
          result.skippedFiles += 1;
          continue;
        }
      } catch { /* checkpoint is incomplete; recopy below */ }
    }
    if (options.dryRun) continue;
    try {
      const relation = await mediaRelation(source, target, object);
      const bytes = await options.download(object.bucket_id, object.name);
      if (expectedSize && bytes.byteLength !== expectedSize) throw new Error(`Size mismatch for ${key}: expected ${expectedSize}, received ${bytes.byteLength}`);
      const path = destination(options.mediaRoot, key); await mkdir(dirname(path), { recursive: true });
      const temporary = `${path}.${process.pid}.tmp`; await writeFile(temporary, bytes, { mode: 0o600 }); await rename(temporary, path);
      const mime = metadataString(object.metadata, 'mimetype', 'contentType') ?? 'application/octet-stream';
      if (relation.ownerId) {
        await target.query(`insert into media_objects(id,owner_id,couple_id,kind,storage_key,mime_type,byte_size,question_id,match_id,created_at)
          values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) on conflict(id) do update set owner_id=excluded.owner_id,couple_id=excluded.couple_id,kind=excluded.kind,storage_key=excluded.storage_key,mime_type=excluded.mime_type,byte_size=excluded.byte_size,question_id=excluded.question_id,match_id=excluded.match_id,created_at=excluded.created_at`,
        [object.id, relation.ownerId, relation.coupleId, BUCKET_KIND[object.bucket_id], key, mime, bytes.byteLength, relation.questionId, relation.matchId, object.created_at]);
        await target.query('delete from legacy_media_quarantine where id=$1', [object.id]);
        await rewriteLegacyReference(source, target, object);
      } else {
        await target.query(`insert into legacy_media_quarantine(id,original_storage_key,bucket_id,object_name,source_owner_id,metadata,mime_type,byte_size,reason,source_created_at,source_updated_at)
          values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) on conflict(id) do update set original_storage_key=excluded.original_storage_key,bucket_id=excluded.bucket_id,object_name=excluded.object_name,source_owner_id=excluded.source_owner_id,metadata=excluded.metadata,mime_type=excluded.mime_type,byte_size=excluded.byte_size,reason=excluded.reason,source_created_at=excluded.source_created_at,source_updated_at=excluded.source_updated_at`,
        [object.id, key, object.bucket_id, object.name, object.owner_id, object.metadata, mime, bytes.byteLength, 'legacy object has no verifiable owner or live reference', object.created_at, object.updated_at]);
        await target.query('delete from media_objects where id=$1', [object.id]);
        result.quarantinedFiles += 1;
      }
      options.checkpoint.storage[key] = { updatedAt, byteSize: bytes.byteLength };
      await options.saveCheckpoint?.(options.checkpoint); result.copiedFiles += 1; result.copiedBytes += bytes.byteLength;
    } catch (error) {
      result.failedFiles += 1;
      result.failures.push({ storageKey: key, error: error instanceof Error ? error.message : 'Unknown storage migration failure' });
    }
  }
  if (!options.dryRun) {
    if (options.prune) {
      const existing = await target.query<{ id: string; storage_key: string; quarantined: boolean }>(`
        select id,storage_key,false quarantined from media_objects where kind=any($1::text[])
        union all select id,original_storage_key storage_key,true quarantined from legacy_media_quarantine
      `, [Object.values(BUCKET_KIND)]);
      for (const row of existing.rows) if (!sourceKeys.has(row.storage_key)) {
        await rm(destination(options.mediaRoot, row.storage_key), { force: true });
        await target.query(row.quarantined ? 'delete from legacy_media_quarantine where id=$1' : 'delete from media_objects where id=$1', [row.id]);
        delete options.checkpoint.storage[row.storage_key]; result.prunedFiles += 1;
      }
      await options.saveCheckpoint?.(options.checkpoint);
    }
    const registered = await target.query<{ storage_key: string; byte_size: number }>(`select storage_key,byte_size from media_objects where deleted_at is null and kind=any($1::text[])
      union all select original_storage_key storage_key,byte_size from legacy_media_quarantine`, [Object.values(BUCKET_KIND)]);
    result.targetFiles = registered.rows.filter((row) => sourceKeys.has(row.storage_key)).length;
    result.preservedTargetFiles = registered.rows.length - result.targetFiles;
    for (const row of registered.rows) {
      try { if ((await stat(destination(options.mediaRoot, row.storage_key))).size !== row.byte_size) result.missingOnDisk.push(row.storage_key); }
      catch { result.missingOnDisk.push(row.storage_key); }
    }
  }
  return result;
}

export async function fileDigest(path: string): Promise<string> {
  return createHash('sha256').update(await readFile(path)).digest('hex');
}
