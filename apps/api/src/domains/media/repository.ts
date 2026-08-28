import { randomUUID } from 'node:crypto';
import { Pool, type PoolClient, type QueryResultRow } from 'pg';
import type { MediaKind, MediaObject, MediaUploadContext } from './types.js';

interface MediaRow extends QueryResultRow {
  id: string; owner_id: string; couple_id: string | null; kind: MediaKind;
  storage_key: string; mime_type: string; byte_size: number; question_id: string | null;
  match_id: string | null; expires_at: Date | null; deleted_at: Date | null;
}

export class MediaError extends Error {
  constructor(readonly code: string, message: string, readonly status: 400 | 403 | 404 | 409) { super(message); }
}

export interface MediaRepository {
  create(userId: string, kind: MediaKind, storageKey: string, mimeType: string, byteSize: number, context: MediaUploadContext): Promise<{ media: MediaObject; message?: Record<string, unknown> }>;
  accessible(userId: string, mediaId: string): Promise<MediaObject>;
  byId(mediaId: string): Promise<MediaObject | null>;
  queuedDeletions(limit: number): Promise<string[]>;
  acknowledgeDeletion(storageKey: string): Promise<void>;
  close(): Promise<void>;
}

const columns = 'id, owner_id, couple_id, kind, storage_key, mime_type, byte_size, question_id, match_id, expires_at, deleted_at';
function object(row: MediaRow): MediaObject {
  return { ...row, expires_at: row.expires_at?.toISOString() ?? null };
}

export class PostgresMediaRepository implements MediaRepository {
  private readonly pool: Pool;
  constructor(databaseUrl: string) { this.pool = new Pool({ connectionString: databaseUrl }); }

  async create(userId: string, kind: MediaKind, storageKey: string, mimeType: string, byteSize: number, context: MediaUploadContext) {
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      const profile = await client.query<{ couple_id: string | null }>('select couple_id from profiles where id=$1 for update', [userId]);
      if (!profile.rows[0]) throw new MediaError('profile_not_found', 'Profile not found', 404);
      const coupleId = profile.rows[0].couple_id;
      if ((kind === 'response' || kind === 'chat') && !coupleId) throw new MediaError('couple_required', 'Join a couple before sharing media', 409);
      if (kind === 'response') {
        if (!context.questionId) throw new MediaError('question_required', 'A question ID is required', 400);
        const question = await client.query('select 1 from questions where id=$1 and deleted_at is null', [context.questionId]);
        if (!question.rowCount) throw new MediaError('question_not_found', 'Question not found', 404);
      }
      if (kind === 'chat') {
        if (!context.matchId) throw new MediaError('match_required', 'A match ID is required', 400);
        const match = await client.query('select 1 from matches where id=$1 and couple_id=$2', [context.matchId, coupleId]);
        if (!match.rowCount) throw new MediaError('match_not_found', 'Match not found', 404);
      }
      const id = randomUUID();
      const inserted = await client.query<MediaRow>(
        `insert into media_objects(id,owner_id,couple_id,kind,storage_key,mime_type,byte_size,question_id,match_id)
         values($1,$2,$3,$4,$5,$6,$7,$8,$9) returning ${columns}`,
        [id, userId, coupleId, kind, storageKey, mimeType, byteSize, context.questionId ?? null, context.matchId ?? null],
      );
      let message: Record<string, unknown> | undefined;
      if (kind === 'chat') {
        const mediaType = mimeType.startsWith('video/') ? 'video' : 'image';
        const result = await client.query<Record<string, unknown> & QueryResultRow>(
          `insert into messages(match_id,user_id,content,media_path,media_type,media_expired,version)
           values($1,$2,$3,$4,$5,false,1) returning *`,
          [context.matchId, userId, mediaType === 'video' ? 'Sent a video' : 'Sent an image', `media:${id}`, mediaType],
        );
        message = result.rows[0];
      }
      if (kind === 'avatar') {
        await client.query('update profiles set avatar_url=$2, updated_at=now() where id=$1', [userId, `media:${id}`]);
        await client.query(`delete from media_objects where owner_id=$1 and kind='avatar' and id<>$2`, [userId, id]);
      }
      await client.query('commit');
      return { media: object(inserted.rows[0]!), message };
    } catch (cause) {
      await client.query('rollback');
      throw cause;
    } finally { client.release(); }
  }

  async accessible(userId: string, mediaId: string): Promise<MediaObject> {
    const result = await this.pool.query<MediaRow>(
      `select mo.${columns.split(', ').join(', mo.')}
         from media_objects mo join profiles viewer on viewer.id=$1
        where mo.id=$2 and mo.deleted_at is null and (mo.expires_at is null or mo.expires_at>now())
          and not exists(select 1 from messages m where m.media_path='media:'||mo.id::text and (m.media_expired or m.media_expires_at<=now()))
          and (mo.owner_id=$1 or (mo.kind in ('avatar','response','chat') and mo.couple_id is not null and mo.couple_id=viewer.couple_id))`,
      [userId, mediaId],
    );
    if (!result.rows[0]) throw new MediaError('media_not_found', 'Media not found', 404);
    return object(result.rows[0]);
  }

  async byId(mediaId: string): Promise<MediaObject | null> {
    const result = await this.pool.query<MediaRow>(`select ${columns} from media_objects mo where id=$1 and deleted_at is null and (expires_at is null or expires_at>now())
      and not exists(select 1 from messages m where m.media_path='media:'||mo.id::text and (m.media_expired or m.media_expires_at<=now()))`, [mediaId]);
    return result.rows[0] ? object(result.rows[0]) : null;
  }
  async queuedDeletions(limit: number): Promise<string[]> {
    await this.pool.query(`delete from media_objects where expires_at<=now()`);
    const result=await this.pool.query<{storage_key:string}>('select storage_key from media_deletion_queue order by queued_at limit $1',[limit]);
    return result.rows.map(row=>row.storage_key);
  }
  async acknowledgeDeletion(storageKey: string): Promise<void> {
    await this.pool.query('delete from media_deletion_queue where storage_key=$1',[storageKey]);
  }
  async close() { await this.pool.end(); }
}
