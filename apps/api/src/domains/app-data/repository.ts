import { Pool, type QueryResultRow } from 'pg';
import { closeResolvedPool, resolvePool, type DatabaseConnection } from '../../db/pool.js';

export interface PackContext { id: string; name: string; icon: string | null }
export interface AppQuestion {
  id: string; pack_id: string; text: string; partner_text: string | null; intensity: number;
  allowed_couple_genders: string[] | null; target_user_genders: string[] | null;
  question_type: string; config: Record<string, unknown>; created_at: string;
}
export interface MatchContext {
  id: string; question_id: string; couple_id: string; match_type: string; created_at: string;
  response_summary: Record<string, unknown> | null;
  question: { id: string; text: string; partner_text: string | null };
  responses: Array<{ user_id: string; answer: string; created_at: string; profiles: { name: string | null } }>;
}
export interface StrokePoint { x: number; y: number }
export interface StrokeSegment {
  id: string; userId: string; points: StrokePoint[]; color: string; width: number;
  timestamp: number; isEraser: boolean;
}
export interface LiveDrawState { strokes: StrokeSegment[]; revision: number; updated_at: string | null; updated_by: string | null }

/**
 * A change summary rather than a payload. The mobile app used to re-fetch profile,
 * couple, matches, both pending directions and enabled packs every five seconds to
 * notice partner activity; it now compares this summary with the last one it saw and
 * refreshes only the domains whose marker actually moved. Every field is a marker,
 * not display data, so the response stays a few hundred bytes whatever the couple's
 * history looks like.
 */
export interface SyncSummary {
  server_time: string;
  couple_id: string | null;
  profile_updated_at: string | null;
  partner_id: string | null;
  partner_updated_at: string | null;
  /** Matches visible to this member: archiving one of them moves the count. */
  match_count: number;
  new_match_count: number;
  latest_match_at: string | null;
  /** Partner answered, this member has not. */
  pending_yours: number;
  /** This member answered, partner has not. */
  pending_theirs: number;
  unread_total: number;
  /** Digest of the enabled pack ids, so an equal-and-opposite toggle is still a change. */
  enabled_packs_fingerprint: string;
  /**
   * Digest of each visible match's type and response summary. `match_count` /
   * `new_match_count` / `latest_match_at` only move when a match is created,
   * archived or unarchived — not when a partner edits an existing response and
   * changes its `match_type` or `response_summary` — so this fingerprint is
   * what actually notices that edit.
   */
  match_state_fingerprint: string;
  /**
   * Digest of each visible match's unread count. `unread_total` can stay equal
   * while unread messages redistribute between matches (one read, another
   * receives a message), which reorders the unread-first list without moving
   * the total; this fingerprint is what notices that.
   */
  match_unread_fingerprint: string;
  /** couple_streaks.updated_at, so a partner's answer can silently refresh an already-loaded streak. */
  streak_updated_at: string | null;
}

export class AppDataError extends Error {
  constructor(public readonly code: 'not_found' | 'no_couple' | 'not_recipient' | 'rate_limited' | 'revision_conflict', message: string, public readonly status: 403 | 404 | 409 | 429, public readonly details?: Record<string, unknown>) { super(message); }
}

export interface AppDataRepository {
  packContext(userId: string, packId: string): Promise<PackContext>;
  packQuestions(userId: string, packId: string): Promise<AppQuestion[]>;
  packTeaser(userId: string, packId: string): Promise<Array<Pick<AppQuestion, 'id' | 'text' | 'intensity'>>>;
  matchContext(userId: string, matchId: string): Promise<MatchContext>;
  markMediaViewed(userId: string, messageId: string, expiresAt: string | null): Promise<{ media_viewed_at: string; media_expires_at: string | null }>;
  nudgeStatus(userId: string): Promise<{ last_nudge_sent_at: string | null }>;
  sendNudge(userId: string): Promise<{ success: true; notification_sent: boolean; reason?: string; next_nudge_available_at: string }>;
  syncSummary(userId: string): Promise<SyncSummary>;
  getLiveDraw(userId: string): Promise<LiveDrawState>;
  putLiveDraw(userId: string, strokes: StrokeSegment[], baseRevision: number): Promise<LiveDrawState>;
  close(): Promise<void>;
}

interface QuestionRow extends QueryResultRow, Omit<AppQuestion, 'created_at'> { created_at: Date }

interface SyncRow extends QueryResultRow {
  server_time: Date; couple_id: string | null; profile_updated_at: Date | null;
  partner_id: string | null; partner_updated_at: Date | null;
  match_count: number | null; new_match_count: number | null; latest_match_at: Date | null;
  pending_yours: number | null; pending_theirs: number | null; unread_total: number | null;
  enabled_packs_fingerprint: string | null;
  match_state_fingerprint: string | null; match_unread_fingerprint: string | null;
  streak_updated_at: Date | null;
}

function question(row: QuestionRow): AppQuestion { return { ...row, created_at: row.created_at.toISOString() }; }

export class PostgresAppDataRepository implements AppDataRepository {
  private readonly pool: Pool;
  private readonly ownsPool: boolean;
  constructor(connection: DatabaseConnection) { const resolved = resolvePool(connection); this.pool = resolved.pool; this.ownsPool = resolved.owned; }

  private async visiblePack(userId: string, packId: string): Promise<PackContext> {
    const result = await this.pool.query<PackContext>(`
      select qp.id, qp.name, qp.icon
      from question_packs qp
      left join categories c on c.id = qp.category_id
      left join profiles p on p.id = $1
      where qp.id = $2 and qp.is_public = true
        and (qp.category_id is null or c.is_public = true)
        and (qp.is_explicit = false or coalesce(p.hide_nsfw, true) = false)
      limit 1`, [userId, packId]);
    if (!result.rows[0]) throw new AppDataError('not_found', 'Pack not found', 404);
    return result.rows[0];
  }

  async packContext(userId: string, packId: string): Promise<PackContext> { return this.visiblePack(userId, packId); }

  async packQuestions(userId: string, packId: string): Promise<AppQuestion[]> {
    await this.visiblePack(userId, packId);
    const result = await this.pool.query<QuestionRow>(`
      select id, pack_id, text, partner_text, intensity, allowed_couple_genders,
        target_user_genders, question_type, config, created_at
      from questions where pack_id = $1 and deleted_at is null
      order by created_at, id`, [packId]);
    return result.rows.map(question);
  }

  async packTeaser(userId: string, packId: string) {
    await this.visiblePack(userId, packId);
    const result = await this.pool.query<{ id: string; text: string; intensity: number }>(`
      select id, text, intensity from questions
      where pack_id = $1 and deleted_at is null
      order by intensity, md5(id::text || current_date::text) limit 3`, [packId]);
    return result.rows;
  }

  async matchContext(userId: string, matchId: string): Promise<MatchContext> {
    const match = await this.pool.query<{
      id: string; question_id: string; couple_id: string; match_type: string; created_at: Date;
      response_summary: Record<string, unknown> | null; question: MatchContext['question'];
    }>(`select m.id,m.question_id,m.couple_id,m.match_type,m.created_at,m.response_summary,
      json_build_object('id',q.id,'text',q.text,'partner_text',q.partner_text) question
      from matches m join questions q on q.id=m.question_id join profiles p on p.couple_id=m.couple_id
      where p.id=$1 and m.id=$2 limit 1`, [userId, matchId]);
    if (!match.rows[0]) throw new AppDataError('not_found', 'Match not found', 404);
    const responses = await this.pool.query<{
      user_id: string; answer: string; created_at: Date; profiles: { name: string | null };
    }>(`select r.user_id,r.answer,r.created_at,json_build_object('name',p.name) profiles
      from responses r join profiles p on p.id=r.user_id
      where r.question_id=$1 and r.couple_id=$2 order by r.created_at,r.id`, [match.rows[0].question_id, match.rows[0].couple_id]);
    return { ...match.rows[0], created_at: match.rows[0].created_at.toISOString(), responses: responses.rows.map(row => ({ ...row, created_at: row.created_at.toISOString() })) };
  }

  async markMediaViewed(userId: string, messageId: string, expiresAt: string | null) {
    const result = await this.pool.query<{ media_viewed_at: Date; media_expires_at: Date | null }>(`
      update messages m set media_viewed_at=coalesce(media_viewed_at,now()),
        media_expires_at=case when m.media_type='video' then coalesce(media_expires_at,$3::timestamptz) else null end
      from matches ma join profiles p on p.couple_id=ma.couple_id
      where m.match_id=ma.id and p.id=$1 and m.id=$2 and m.user_id<>$1
      returning m.media_viewed_at,m.media_expires_at`, [userId, messageId, expiresAt]);
    if (!result.rows[0]) throw new AppDataError('not_recipient', 'Message not found', 404);
    return { media_viewed_at: result.rows[0].media_viewed_at.toISOString(), media_expires_at: result.rows[0].media_expires_at?.toISOString() ?? null };
  }

  async nudgeStatus(userId: string) {
    const result = await this.pool.query<{ last_nudge_sent_at: Date | null }>('select last_nudge_sent_at from profiles where id=$1', [userId]);
    return { last_nudge_sent_at: result.rows[0]?.last_nudge_sent_at?.toISOString() ?? null };
  }

  async sendNudge(userId: string) {
    const client = await this.pool.connect();
    let senderName: string | null = null; let partnerToken: string | null = null; let nudgesEnabled = true; let nextAvailable = '';
    try {
      await client.query('begin');
      const sender = await client.query<{ name: string | null; couple_id: string | null; last_nudge_sent_at: Date | null }>(
        'select name,couple_id,last_nudge_sent_at from profiles where id=$1 for update', [userId]);
      if (!sender.rows[0]) throw new AppDataError('not_found', 'Profile not found', 404);
      if (!sender.rows[0].couple_id) throw new AppDataError('no_couple', 'Join a couple first', 409);
      const now = new Date(); const last = sender.rows[0].last_nudge_sent_at;
      if (last && now.getTime() - last.getTime() < 12 * 60 * 60 * 1000) {
        const next = new Date(last.getTime() + 12 * 60 * 60 * 1000);
        throw new AppDataError('rate_limited', 'Nudge cooldown is active', 429, {
          cooldown_remaining_seconds: Math.ceil((next.getTime() - now.getTime()) / 1000), next_nudge_available_at: next.toISOString(),
        });
      }
      const partner = await client.query<{ id: string; push_token: string | null; nudges_enabled: boolean | null }>(`
        select p.id,p.push_token,np.nudges_enabled from profiles p
        left join notification_preferences np on np.user_id=p.id
        where p.couple_id=$1 and p.id<>$2 order by p.id limit 1`, [sender.rows[0].couple_id, userId]);
      if (!partner.rows[0]) throw new AppDataError('not_found', 'Partner not found', 404);
      await client.query('update profiles set last_nudge_sent_at=$2 where id=$1', [userId, now]);
      await client.query('commit');
      senderName = sender.rows[0].name; partnerToken = partner.rows[0].push_token; nudgesEnabled = partner.rows[0].nudges_enabled !== false;
      nextAvailable = new Date(now.getTime() + 12 * 60 * 60 * 1000).toISOString();
    } catch (cause) {
      await client.query('rollback').catch(() => undefined);
      throw cause;
    } finally { client.release(); }
    if (!partnerToken) return { success: true as const, notification_sent: false, reason: 'no_push_token', next_nudge_available_at: nextAvailable };
    if (!nudgesEnabled) return { success: true as const, notification_sent: false, reason: 'nudges_disabled', next_nudge_available_at: nextAvailable };
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ to: partnerToken, title: 'Partner nudge', body: `${senderName || 'Your partner'} wants you to catch up!`, sound: 'default', data: { type: 'nudge' } }),
    });
    if (!response.ok) throw new Error(`Expo push request failed with status ${response.status}`);
    return { success: true as const, notification_sent: true, next_nudge_available_at: nextAvailable };
  }

  private async coupleId(userId: string): Promise<string> {
    const result = await this.pool.query<{ couple_id: string | null }>('select couple_id from profiles where id=$1', [userId]);
    const coupleId = result.rows[0]?.couple_id;
    if (!coupleId) throw new AppDataError('no_couple', 'Join a couple first', 409);
    return coupleId;
  }

  async getLiveDraw(userId: string): Promise<LiveDrawState> {
    const coupleId = await this.coupleId(userId);
    const result = await this.pool.query<{ strokes: StrokeSegment[]; revision: string; updated_at: Date; updated_by: string }>(
      'select strokes,revision::text,updated_at,updated_by from live_draw_sessions where couple_id=$1', [coupleId]);
    const row = result.rows[0];
    return row ? { strokes: row.strokes, revision: Number(row.revision), updated_at: row.updated_at.toISOString(), updated_by: row.updated_by } : { strokes: [], revision: 0, updated_at: null, updated_by: null };
  }

  async putLiveDraw(userId: string, strokes: StrokeSegment[], baseRevision: number): Promise<LiveDrawState> {
    const coupleId = await this.coupleId(userId);
    const memberIds = await this.pool.query<{ id: string }>('select id from profiles where couple_id=$1', [coupleId]);
    const allowed = new Set(memberIds.rows.map(row => row.id));
    if (strokes.some(stroke => !allowed.has(stroke.userId))) {
      throw new AppDataError('not_recipient', 'Drawing contains a stroke from outside this couple', 403);
    }
    let result = await this.pool.query<{ strokes: StrokeSegment[]; revision: string; updated_at: Date; updated_by: string }>(`
      update live_draw_sessions set strokes=$2::jsonb,updated_by=$3,revision=revision+1,updated_at=now()
      where couple_id=$1 and revision=$4
      returning strokes,revision::text,updated_at,updated_by`, [coupleId, JSON.stringify(strokes), userId, baseRevision]);
    if (!result.rows[0] && baseRevision === 0) {
      result = await this.pool.query<{ strokes: StrokeSegment[]; revision: string; updated_at: Date; updated_by: string }>(`
        insert into live_draw_sessions(couple_id,strokes,updated_by) values($1,$2::jsonb,$3)
        on conflict(couple_id) do nothing returning strokes,revision::text,updated_at,updated_by`, [coupleId, JSON.stringify(strokes), userId]);
    }
    const row = result.rows[0];
    if (!row) {
      const current = await this.getLiveDraw(userId);
      throw new AppDataError('revision_conflict', 'Drawing changed on another device', 409, { current_state: current });
    }
    return { strokes: row.strokes, revision: Number(row.revision), updated_at: row.updated_at.toISOString(), updated_by: row.updated_by };
  }
  /**
   * One round trip, all scalar subqueries, nothing that grows with the couple's
   * history. An unpaired member's couple-scoped markers all collapse to zero or null
   * because `me.couple_id` is null, so the endpoint stays valid before pairing.
   */
  async syncSummary(userId: string): Promise<SyncSummary> {
    const result = await this.pool.query<SyncRow>(`
      with me as (select id, couple_id, updated_at from profiles where id = $1),
      visible as (
        select m.id, m.is_new, m.created_at, m.match_type, m.response_summary from matches m, me
        where m.couple_id = me.couple_id
          and not exists (select 1 from match_archives a where a.match_id = m.id and a.user_id = me.id)
      ),
      visible_unread as (
        select v.id as match_id, count(msg.id)::int as c
        from visible v
        left join messages msg on msg.match_id = v.id and msg.user_id <> (select id from me)
          and msg.read_at is null and msg.deleted_at is null
          and not exists (select 1 from message_deletions d where d.message_id = msg.id and d.user_id = (select id from me))
        group by v.id
      )
      select
        now() as server_time,
        me.couple_id,
        me.updated_at as profile_updated_at,
        (select p.id from profiles p where p.couple_id = me.couple_id and p.id <> me.id order by p.id limit 1) as partner_id,
        (select max(p.updated_at) from profiles p where p.couple_id = me.couple_id and p.id <> me.id) as partner_updated_at,
        (select count(*)::int from visible) as match_count,
        (select count(*)::int from visible where is_new) as new_match_count,
        (select max(created_at) from visible) as latest_match_at,
        (select count(*)::int from responses r join questions q on q.id = r.question_id
           where r.couple_id = me.couple_id and q.deleted_at is null and r.user_id <> me.id
             and not exists (select 1 from responses o
               where o.question_id = r.question_id and o.couple_id = me.couple_id and o.user_id = me.id)) as pending_yours,
        (select count(*)::int from responses r join questions q on q.id = r.question_id
           where r.couple_id = me.couple_id and q.deleted_at is null and r.user_id = me.id
             and not exists (select 1 from responses o
               where o.question_id = r.question_id and o.couple_id = me.couple_id and o.user_id <> me.id)) as pending_theirs,
        (select count(*)::int from messages msg join matches ma on ma.id = msg.match_id
           where ma.couple_id = me.couple_id and msg.user_id <> me.id and msg.read_at is null and msg.deleted_at is null
             and not exists (select 1 from message_deletions d where d.message_id = msg.id and d.user_id = me.id)) as unread_total,
        (select md5(coalesce(string_agg(cp.pack_id::text, ',' order by cp.pack_id), ''))
           from couple_packs cp where cp.couple_id = me.couple_id and cp.enabled) as enabled_packs_fingerprint,
        (select md5(coalesce(string_agg(v.id::text || ':' || v.match_type || ':' || coalesce(v.response_summary::text, ''), ',' order by v.id), ''))
           from visible v) as match_state_fingerprint,
        (select md5(coalesce(string_agg(vu.match_id::text || ':' || vu.c, ',' order by vu.match_id), ''))
           from visible_unread vu) as match_unread_fingerprint,
        (select cs.updated_at from couple_streaks cs where cs.couple_id = me.couple_id) as streak_updated_at
      from me`, [userId]);
    const row = result.rows[0];
    if (!row) throw new AppDataError('not_found', 'Profile not found', 404);
    return {
      server_time: row.server_time.toISOString(),
      couple_id: row.couple_id,
      profile_updated_at: row.profile_updated_at?.toISOString() ?? null,
      partner_id: row.partner_id,
      partner_updated_at: row.partner_updated_at?.toISOString() ?? null,
      match_count: row.match_count ?? 0,
      new_match_count: row.new_match_count ?? 0,
      latest_match_at: row.latest_match_at?.toISOString() ?? null,
      pending_yours: row.pending_yours ?? 0,
      pending_theirs: row.pending_theirs ?? 0,
      unread_total: row.unread_total ?? 0,
      enabled_packs_fingerprint: row.enabled_packs_fingerprint ?? '',
      match_state_fingerprint: row.match_state_fingerprint ?? '',
      match_unread_fingerprint: row.match_unread_fingerprint ?? '',
      streak_updated_at: row.streak_updated_at?.toISOString() ?? null,
    };
  }

  async close(): Promise<void> { await closeResolvedPool(this.pool, this.ownsPool); }
}
