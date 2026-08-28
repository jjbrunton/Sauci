import { Pool, type QueryResultRow } from 'pg';

export type ChatMediaType = 'image' | 'video' | null;
export type ReportReason = 'harassment' | 'spam' | 'inappropriate_content' | 'other';

export interface ChatMessage {
  id: string;
  match_id: string;
  user_id: string;
  content: string | null;
  created_at: string;
  read_at: string | null;
  delivered_at: string | null;
  deleted_at: string | null;
  media_path: string | null;
  media_type: ChatMediaType;
  media_expires_at: string | null;
  media_expired: boolean;
  media_viewed_at: string | null;
  version: number;
  encrypted_content: string | null;
  encryption_iv: string | null;
  keys_metadata: Record<string, unknown> | null;
  moderation_status: string | null;
  flag_reason: string | null;
  category: string | null;
}

interface MessageRecord extends QueryResultRow, Omit<ChatMessage, 'created_at' | 'read_at' | 'delivered_at' | 'deleted_at' | 'media_expires_at' | 'media_viewed_at'> {
  created_at: Date;
  read_at: Date | null;
  delivered_at: Date | null;
  deleted_at: Date | null;
  media_expires_at: Date | null;
  media_viewed_at: Date | null;
}

export class ChatError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: 400 | 403 | 404 | 409,
  ) {
    super(message);
  }
}

export interface ChatRepository {
  listMessages(userId: string, matchId: string): Promise<ChatMessage[]>;
  sendText(userId: string, matchId: string, content: string): Promise<ChatMessage>;
  unreadCounts(userId: string): Promise<{ total: number; by_match: Record<string, number> }>;
  markMatchRead(userId: string, matchId: string): Promise<{ updated: number; read_at: string }>;
  markDelivered(userId: string, messageId: string): Promise<ChatMessage>;
  deleteForSelf(userId: string, messageId: string): Promise<void>;
  deleteForEveryone(userId: string, messageId: string): Promise<ChatMessage>;
  report(userId: string, messageId: string, reason: ReportReason): Promise<void>;
  setTyping(userId: string, matchId: string, ttlMs: number): Promise<void>;
  getPartnerTyping(userId: string, matchId: string): Promise<{ typing: boolean; expires_at: string | null }>;
  close(): Promise<void>;
}

const columns = `m.id, m.match_id, m.user_id, m.content, m.created_at, m.read_at,
  m.delivered_at, m.deleted_at, m.media_path, m.media_type, m.media_expires_at,
  m.media_expired, m.media_viewed_at, m.version, m.encrypted_content,
  m.encryption_iv, m.keys_metadata, m.moderation_status, m.flag_reason, m.category`;

function iso(value: Date | null): string | null {
  return value?.toISOString() ?? null;
}

function toMessage(row: MessageRecord): ChatMessage {
  return {
    ...row,
    created_at: row.created_at.toISOString(),
    read_at: iso(row.read_at),
    delivered_at: iso(row.delivered_at),
    deleted_at: iso(row.deleted_at),
    media_expires_at: iso(row.media_expires_at),
    media_viewed_at: iso(row.media_viewed_at),
  };
}

export class PostgresChatRepository implements ChatRepository {
  private readonly pool: Pool;

  constructor(databaseUrl: string) {
    this.pool = new Pool({ connectionString: databaseUrl });
  }

  private async assertMatchAccess(userId: string, matchId: string): Promise<void> {
    const result = await this.pool.query(
      `select 1
         from profiles p
         join matches ma on ma.couple_id = p.couple_id
        where p.id = $1 and ma.id = $2`,
      [userId, matchId],
    );
    if (!result.rowCount) throw new ChatError('match_not_found', 'Match not found', 404);
  }

  private async accessibleMessage(userId: string, messageId: string): Promise<MessageRecord> {
    const result = await this.pool.query<MessageRecord>(
      `select ${columns}
         from messages m
         join matches ma on ma.id = m.match_id
         join profiles p on p.couple_id = ma.couple_id
        where p.id = $1 and m.id = $2`,
      [userId, messageId],
    );
    const row = result.rows[0];
    if (!row) throw new ChatError('message_not_found', 'Message not found', 404);
    return row;
  }

  async listMessages(userId: string, matchId: string): Promise<ChatMessage[]> {
    await this.assertMatchAccess(userId, matchId);
    const result = await this.pool.query<MessageRecord>(
      `select ${columns}
         from messages m
        where m.match_id = $1
          and not exists (
            select 1 from message_deletions d where d.message_id = m.id and d.user_id = $2
          )
        order by m.created_at desc, m.id desc
        limit 500`,
      [matchId, userId],
    );
    return result.rows.map(toMessage);
  }

  async sendText(userId: string, matchId: string, content: string): Promise<ChatMessage> {
    await this.assertMatchAccess(userId, matchId);
    const result = await this.pool.query<MessageRecord>(
      `insert into messages (match_id, user_id, content, version)
       values ($1, $2, $3, 1)
       returning id, match_id, user_id, content, created_at, read_at, delivered_at,
         deleted_at, media_path, media_type, media_expires_at, media_expired,
         media_viewed_at, version, encrypted_content, encryption_iv, keys_metadata,
         moderation_status, flag_reason, category`,
      [matchId, userId, content],
    );
    return toMessage(result.rows[0]!);
  }

  async unreadCounts(userId: string): Promise<{ total: number; by_match: Record<string, number> }> {
    const result = await this.pool.query<{ match_id: string; count: string }>(
      `select m.match_id, count(*)::text as count
         from messages m
         join matches ma on ma.id = m.match_id
         join profiles p on p.couple_id = ma.couple_id
        where p.id = $1 and m.user_id <> $1 and m.read_at is null
          and m.deleted_at is null
          and not exists (
            select 1 from message_deletions d where d.message_id = m.id and d.user_id = $1
          )
        group by m.match_id`,
      [userId],
    );
    const by_match = Object.fromEntries(result.rows.map((row) => [row.match_id, Number(row.count)]));
    return { total: Object.values(by_match).reduce((sum, count) => sum + count, 0), by_match };
  }

  async markMatchRead(userId: string, matchId: string): Promise<{ updated: number; read_at: string }> {
    await this.assertMatchAccess(userId, matchId);
    const readAt = new Date();
    const result = await this.pool.query(
      `update messages
          set delivered_at = coalesce(delivered_at, $3), read_at = $3
        where match_id = $1 and user_id <> $2 and read_at is null`,
      [matchId, userId, readAt],
    );
    return { updated: result.rowCount ?? 0, read_at: readAt.toISOString() };
  }

  async markDelivered(userId: string, messageId: string): Promise<ChatMessage> {
    const message = await this.accessibleMessage(userId, messageId);
    if (message.user_id === userId) throw new ChatError('invalid_recipient', 'Senders cannot mark their own message delivered', 403);
    const result = await this.pool.query<MessageRecord>(
      `update messages m set delivered_at = coalesce(m.delivered_at, now()) where m.id = $1 returning ${columns}`,
      [messageId],
    );
    return toMessage(result.rows[0]!);
  }

  async deleteForSelf(userId: string, messageId: string): Promise<void> {
    await this.accessibleMessage(userId, messageId);
    await this.pool.query(
      `insert into message_deletions (message_id, user_id) values ($1, $2) on conflict do nothing`,
      [messageId, userId],
    );
  }

  async deleteForEveryone(userId: string, messageId: string): Promise<ChatMessage> {
    const message = await this.accessibleMessage(userId, messageId);
    if (message.user_id !== userId) throw new ChatError('not_message_author', 'Only the sender can delete a message for everyone', 403);
    const result = await this.pool.query<MessageRecord>(
      `update messages m set deleted_at = coalesce(m.deleted_at, now()) where m.id = $1 returning ${columns}`,
      [messageId],
    );
    return toMessage(result.rows[0]!);
  }

  async report(userId: string, messageId: string, reason: ReportReason): Promise<void> {
    const message = await this.accessibleMessage(userId, messageId);
    if (message.user_id === userId) throw new ChatError('cannot_report_own_message', 'You cannot report your own message', 403);
    try {
      await this.pool.query(
        `insert into message_reports (message_id, reporter_id, reason) values ($1, $2, $3)`,
        [messageId, userId, reason],
      );
    } catch (cause) {
      if (typeof cause === 'object' && cause !== null && 'code' in cause && cause.code === '23505') {
        throw new ChatError('already_reported', 'You have already reported this message', 409);
      }
      throw cause;
    }
  }

  async setTyping(userId: string, matchId: string, ttlMs: number): Promise<void> {
    await this.assertMatchAccess(userId, matchId);
    await this.pool.query(
      `insert into chat_typing_states (match_id, user_id, expires_at)
       values ($1, $2, now() + ($3 * interval '1 millisecond'))
       on conflict (match_id, user_id) do update set expires_at = excluded.expires_at`,
      [matchId, userId, ttlMs],
    );
  }

  async getPartnerTyping(userId: string, matchId: string): Promise<{ typing: boolean; expires_at: string | null }> {
    await this.assertMatchAccess(userId, matchId);
    const result = await this.pool.query<{ expires_at: Date }>(
      `select expires_at from chat_typing_states
        where match_id = $1 and user_id <> $2 and expires_at > now()
        order by expires_at desc limit 1`,
      [matchId, userId],
    );
    const expiresAt = result.rows[0]?.expires_at ?? null;
    return { typing: Boolean(expiresAt), expires_at: iso(expiresAt) };
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

