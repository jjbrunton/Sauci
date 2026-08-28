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
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
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

async function mediaRelation(target: Pool, object: StorageObject, key: string) {
  const first = object.name.split('/')[0];
  const owner = object.owner_id && uuidPattern.test(object.owner_id) ? object.owner_id : (uuidPattern.test(first) && object.bucket_id !== 'chat-media' ? first : null);
  if (!owner) throw new Error(`Cannot determine owner for ${key}`);
  const profile = await target.query<{ couple_id: string | null }>('select couple_id from profiles where id=$1', [owner]);
  if (!profile.rows[0]) throw new Error(`Storage owner does not exist in target for ${key}`);
  let matchId: string | null = null; let questionId: string | null = null;
  if (object.bucket_id === 'chat-media' && uuidPattern.test(first)) matchId = first;
  if (object.bucket_id === 'response-media') {
    const candidate = object.name.split('/').at(-1)?.split('_')[0] ?? '';
    if (uuidPattern.test(candidate)) questionId = candidate;
  }
  return { ownerId: owner, coupleId: profile.rows[0].couple_id, matchId, questionId };
}

async function rewriteLegacyReference(target: Pool, object: StorageObject): Promise<void> {
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
    await target.query(`update feedback set screenshot_url=$1 where ${matchesLegacy('screenshot_url')}`, [reference, legacyName, legacyKey]);
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
  const result: StorageResult = { sourceFiles: objects.rowCount ?? objects.rows.length, targetFiles: 0, copiedFiles: 0, skippedFiles: 0, prunedFiles: 0, failedFiles: 0, sourceBytes: 0, copiedBytes: 0, missingOnDisk: [], failures: [] };
  const sourceKeys = new Set<string>();
  for (const object of objects.rows) {
    const key = safeStorageKey(object.bucket_id, object.name); const expectedSize = metadataSize(object.metadata); result.sourceBytes += expectedSize;
    sourceKeys.add(key);
    const updatedAt = object.updated_at ? new Date(object.updated_at).toISOString() : null;
    const marker = options.checkpoint.storage[key];
    if (marker && marker.updatedAt === updatedAt && (!expectedSize || marker.byteSize === expectedSize)) {
      if (options.dryRun) { result.skippedFiles += 1; continue; }
      const registered = await target.query('select 1 from media_objects where id=$1 and storage_key=$2 and byte_size=$3', [object.id, key, marker.byteSize]);
      try {
        if (registered.rowCount && (await stat(destination(options.mediaRoot, key))).size === marker.byteSize) {
          await rewriteLegacyReference(target, object);
          result.skippedFiles += 1;
          continue;
        }
      } catch { /* checkpoint is incomplete; recopy below */ }
    }
    if (options.dryRun) continue;
    try {
      const bytes = await options.download(object.bucket_id, object.name);
      if (expectedSize && bytes.byteLength !== expectedSize) throw new Error(`Size mismatch for ${key}: expected ${expectedSize}, received ${bytes.byteLength}`);
      const relation = await mediaRelation(target, object, key);
      const path = destination(options.mediaRoot, key); await mkdir(dirname(path), { recursive: true });
      const temporary = `${path}.${process.pid}.tmp`; await writeFile(temporary, bytes, { mode: 0o600 }); await rename(temporary, path);
      const mime = metadataString(object.metadata, 'mimetype', 'contentType') ?? 'application/octet-stream';
      await target.query(`insert into media_objects(id,owner_id,couple_id,kind,storage_key,mime_type,byte_size,question_id,match_id,created_at)
        values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) on conflict(id) do update set owner_id=excluded.owner_id,couple_id=excluded.couple_id,kind=excluded.kind,storage_key=excluded.storage_key,mime_type=excluded.mime_type,byte_size=excluded.byte_size,question_id=excluded.question_id,match_id=excluded.match_id,created_at=excluded.created_at`,
      [object.id, relation.ownerId, relation.coupleId, BUCKET_KIND[object.bucket_id], key, mime, bytes.byteLength, relation.questionId, relation.matchId, object.created_at]);
      await rewriteLegacyReference(target, object);
      options.checkpoint.storage[key] = { updatedAt, byteSize: bytes.byteLength };
      await options.saveCheckpoint?.(options.checkpoint); result.copiedFiles += 1; result.copiedBytes += bytes.byteLength;
    } catch (error) {
      result.failedFiles += 1;
      result.failures.push({ storageKey: key, error: error instanceof Error ? error.message : 'Unknown storage migration failure' });
    }
  }
  if (!options.dryRun) {
    if (options.prune) {
      const existing = await target.query<{ id: string; storage_key: string }>("select id,storage_key from media_objects where kind=any($1::text[])", [Object.values(BUCKET_KIND)]);
      for (const row of existing.rows) if (!sourceKeys.has(row.storage_key)) {
        await rm(destination(options.mediaRoot, row.storage_key), { force: true });
        await target.query('delete from media_objects where id=$1', [row.id]);
        delete options.checkpoint.storage[row.storage_key]; result.prunedFiles += 1;
      }
      await options.saveCheckpoint?.(options.checkpoint);
    }
    const registered = await target.query<{ storage_key: string; byte_size: number }>("select storage_key,byte_size from media_objects where deleted_at is null and kind=any($1::text[])", [Object.values(BUCKET_KIND)]);
    result.targetFiles = registered.rows.length;
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
