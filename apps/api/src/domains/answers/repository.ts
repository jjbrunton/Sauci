import { Pool, type PoolClient } from 'pg';
import { closeResolvedPool, resolvePool, type DatabaseConnection } from '../../db/pool.js';
import { AnswersError, calculateMatchType, type Answer, type MatchType, type QuestionType, type ResponseData } from './types.js';

interface ContextRow { couple_id: string | null; gender: string | null; max_intensity: number; is_premium: boolean }
interface QuestionRow { id: string; pack_id: string; text: string; partner_text: string | null; intensity: number; allowed_couple_genders: string[] | null; target_user_genders: string[] | null; question_type: QuestionType; config: Record<string, unknown>; created_at: string }
interface ResponseRow { id: string; user_id: string; question_id: string; couple_id: string; answer: Answer; response_data: ResponseData; created_at: string }
interface MatchRow { id: string; couple_id: string; question_id: string; match_type: MatchType; is_new: boolean; response_summary: Record<string, unknown> | null; created_at: string }
interface StreakRow { couple_id: string; current_streak: number; longest_streak: number; last_active_date: string | null; last_completed_date: string | null; user1_answered_today: boolean; user2_answered_today: boolean; streak_celebrated_at: number; created_at: Date; updated_at: Date }

/**
 * A streak resolved from one partner's point of view. The stored row is positional
 * (user1/user2 by member id order) because the writer has to be deterministic, but a
 * client cannot act on "user2 has not answered" without re-deriving that ordering, so
 * the API answers in terms of you and your partner instead.
 */
export interface CoupleStreakView {
  couple_id: string;
  current_streak: number;
  longest_streak: number;
  last_active_date: string | null;
  last_completed_date: string | null;
  you_answered_today: boolean;
  partner_answered_today: boolean;
  partner_name: string | null;
  timezone: string;
  streak_celebrated_at: number;
  created_at: string;
  updated_at: string;
}

// A response to a question the partner answered first is catching up, not new exploration.
// Those neither consume nor are blocked by the daily limit, so the reciprocity loop the
// answer-gap mechanic pushes can never be refused by the meter.
const catchUpExemption = "select 1 from responses pr where pr.question_id=r.question_id and pr.couple_id=r.couple_id and pr.user_id<>r.user_id and pr.created_at<r.created_at";

export interface SubmitInput { questionId: string; answer: Answer; responseData?: ResponseData }
export interface UpdateInput extends SubmitInput { confirmDeleteMatch: boolean }

export interface AnswersRepository {
  recommended(userId: string, packId?: string): Promise<QuestionRow[]>;
  pending(userId: string, direction: 'mine' | 'partner', startQuestionId?: string): Promise<Array<{ id: string; question: QuestionRow & { pack: { id: string; name: string; icon: string | null } }; partnerAnsweredAt: string }>>;
  answerGap(userId: string): Promise<{ unanswered_by_partner: number; threshold: number; is_blocked: boolean }>;
  dailyLimit(userId: string): Promise<{ responses_today: number; limit_value: number; remaining: number; reset_at: string | null; is_blocked: boolean }>;
  submit(userId: string, input: SubmitInput): Promise<{ response: ResponseRow; match: (MatchRow & { question: QuestionRow }) | null; sealed_count?: number }>;
  update(userId: string, input: UpdateInput): Promise<Record<string, unknown>>;
  responses(userId: string, page: number, limit: number): Promise<{ responses: unknown[]; totalCount: number }>;
  matches(userId: string, page: number, limit: number, archived: boolean): Promise<{ matches: unknown[]; totalCount: number | null; hasMore: boolean }>;
  markSeen(userId: string, ids: string[]): Promise<void>;
  archive(userId: string, matchId: string, archived: boolean): Promise<void>;
  streak(userId: string): Promise<CoupleStreakView | null>;
  close(): Promise<void>;
}

export class PostgresAnswersRepository implements AnswersRepository {
  private readonly pool: Pool;
  private readonly ownsPool: boolean;
  private zones: Promise<Set<string>> | null = null;
  constructor(connection: DatabaseConnection) { const resolved = resolvePool(connection); this.pool = resolved.pool; this.ownsPool = resolved.owned; }

  /**
   * couple_id is nullable here: an unpaired user still has a profile and can answer
   * questions solo, banking them as sealed answers (couple_id IS NULL on responses)
   * until a partner joins. Callers that need a couple for their own operation (e.g.
   * matches, streaks) get an empty/no-op result naturally because every downstream
   * query is scoped by couple_id, which stays null for a solo caller.
   */
  private async context(client: Pool | PoolClient, userId: string): Promise<ContextRow> {
    const result = await client.query<ContextRow>('select couple_id, gender, max_intensity, is_premium from profiles where id=$1', [userId]);
    const row = result.rows[0];
    if (!row) throw new AnswersError('no_couple', 409, 'Complete signup before answering questions');
    return row;
  }

  async recommended(userId: string, packId?: string): Promise<QuestionRow[]> {
    const ctx = await this.context(this.pool, userId);
    const partner = await this.pool.query<ContextRow & { id: string }>('select id, couple_id, gender, max_intensity, is_premium from profiles where couple_id=$1 and id<>$2 order by id limit 1', [ctx.couple_id, userId]);
    const p = partner.rows[0];
    const config = await this.config();
    if (!packId && p && (await this.answerGap(userId)).is_blocked) return [];
    if (!ctx.is_premium && !p?.is_premium && (await this.dailyLimit(userId)).is_blocked) return [];
    const genders = ctx.gender && p?.gender ? [ctx.gender, p.gender].sort().join('+') : null;
    const maxIntensity = config.couple_intensity_gate_enabled && p ? Math.min(ctx.max_intensity, p.max_intensity) : ctx.max_intensity;
    const result = await this.pool.query<QuestionRow>(`
      with configured as (select exists(select 1 from couple_packs where couple_id=$2) value),
      active as (
        select $3::uuid pack_id where $3::uuid is not null
        union all select cp.pack_id from couple_packs cp, configured c where $3::uuid is null and cp.couple_id=$2 and cp.enabled and c.value
        union all select qp.id from question_packs qp, configured c where $3::uuid is null and qp.is_public and not c.value
      )
      select q.id,q.pack_id,
        case when q.partner_text is not null and pr.id is not null then q.partner_text else q.text end text,
        q.partner_text,q.intensity,q.allowed_couple_genders,q.target_user_genders,q.question_type,q.config,q.created_at
      from questions q join active a on a.pack_id=q.pack_id join question_packs qp on qp.id=q.pack_id
      left join responses pr on pr.question_id=q.id and pr.couple_id=$2 and pr.user_id<>$1
      where q.deleted_at is null and not exists(select 1 from responses r where r.user_id=$1 and r.question_id=q.id)
        and (not qp.is_premium or $4)
        and (q.allowed_couple_genders is null or $5::text is null or $5=any(q.allowed_couple_genders))
        and (q.target_user_genders is null or $6=any(q.target_user_genders) or pr.id is not null)
        and q.intensity <= $7
      order by (pr.id is not null) desc,q.intensity,q.id`,
      [userId, ctx.couple_id, packId ?? null, ctx.is_premium || !!p?.is_premium, genders, ctx.gender, maxIntensity]);
    return result.rows.map(this.dates);
  }

  async pending(userId: string, direction: 'mine' | 'partner', startQuestionId?: string) {
    const ctx = await this.context(this.pool, userId);
    const result = await this.pool.query<{ id: string; created_at: string; question: QuestionRow & { pack: { id: string; name: string; icon: string | null } } }>(`
      select r.id,r.created_at,json_build_object('id',q.id,'pack_id',q.pack_id,'text',q.text,'partner_text',q.partner_text,
        'intensity',q.intensity,'allowed_couple_genders',q.allowed_couple_genders,'target_user_genders',q.target_user_genders,
        'question_type',q.question_type,'config',q.config,'created_at',q.created_at,
        'pack',json_build_object('id',qp.id,'name',qp.name,'icon',qp.icon)) question
      from responses r join questions q on q.id=r.question_id join question_packs qp on qp.id=q.pack_id
      where r.couple_id=$2 and r.user_id ${direction === 'partner' ? '<>' : '='} $1 and q.deleted_at is null
        and not exists(select 1 from responses other where other.question_id=r.question_id and other.user_id ${direction === 'partner' ? '=' : '<>'} $1 and other.couple_id=$2)
      order by case when r.question_id=$3 then 0 else 1 end,r.created_at ${direction === 'partner' ? 'asc' : 'desc'}`,
      [userId, ctx.couple_id, startQuestionId ?? null]);
    return result.rows.map(row => ({ id: row.id, question: row.question, partnerAnsweredAt: new Date(row.created_at).toISOString() }));
  }

  private async config(client: Pool | PoolClient = this.pool) {
    const result = await client.query<{ answer_gap_threshold: number; daily_response_limit: number; couple_intensity_gate_enabled: boolean }>('select answer_gap_threshold,daily_response_limit,couple_intensity_gate_enabled from app_config limit 1');
    return result.rows[0] ?? { answer_gap_threshold: 10, daily_response_limit: 0, couple_intensity_gate_enabled: false };
  }

  async answerGap(userId: string) {
    let ctx: ContextRow; try { ctx = await this.context(this.pool, userId); } catch { return { unanswered_by_partner: 0, threshold: 0, is_blocked: false }; }
    const cfg = await this.config();
    const partner = await this.pool.query<{ id: string; max_intensity: number }>('select id,max_intensity from profiles where couple_id=$1 and id<>$2 order by id limit 1', [ctx.couple_id, userId]);
    if (!partner.rows[0] || cfg.answer_gap_threshold === 0) return { unanswered_by_partner: 0, threshold: cfg.answer_gap_threshold, is_blocked: false };
    const gate = cfg.couple_intensity_gate_enabled ? Math.min(ctx.max_intensity, partner.rows[0].max_intensity) : 5;
    const counts = await this.pool.query<{ mine: number; theirs: number }>(`
      with enabled as(select pack_id from couple_packs where couple_id=$2 and enabled), eligible as(
        select r.* from responses r join questions q on q.id=r.question_id
        where r.couple_id=$2 and exists(select 1 from enabled) and q.pack_id in(select pack_id from enabled) and q.intensity <= $4)
      select count(*) filter(where e.user_id=$1 and not exists(select 1 from eligible x where x.question_id=e.question_id and x.user_id=$3))::int mine,
        count(*) filter(where e.user_id=$3 and not exists(select 1 from eligible x where x.question_id=e.question_id and x.user_id=$1))::int theirs from eligible e`,
      [userId, ctx.couple_id, partner.rows[0].id, gate]);
    const net = Math.max(0, (counts.rows[0]?.mine ?? 0) - (counts.rows[0]?.theirs ?? 0));
    return { unanswered_by_partner: net, threshold: cfg.answer_gap_threshold, is_blocked: net >= cfg.answer_gap_threshold };
  }

  async dailyLimit(userId: string) {
    return this.dailyLimitWith(this.pool,userId);
  }

  async submit(userId: string, input: SubmitInput) {
    return this.tx(async client => {
      // Profile lock serializes a user's daily-limit count across different questions.
      const ctx = await this.lockedContext(client, userId);
      // Question lock serializes both partners so the second transaction observes
      // the first committed response and creates exactly one match.
      const q = await this.question(client, input.questionId, true);
      await this.assertEligible(client,userId,ctx,q);
      const existing = await client.query('select id from responses where user_id=$1 and question_id=$2 for update', [userId,input.questionId]);
      if (!existing.rowCount) {
        // A solo answerer has no partner, so the catch-up exemption never applies:
        // every sealed answer counts against the daily limit like a fresh one.
        const catchingUp = ctx.couple_id
          ? await client.query('select 1 from responses where couple_id=$1 and question_id=$2 and user_id<>$3 limit 1',[ctx.couple_id,input.questionId,userId])
          : { rowCount: 0 };
        if (!catchingUp.rowCount) {
          const limit = await this.dailyLimitWith(client,userId); if (limit.is_blocked) throw new AnswersError('daily_limit',429,'Daily response limit reached',{ daily_limit: limit.limit_value, responses_today: limit.responses_today, remaining: 0, reset_at: limit.reset_at });
        }
      }
      const response = await client.query<ResponseRow>(`insert into responses(id,user_id,question_id,couple_id,answer,response_data) values(gen_random_uuid(),$1,$2,$3,$4,$5)
        on conflict(user_id,question_id) do update set answer=excluded.answer,response_data=excluded.response_data returning *`,[userId,input.questionId,ctx.couple_id,input.answer,input.responseData ?? null]);
      if (!ctx.couple_id) {
        // No couple yet: bank the answer as sealed. It is claimed and reconciled
        // into matches once a partner joins; see couples repository join().
        const sealed = await client.query<{ count: number }>('select count(*)::int count from responses where user_id=$1 and couple_id is null',[userId]);
        return { response: this.dates(response.rows[0]), match: null, sealed_count: sealed.rows[0]?.count ?? 0 };
      }
      const match = await this.reconcileMatch(client,userId,ctx.couple_id,q,input.answer,input.responseData ?? null,true);
      await this.touchStreak(client,userId,ctx.couple_id);
      return { response: this.dates(response.rows[0]), match: match ? { ...this.dates(match), question: this.dates(q) } : null };
    });
  }

  async update(userId: string, input: UpdateInput) {
    return this.tx(async client => {
      const ctx = await this.lockedContext(client,userId); const q=await this.question(client,input.questionId,true);
      const current=await client.query<ResponseRow>('select * from responses where user_id=$1 and question_id=$2 for update',[userId,input.questionId]);
      if (!current.rows[0]) throw new AnswersError('response_not_found',404,'No existing response found for this question');
      if (current.rows[0].answer===input.answer && typeof input.responseData==='undefined') return { success:true,message:'Answer unchanged' };
      const existing=await client.query<MatchRow>('select * from matches where couple_id=$1 and question_id=$2 for update',[ctx.couple_id,input.questionId]);
      if (input.answer==='no' && existing.rows[0] && !input.confirmDeleteMatch) {
        const count=await client.query<{ count:number }>('select count(*)::int count from messages where match_id=$1',[existing.rows[0].id]);
        return { success:false,requires_confirmation:true,match_id:existing.rows[0].id,message_count:count.rows[0]?.count ?? 0 };
      }
      const normalized=q.question_type!=='swipe' && input.answer!=='no' ? (typeof input.responseData==='undefined' ? current.rows[0].response_data : input.responseData) : null;
      const before=existing.rows[0]; const match=ctx.couple_id?await this.reconcileMatch(client,userId,ctx.couple_id,q,input.answer,normalized,false):null;
      await client.query('update responses set answer=$3,response_data=$4 where user_id=$1 and question_id=$2',[userId,input.questionId,input.answer,normalized]);
      if (ctx.couple_id) await this.touchStreak(client,userId,ctx.couple_id);
      return { success:true, ...(before&&!match?{match_deleted:true}:{ }), ...(!before&&match?{new_match:this.dates(match)}:{}), ...(before&&match?{match_type_updated:true}:{}) };
    });
  }

  private async reconcileMatch(client:PoolClient,userId:string,coupleId:string,q:QuestionRow,answer:Answer,data:ResponseData,isNew:boolean) {
    const partner=await client.query<ResponseRow>('select * from responses where couple_id=$1 and question_id=$2 and user_id<>$3 limit 1',[coupleId,q.id,userId]);
    if(!partner.rows[0]) return null;
    const type=calculateMatchType(q,answer,partner.rows[0].answer);
    if(!type){ await client.query('delete from matches where couple_id=$1 and question_id=$2',[coupleId,q.id]); return null; }
    const summary=type==='both_answered'?{[userId]:data,[partner.rows[0].user_id]:partner.rows[0].response_data}:null;
    const result=await client.query<MatchRow>(`insert into matches(couple_id,question_id,match_type,is_new,response_summary) values($1,$2,$3,true,$4)
      on conflict(couple_id,question_id) do update set match_type=excluded.match_type,response_summary=excluded.response_summary,is_new=case when $5 then true else matches.is_new end returning *`,[coupleId,q.id,type,summary,isNew]);
    return result.rows[0];
  }

  /**
   * The streak day is the couple's shared local day, not the server's. Both partners have
   * to land inside the same calendar date for the day to count, so the zone belongs to the
   * couple rather than to whoever happens to be answering: the first reported zone in member
   * id order, which is the same ordering that decides user1/user2, falling back to UTC when
   * neither partner has reported one. Without this a couple in a western zone loses the
   * streak at UTC midnight while it is still the same evening for them.
   */
  private async coupleZone(client:Pool|PoolClient,reported:(string|null)[]):Promise<string>{
    const zone=reported.find(value=>value);
    return zone&&(await this.timezoneNames(client)).has(zone)?zone:'UTC';
  }

  private async streakDay(client:Pool|PoolClient,zone:string){
    const r=await client.query<{today:string;yesterday:string}>("select (now() at time zone $1::text)::date::text today,((now() at time zone $1::text)::date-1)::text yesterday",[zone]);
    return r.rows[0];
  }

  private async touchStreak(client:PoolClient,userId:string,coupleId:string){
    const users=await client.query<{id:string;timezone:string|null}>('select id,timezone from profiles where couple_id=$1 order by id',[coupleId]); if(users.rows.length<2)return;
    const user1=users.rows[0].id===userId;
    await client.query('insert into couple_streaks(couple_id) values($1) on conflict do nothing',[coupleId]);
    const locked=await client.query<{current_streak:number;longest_streak:number;last_active_date:string|null;last_completed_date:string|null;user1_answered_today:boolean;user2_answered_today:boolean}>(`select current_streak,longest_streak,last_active_date::text,last_completed_date::text,user1_answered_today,user2_answered_today from couple_streaks where couple_id=$1 for update`,[coupleId]);
    const row=locked.rows[0]; const {today,yesterday}=await this.streakDay(client,await this.coupleZone(client,users.rows.map(member=>member.timezone)));
    let first=row.last_active_date===today?row.user1_answered_today:false; let second=row.last_active_date===today?row.user2_answered_today:false;
    if(user1)first=true;else second=true;
    let current=row.last_completed_date && row.last_completed_date!==yesterday && row.last_completed_date!==today?0:row.current_streak; let completed=row.last_completed_date;
    if(first&&second&&completed!==today){current=completed===yesterday?current+1:1;completed=today;}
    await client.query(`update couple_streaks set current_streak=$2,longest_streak=greatest(longest_streak,$2),last_active_date=$3,last_completed_date=$4,user1_answered_today=$5,user2_answered_today=$6,updated_at=now() where couple_id=$1`,[coupleId,current,today,completed,first,second]);
  }

  async responses(userId:string,page:number,limit:number){
    const ctx=await this.context(this.pool,userId); const offset=page*limit;
    const [rows,count]=await Promise.all([
      this.pool.query(`select r.id,r.question_id,r.answer,r.response_data,r.created_at,
        json_build_object('id',q.id,'text',q.text,'partner_text',q.partner_text,'intensity',q.intensity,'pack_id',q.pack_id,'question_type',q.question_type,'config',q.config,'created_at',q.created_at,'pack',json_build_object('id',qp.id,'name',qp.name,'icon',qp.icon)) question,
        m.id is not null has_match,m.id match_id,pr.id is not null partner_answered
        from responses r join questions q on q.id=r.question_id join question_packs qp on qp.id=q.pack_id left join matches m on m.couple_id=r.couple_id and m.question_id=r.question_id left join responses pr on pr.couple_id=r.couple_id and pr.question_id=r.question_id and pr.user_id<>$1 where r.user_id=$1 and r.couple_id=$2 order by r.created_at desc limit $3 offset $4`,[userId,ctx.couple_id,limit,offset]),
      this.pool.query<{count:number}>('select count(*)::int count from responses where user_id=$1 and couple_id=$2',[userId,ctx.couple_id])]);
    return {responses:rows.rows.map(this.dates),totalCount:count.rows[0]?.count??0};
  }

  /**
   * Reading one row past the page decides `hasMore` exactly, and the total — which
   * the client only records when it refreshes — is counted on the first page only
   * instead of on every scroll. Unread is aggregated once per couple rather than as
   * a correlated count per row: the sort key depends on it, so the old subquery
   * already ran for every candidate match, not just the twenty that were returned.
   */
  async matches(userId:string,page:number,limit:number,archived:boolean){
    const ctx=await this.context(this.pool,userId); const offset=page*limit;
    const params=[userId,ctx.couple_id,archived,limit+1,offset];
    const from=`from matches m join questions q on q.id=m.question_id left join match_archives a on a.match_id=m.id and a.user_id=$1`;
    const where=`where m.couple_id=$2 and (($3 and a.id is not null) or (not $3 and a.id is null))`;
    const unread=`unread as (select msg.match_id,count(*)::int c from messages msg join matches um on um.id=msg.match_id and um.couple_id=$2 where msg.user_id<>$1 and msg.read_at is null group by msg.match_id)`;
    const [rows,count]=await Promise.all([
      this.pool.query(`with ${unread} select m.*,json_build_object('id',q.id,'pack_id',q.pack_id,'text',q.text,'partner_text',q.partner_text,'intensity',q.intensity,'question_type',q.question_type,'config',q.config,'created_at',q.created_at) question,coalesce(u.c,0) "unreadCount" ${from} left join unread u on u.match_id=m.id ${where} order by "unreadCount" desc,m.created_at desc limit $4 offset $5`,params),
      page===0?this.pool.query<{count:number}>(`select count(*)::int count ${from} ${where}`,params.slice(0,3)):null]);
    return {matches:rows.rows.slice(0,limit).map(this.dates),totalCount:count?count.rows[0]?.count??0:null,hasMore:rows.rows.length>limit};
  }
  async markSeen(userId:string,ids:string[]){const ctx=await this.context(this.pool,userId);await this.pool.query('update matches set is_new=false where couple_id=$1 and id=any($2::uuid[])',[ctx.couple_id,ids]);}
  async archive(userId:string,matchId:string,archived:boolean){const ctx=await this.context(this.pool,userId);const found=await this.pool.query('select 1 from matches where id=$1 and couple_id=$2',[matchId,ctx.couple_id]);if(!found.rowCount)throw new AnswersError('match_not_found',404,'Match was not found');if(archived)await this.pool.query('insert into match_archives(match_id,user_id) values($1,$2) on conflict do nothing',[matchId,userId]);else await this.pool.query('delete from match_archives where match_id=$1 and user_id=$2',[matchId,userId]);}
  async streak(userId:string):Promise<CoupleStreakView|null>{
    const ctx=await this.context(this.pool,userId);
    const r=await this.pool.query<StreakRow>(`select couple_id,current_streak,longest_streak,last_active_date::text last_active_date,last_completed_date::text last_completed_date,
      user1_answered_today,user2_answered_today,streak_celebrated_at,created_at,updated_at from couple_streaks where couple_id=$1`,[ctx.couple_id]);
    const row=r.rows[0]; if(!row)return null;
    const members=await this.pool.query<{id:string;name:string|null;timezone:string|null}>('select id,name,timezone from profiles where couple_id=$1 order by id',[ctx.couple_id]);
    if(members.rows.length<2)return null;
    const zone=await this.coupleZone(this.pool,members.rows.map(member=>member.timezone));
    const {today,yesterday}=await this.streakDay(this.pool,zone);
    // The row is only rewritten when somebody answers, so a lapsed streak keeps its stored
    // number until the next response arrives. Reading applies the same day rules the writer
    // does rather than showing a count that the next answer will silently reset to 1.
    const active=row.last_active_date===today;
    const first=active&&row.user1_answered_today; const second=active&&row.user2_answered_today;
    const alive=row.last_completed_date===today||row.last_completed_date===yesterday;
    const isUser1=members.rows[0].id===userId; const partner=members.rows[isUser1?1:0];
    return {
      couple_id:row.couple_id,
      current_streak:alive?row.current_streak:0,
      longest_streak:row.longest_streak,
      last_active_date:row.last_active_date,
      last_completed_date:row.last_completed_date,
      you_answered_today:isUser1?first:second,
      partner_answered_today:isUser1?second:first,
      partner_name:partner?.name??null,
      timezone:zone,
      streak_celebrated_at:row.streak_celebrated_at,
      created_at:row.created_at.toISOString(),
      updated_at:row.updated_at.toISOString(),
    };
  }
  private async question(client:PoolClient,id:string,lock=false){const r=await client.query<QuestionRow>(`select * from questions where id=$1 and deleted_at is null${lock?' for update':''}`,[id]);if(!r.rows[0])throw new AnswersError('question_not_found',404,'Question was not found');return r.rows[0];}
  private timezoneNames(client:Pool|PoolClient){
    // pg_timezone_names is a ~600-row function scan costing ~12ms. The list is static for the
    // life of the process, so load it once instead of on every daily-limit check.
    this.zones??=client.query<{name:string}>('select name from pg_timezone_names')
      .then(r=>new Set(r.rows.map(row=>row.name)))
      .catch(cause=>{this.zones=null;throw cause;});
    return this.zones;
  }
  private async lockedContext(client:PoolClient,userId:string){await client.query('select id from profiles where id=$1 for update',[userId]);return this.context(client,userId);}
  private async dailyLimitWith(client:Pool|PoolClient,userId:string){
    const cfg=await this.config(client);const unlimited={responses_today:0,limit_value:0,remaining:0,reset_at:null,is_blocked:false};
    if(cfg.daily_response_limit===0)return unlimited;
    // Premium is shared across a couple: either partner's subscription lifts the cap for both.
    const profile=await client.query<{premium:boolean;zone:string|null}>('select (p.is_premium or coalesce(bool_or(o.is_premium),false)) premium,p.timezone zone from profiles p left join profiles o on o.couple_id=p.couple_id and o.id<>p.id where p.id=$1 group by p.is_premium,p.timezone',[userId]);
    if(profile.rows[0]?.premium)return unlimited;
    // The window is the user's local calendar day; an unreported or unrecognised zone falls
    // back to UTC. Validating in JS keeps an unknown zone from erroring the query without
    // paying for a pg_timezone_names scan inside submit()'s locked transaction.
    const reported=profile.rows[0]?.zone;
    const zone=reported&&(await this.timezoneNames(client)).has(reported)?reported:'UTC';
    const r=await client.query<{count:number;reset_at:string}>(`select count(*)::int count,((date_trunc('day',now() at time zone $2::text)+interval '1 day') at time zone $2::text) reset_at from responses r where r.user_id=$1 and r.created_at>=(date_trunc('day',now() at time zone $2::text) at time zone $2::text) and not exists(${catchUpExemption})`,[userId,zone]);
    const count=r.rows[0]?.count??0;
    return {responses_today:count,limit_value:cfg.daily_response_limit,remaining:Math.max(0,cfg.daily_response_limit-count),reset_at:r.rows[0]?new Date(r.rows[0].reset_at).toISOString():null,is_blocked:count>=cfg.daily_response_limit};
  }
  private async assertEligible(client:PoolClient,userId:string,ctx:ContextRow,q:QuestionRow){
    const partner=await client.query<ContextRow&{id:string}>('select id,couple_id,gender,max_intensity,is_premium from profiles where couple_id=$1 and id<>$2 order by id limit 1',[ctx.couple_id,userId]);const p=partner.rows[0];
    const cfg=await this.config(client);const max=cfg.couple_intensity_gate_enabled&&p?Math.min(ctx.max_intensity,p.max_intensity):ctx.max_intensity;const genders=ctx.gender&&p?.gender?[ctx.gender,p.gender].sort().join('+'):null;
    const allowed=!q.allowed_couple_genders||!genders||q.allowed_couple_genders.includes(genders);const targeted=!q.target_user_genders||!!ctx.gender&&q.target_user_genders.includes(ctx.gender)||!!(await client.query('select 1 from responses where couple_id=$1 and question_id=$2 and user_id<>$3',[ctx.couple_id,q.id,userId])).rowCount;
    const pack=await client.query<{is_public:boolean;is_premium:boolean;enabled:boolean|null;configured:boolean}>(`select qp.is_public,qp.is_premium,cp.enabled,exists(select 1 from couple_packs where couple_id=$2) configured from question_packs qp left join couple_packs cp on cp.pack_id=qp.id and cp.couple_id=$2 where qp.id=$1`,[q.pack_id,ctx.couple_id]);const pr=pack.rows[0];const active=!!pr&&(pr.configured?pr.enabled===true:pr.is_public);const premium=!pr?.is_premium||ctx.is_premium||!!p?.is_premium;
    if(!active||!premium||q.intensity>max||!allowed||!targeted)throw new AnswersError('question_not_eligible',404,'Question was not found');
  }
  private async tx<T>(fn:(client:PoolClient)=>Promise<T>):Promise<T>{const c=await this.pool.connect();try{await c.query('begin');const value=await fn(c);await c.query('commit');return value;}catch(e){await c.query('rollback');throw e;}finally{c.release();}}
  private dates<T extends Record<string,any>>(row:T):T{return Object.fromEntries(Object.entries(row).map(([k,v])=>[k,v instanceof Date?v.toISOString():v])) as T;}
  async close(){await closeResolvedPool(this.pool,this.ownsPool);}
}
