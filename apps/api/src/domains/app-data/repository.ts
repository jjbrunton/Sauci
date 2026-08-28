import { Pool, type QueryResultRow } from 'pg';

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
  getLiveDraw(userId: string): Promise<LiveDrawState>;
  putLiveDraw(userId: string, strokes: StrokeSegment[], baseRevision: number): Promise<LiveDrawState>;
  close(): Promise<void>;
}

interface QuestionRow extends QueryResultRow, Omit<AppQuestion, 'created_at'> { created_at: Date }

function question(row: QuestionRow): AppQuestion { return { ...row, created_at: row.created_at.toISOString() }; }

export class PostgresAppDataRepository implements AppDataRepository {
  private readonly pool: Pool;
  constructor(databaseUrl: string) { this.pool = new Pool({ connectionString: databaseUrl }); }

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
  async close(): Promise<void> { await this.pool.end(); }
}
