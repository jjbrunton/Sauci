import { Pool, type PoolClient, type QueryResultRow } from 'pg';
import type { ClassifierRuntimeConfig, MessageForClassification, OperationItem, ProducerSummary } from './types.js';

interface OutboxRow extends QueryResultRow {
  id: string; kind: OperationItem['kind']; dedupe_key: string; recipient_id: string | null;
  push_token: string | null; payload: Record<string, unknown>; attempts: number;
}

export interface OperationsRepository {
  produce(now: Date, limit?: number): Promise<ProducerSummary>;
  claim(limit?: number): Promise<OperationItem[]>;
  complete(id: string): Promise<void>;
  fail(id: string, message: string): Promise<void>;
  message(id: string): Promise<MessageForClassification | null>;
  classifierConfig(): Promise<ClassifierRuntimeConfig | null>;
  classify(id: string, status: 'safe' | 'flagged', reason: string | null, category: string): Promise<void>;
  close(): Promise<void>;
}

function item(row: OutboxRow): OperationItem {
  return { id: row.id, kind: row.kind, dedupeKey: row.dedupe_key, recipientId: row.recipient_id,
    pushToken: row.push_token, payload: row.payload, attempts: row.attempts };
}

async function transaction<T>(pool: Pool, work: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try { await client.query('begin'); const value=await work(client); await client.query('commit'); return value; }
  catch(cause) { await client.query('rollback'); throw cause; }
  finally { client.release(); }
}

export class PostgresOperationsRepository implements OperationsRepository {
  private readonly pool: Pool;
  constructor(databaseUrl: string) { this.pool = new Pool({ connectionString: databaseUrl }); }

  async produce(now: Date, limit=100): Promise<ProducerSummary> {
    return transaction(this.pool, async (client) => {
      const lock=await client.query<{locked:boolean}>("select pg_try_advisory_xact_lock(hashtext('sauci-operations-producers')) locked");
      const empty={releasedPacks:0,streakMilestones:0,digests:0,packChanges:0,weeklySummaries:0,unpairedReminders:0,catchupReminders:0,streakReminders:0,daresExpired:0};
      if (!lock.rows[0]?.locked) return empty;

      const released=await client.query<{id:string;name:string}>(
        `with candidates as (
           select id from question_packs where is_public=false and release_notified=false
             and scheduled_release_at is not null and scheduled_release_at<=$1
           order by scheduled_release_at for update skip locked limit $2
         ) update question_packs qp set is_public=true,release_notified=true
           from candidates c where qp.id=c.id returning qp.id,qp.name`, [now,limit]);
      for (const pack of released.rows) {
        await client.query(
          `insert into operations_outbox(kind,dedupe_key,recipient_id,payload)
           select 'expo','new_pack:'||$1||':'||p.id,p.id,
             jsonb_build_object('title','New pack available','body',$2||' is now available to play!',
               'data',jsonb_build_object('type','new_pack','packId',$1))
           from profiles p left join notification_preferences np on np.user_id=p.id
           where p.push_token is not null and coalesce(np.new_packs_enabled,true)
           on conflict(dedupe_key) do nothing`, [pack.id,pack.name]);
      }

      const milestones=await client.query<{couple_id:string;current_streak:number}>(
        `with due as (
           select couple_id,current_streak from couple_streaks
           where current_streak=any(array[7,14,30,60,100]) and current_streak>streak_celebrated_at
           order by couple_id for update skip locked limit $1
         ) update couple_streaks cs set streak_celebrated_at=d.current_streak,updated_at=$2
           from due d where cs.couple_id=d.couple_id returning cs.couple_id,cs.current_streak`, [limit,now]);
      for (const milestone of milestones.rows) {
        const copy=streakCopy(milestone.current_streak);
        await client.query(
          `insert into operations_outbox(kind,dedupe_key,recipient_id,payload)
           select 'expo','streak:'||$1::uuid||':'||$2||':'||p.id,p.id,
             jsonb_build_object('title',$3::text,'body',$4::text,'data',jsonb_build_object('type','streak_milestone','streak',$2::int))
           from profiles p left join notification_preferences np on np.user_id=p.id
           where p.couple_id=$1::uuid and p.push_token is not null and coalesce(np.streak_milestones_enabled,true)
           on conflict(dedupe_key) do nothing`, [milestone.couple_id,milestone.current_streak,copy.title,copy.body]);
      }

      const digests=await client.query<{couple_id:string;active_user_id:string;match_count:number;latest_match_id:string|null}>(
        `select couple_id,active_user_id,match_count,latest_match_id from pending_match_notifications
          where notify_at<=$1 order by notify_at for update skip locked limit $2`, [now,limit]);
      for (const digest of digests.rows) {
        const active=await client.query<{name:string|null}>('select name from profiles where id=$1',[digest.active_user_id]);
        const name=active.rows[0]?.name||'Your partner';
        const body=digest.match_count===1?'You have a new match! Tap to see what you both said':digest.match_count>1?`You have ${digest.match_count} new matches! Tap to see what you both said`:'Tap to see what you both said';
        await client.query(
          `insert into operations_outbox(kind,dedupe_key,recipient_id,payload)
           select 'expo','digest:'||$1::uuid||':'||p.id||':'||extract(epoch from $5::timestamptz)::bigint,p.id,
             jsonb_build_object('title',$2::text,'body',$3::text,'data',jsonb_build_object('type','match_digest','count',$4::int,'match_id',$6::text))
           from profiles p left join notification_preferences np on np.user_id=p.id
           where p.couple_id=$1::uuid and p.id<>$7::uuid and p.push_token is not null
             and coalesce(np.partner_activity_enabled,true) and (p.last_active_at is null or p.last_active_at<$5::timestamptz-interval '5 minutes')
           on conflict(dedupe_key) do nothing`,
          [digest.couple_id,`${name} has been answering questions! 💕`,body,digest.match_count,now,digest.latest_match_id,digest.active_user_id]);
        await client.query('delete from pending_match_notifications where couple_id=$1',[digest.couple_id]);
      }

      const packChanges=await client.query<{couple_id:string;changed_by_user_id:string}>(
        `delete from pending_pack_notifications where couple_id in (
           select couple_id from pending_pack_notifications where notify_at<=$1 order by notify_at for update skip locked limit $2
         ) returning couple_id,changed_by_user_id`, [now,limit]);
      for (const change of packChanges.rows) await client.query(
        `insert into operations_outbox(kind,dedupe_key,recipient_id,payload)
         select 'expo','pack_change:'||$1::uuid||':'||p.id||':'||to_char($3::timestamptz,'YYYYMMDDHH24MI'),p.id,
           '{"title":"Question packs updated","body":"Your partner updated the question packs","data":{"type":"pack_change"}}'::jsonb
         from profiles p left join notification_preferences np on np.user_id=p.id
         where p.couple_id=$1::uuid and p.id<>$2::uuid and p.push_token is not null and coalesce(np.pack_changes_enabled,true)
         on conflict(dedupe_key) do nothing`, [change.couple_id,change.changed_by_user_id,now]);

      const weekly=await client.query(
        `insert into operations_outbox(kind,dedupe_key,recipient_id,payload)
         select 'expo','weekly:'||to_char($1::timestamptz,'IYYY-IW')||':'||p.id,p.id,
           jsonb_build_object('title','Your weekly recap','body',case when count(m.id)=0 then 'No new matches this week. Answer some questions to discover what you have in common!'
             when count(m.id)<=3 then 'You matched on '||count(m.id)||' topics this week! Tap to start a conversation.'
             else count(m.id)||' matches this week — you two are on a roll!' end,
             'data',jsonb_build_object('type','weekly_summary'))
         from profiles p left join notification_preferences np on np.user_id=p.id
         left join matches m on m.couple_id=p.couple_id and m.created_at>$1::timestamptz-interval '7 days'
         where extract(dow from $1::timestamptz)=0 and extract(hour from $1::timestamptz)>=10
           and p.couple_id is not null and p.push_token is not null and coalesce(np.weekly_summary_enabled,true)
           and exists(select 1 from responses r where r.couple_id=p.couple_id and r.created_at>$1::timestamptz-interval '7 days')
         group by p.id on conflict(dedupe_key) do nothing`, [now]);

      const unpaired=await client.query(
        `with eligible as (
           select p.id,p.couple_id is not null has_invite from profiles p left join notification_preferences np on np.user_id=p.id
           where extract(hour from $1::timestamptz)>=18 and p.push_token is not null
             and (p.couple_id is null or (select count(*) from profiles member where member.couple_id=p.couple_id)<2)
             and coalesce(np.unpaired_reminders_enabled,true)
             and (p.last_unpaired_reminder_at is null or p.last_unpaired_reminder_at<$1::timestamptz-interval '3 days')
           order by p.id for update of p skip locked limit $2
         ), queued as (
           insert into operations_outbox(kind,dedupe_key,recipient_id,payload)
           select 'expo','unpaired:'||to_char($1::timestamptz,'YYYY-MM-DD')||':'||e.id,e.id,
             jsonb_build_object('title','Sauci','body',case when e.has_invite
               then 'Your invite code is waiting! Share it with your partner to start discovering what you have in common.'
               else 'Ready to get started? Create an invite code and share it with your partner!' end,
               'data',jsonb_build_object('type','unpaired_reminder'))
           from eligible e on conflict(dedupe_key) do nothing returning recipient_id
         ) update profiles p set last_unpaired_reminder_at=$1 from queued q where p.id=q.recipient_id returning p.id`, [now,limit]);

      // Expiring pending dares too: the original design only swept `active`, so an
      // invitation the recipient never opened stayed open forever.
      const expiredDares=await client.query(
        `with due as (
           select id from sent_dares
            where expires_at is not null and expires_at<=$1
              and status in ('pending','active','submitted')
            order by expires_at for update skip locked limit $2
         ) update sent_dares sd set status='expired' from due d where sd.id=d.id returning sd.id`, [now,limit]);

      const catchup=await this.produceCatchups(client,now,limit);
      const streakReminders=await this.produceStreakReminders(client,now);
      return {releasedPacks:released.rowCount??0,streakMilestones:milestones.rowCount??0,digests:digests.rowCount??0,
        packChanges:packChanges.rowCount??0,weeklySummaries:weekly.rowCount??0,unpairedReminders:unpaired.rowCount??0,
        catchupReminders:catchup,streakReminders,daresExpired:expiredDares.rowCount??0};
    });
  }

  /**
   * A shared streak only changes behaviour if somebody hears that it is open before the day
   * closes, so this fires in the couple's own late evening rather than on a server clock.
   * Only the partner who still owes an answer is notified, and the copy names the other
   * partner as an invitation rather than as a debt: guilt between partners is the failure
   * mode for this mechanic, not the goal.
   */
  private async produceStreakReminders(client: PoolClient, now: Date): Promise<number> {
    const result=await client.query(
      `with zones as (select name from pg_timezone_names),
       couple_zone as (
         select r.couple_id,coalesce(z.name,'UTC') zone from (
           select p.couple_id,(array_agg(p.timezone order by p.id) filter (where p.timezone is not null))[1] reported
           from profiles p join couple_streaks cs on cs.couple_id=p.couple_id and cs.current_streak>0
           group by p.couple_id
         ) r left join zones z on z.name=r.reported
       ),
       at_risk as (
         select cs.couple_id,cs.current_streak,cs.last_active_date,cs.user1_answered_today,cs.user2_answered_today,
           ($1::timestamptz at time zone cz.zone)::date local_date
         from couple_streaks cs join couple_zone cz on cz.couple_id=cs.couple_id
         where cs.current_streak>0
           and cs.last_completed_date=($1::timestamptz at time zone cz.zone)::date-1
           and extract(hour from ($1::timestamptz at time zone cz.zone))>=20
       ),
       sides as (
         select ar.couple_id,ar.current_streak,to_char(ar.local_date,'YYYY-MM-DD') local_date,
           me.id me_id,me.push_token,nullif(btrim(partner.name),'') partner_name,
           case when ar.last_active_date is distinct from ar.local_date then false
                when me.id<partner.id then ar.user1_answered_today else ar.user2_answered_today end me_answered,
           case when ar.last_active_date is distinct from ar.local_date then false
                when me.id<partner.id then ar.user2_answered_today else ar.user1_answered_today end partner_answered
         from at_risk ar
         join profiles me on me.couple_id=ar.couple_id
         join profiles partner on partner.couple_id=ar.couple_id and partner.id<>me.id
       )
       insert into operations_outbox(kind,dedupe_key,recipient_id,payload)
       select 'expo','streak_risk:'||s.couple_id||':'||s.local_date||':'||s.me_id,s.me_id,
         jsonb_build_object(
           'title',case when s.partner_answered then coalesce(s.partner_name,'Your partner')||' answered today'
                        else 'Your '||s.current_streak||'-day streak' end,
           'body',case when s.partner_answered
                       then 'You two are '||s.current_streak||' days in together. One question keeps it going.'
                       else 'You and '||coalesce(s.partner_name,'your partner')||' are '||s.current_streak||' days in. One question each keeps it going.' end,
           'data',jsonb_build_object('type','streak_reminder','streak',s.current_streak))
       from sides s left join notification_preferences np on np.user_id=s.me_id
       where not s.me_answered and s.push_token is not null and coalesce(np.streak_reminders_enabled,true)
         and not exists(select 1 from operations_outbox o
           where o.dedupe_key='streak_risk:'||s.couple_id||':'||s.local_date||':'||s.me_id)
       on conflict(dedupe_key) do nothing`,[now]);
    return result.rowCount??0;
  }

  private async produceCatchups(client: PoolClient, now: Date, limit: number): Promise<number> {
    await client.query(
      `with behind as (
         select me.id user_id,min(partner.name) partner_name,count(distinct pr.question_id)::int pending_count
         from profiles me join profiles partner on partner.couple_id=me.couple_id and partner.id<>me.id
         join responses pr on pr.user_id=partner.id
         left join responses mine on mine.user_id=me.id and mine.question_id=pr.question_id
         where mine.id is null group by me.id
       ) insert into catchup_reminder_tracking(user_id,pending_since)
       select user_id,$1 from behind on conflict(user_id) do nothing`, [now]);
    await client.query(
      `delete from catchup_reminder_tracking t where not exists(
         select 1 from profiles me join profiles partner on partner.couple_id=me.couple_id and partner.id<>me.id
         join responses pr on pr.user_id=partner.id left join responses mine on mine.user_id=me.id and mine.question_id=pr.question_id
         where me.id=t.user_id and mine.id is null)`, []);
    const result=await client.query(
      `with due as (
         select me.id,min(partner.name) partner_name,count(distinct pr.question_id)::int pending_count,t.reminder_count
         from catchup_reminder_tracking t join profiles me on me.id=t.user_id
         join profiles partner on partner.couple_id=me.couple_id and partner.id<>me.id
         join responses pr on pr.user_id=partner.id left join responses mine on mine.user_id=me.id and mine.question_id=pr.question_id
         left join notification_preferences np on np.user_id=me.id
         where extract(hour from $1::timestamptz)>=17 and mine.id is null and me.push_token is not null and coalesce(np.catchup_reminders_enabled,true)
           and (me.last_active_at is null or me.last_active_at<$1::timestamptz-interval '6 hours')
           and t.pending_since<=$1::timestamptz-interval '24 hours'
           and (t.reminder_count=0 or t.last_reminder_sent_at<=$1::timestamptz-interval '3 days')
         group by me.id,t.reminder_count order by me.id limit $2
       ), queued as (
         insert into operations_outbox(kind,dedupe_key,recipient_id,payload)
         select 'expo','catchup:'||to_char($1::timestamptz,'YYYY-MM-DD')||':'||d.id,d.id,
           jsonb_build_object('title',case when d.reminder_count=0 then 'Questions waiting' else 'Still waiting on you' end,
             'body',case when d.reminder_count=0 and d.pending_count>=6
               then coalesce(d.partner_name,'Your partner')||' has answered '||d.pending_count||' questions you haven''t seen yet'
               when d.reminder_count=0 then coalesce(d.partner_name,'Your partner')||' answered some questions — your turn!'
               else 'You have '||d.pending_count||' questions waiting. Don''t leave '||coalesce(d.partner_name,'your partner')||' hanging!' end,
             'data',jsonb_build_object('type','catchup_reminder'))
         from due d on conflict(dedupe_key) do nothing returning recipient_id
       ) update catchup_reminder_tracking t set last_reminder_sent_at=$1,reminder_count=reminder_count+1
         from queued q where t.user_id=q.recipient_id returning t.user_id`, [now,limit]);
    return result.rowCount??0;
  }

  async claim(limit=25): Promise<OperationItem[]> {
    return transaction(this.pool, async (client) => {
      const result=await client.query<OutboxRow>(
        `with selected as (
           select id from operations_outbox where sent_at is null and attempts<5 and available_at<=now()
             and (locked_at is null or locked_at<now()-interval '5 minutes')
           order by available_at,created_at for update skip locked limit $1
         ), claimed as (
           update operations_outbox o set locked_at=now(),attempts=attempts+1 from selected s where o.id=s.id returning o.*
         ) select c.id,c.kind,c.dedupe_key,c.recipient_id,
             case when c.kind<>'expo' then null else case c.payload->'data'->>'type'
               when 'message' then case when coalesce(np.messages_enabled,true) then p.push_token end
               when 'match_digest' then case when coalesce(np.partner_activity_enabled,true) then p.push_token end
               when 'pack_change' then case when coalesce(np.pack_changes_enabled,true) then p.push_token end
               when 'new_pack' then case when coalesce(np.new_packs_enabled,true) then p.push_token end
               when 'streak_milestone' then case when coalesce(np.streak_milestones_enabled,true) then p.push_token end
               when 'streak_reminder' then case when coalesce(np.streak_reminders_enabled,true) then p.push_token end
               when 'weekly_summary' then case when coalesce(np.weekly_summary_enabled,true) then p.push_token end
               when 'unpaired_reminder' then case when coalesce(np.unpaired_reminders_enabled,true) then p.push_token end
               when 'catchup_reminder' then case when coalesce(np.catchup_reminders_enabled,true) then p.push_token end
               else p.push_token end end push_token,
             c.payload,c.attempts
           from claimed c left join profiles p on p.id=c.recipient_id
           left join notification_preferences np on np.user_id=c.recipient_id`, [limit]);
      return result.rows.map(item);
    });
  }
  async complete(id:string) { await this.pool.query('update operations_outbox set sent_at=now(),locked_at=null,last_error=null where id=$1',[id]); }
  async fail(id:string,message:string) { await this.pool.query(
    `update operations_outbox set locked_at=null,last_error=$2,available_at=now()+make_interval(secs=>least(3600,power(2,attempts)::int*30)) where id=$1`,[id,message.slice(0,500)]); }
  async message(id:string): Promise<MessageForClassification|null> {
    const r=await this.pool.query<{id:string;version:number;content:string|null;encrypted_content:string|null;encryption_iv:string|null;keys_metadata:{admin_wrapped_key?:string}|null;media_path:string|null;media_type:string|null;storage_key:string|null;mime_type:string|null}>(
      `select m.id,m.version,m.content,m.encrypted_content,m.encryption_iv,m.keys_metadata,m.media_path,m.media_type,
              mo.storage_key,mo.mime_type from messages m left join media_objects mo on m.media_path='media:'||mo.id::text where m.id=$1`,[id]);
    const m=r.rows[0]; return m?{id:m.id,version:m.version,content:m.content,encryptedContent:m.encrypted_content,encryptionIv:m.encryption_iv,keysMetadata:m.keys_metadata,mediaPath:m.media_path,mediaType:m.media_type,mediaStorageKey:m.storage_key,mediaMimeType:m.mime_type}:null;
  }
  async classifierConfig(): Promise<ClassifierRuntimeConfig|null> {
    const result=await this.pool.query<{
      classifier_enabled:boolean|null;openrouter_api_key:string|null;classifier_model:string|null;
      classifier_temperature:number|null;classifier_prompt:string|null;heuristics_enabled:boolean|null;
      heuristic_min_text_length:number|null;heuristic_whitelist_max_length:number|null;
      heuristic_skip_if_no_alnum:boolean|null;heuristic_skip_media_without_text:boolean|null;
      heuristic_use_default_whitelist:boolean|null;heuristic_use_default_keywords:boolean|null;
      heuristic_whitelist:string|null;heuristic_keyword_triggers:string|null;
    }>(`select classifier_enabled,openrouter_api_key,classifier_model,classifier_temperature,classifier_prompt,
               heuristics_enabled,heuristic_min_text_length,heuristic_whitelist_max_length,
               heuristic_skip_if_no_alnum,heuristic_skip_media_without_text,
               heuristic_use_default_whitelist,heuristic_use_default_keywords,
               heuristic_whitelist,heuristic_keyword_triggers
          from ai_config limit 1`);
    const row=result.rows[0];if(!row)return null;
    return {enabled:row.classifier_enabled,apiKey:row.openrouter_api_key,model:row.classifier_model,
      temperature:row.classifier_temperature,prompt:row.classifier_prompt,heuristicsEnabled:row.heuristics_enabled,
      heuristicMinTextLength:row.heuristic_min_text_length,heuristicWhitelistMaxLength:row.heuristic_whitelist_max_length,
      heuristicSkipIfNoAlnum:row.heuristic_skip_if_no_alnum,heuristicSkipMediaWithoutText:row.heuristic_skip_media_without_text,
      heuristicUseDefaultWhitelist:row.heuristic_use_default_whitelist,heuristicUseDefaultKeywords:row.heuristic_use_default_keywords,
      heuristicWhitelist:row.heuristic_whitelist,heuristicKeywordTriggers:row.heuristic_keyword_triggers};
  }
  async classify(id:string,status:'safe'|'flagged',reason:string|null,category:string) {
    await this.pool.query('update messages set moderation_status=$2,flag_reason=$3,category=$4 where id=$1',[id,status,reason,category]);
  }
  async close() { await this.pool.end(); }
}

function streakCopy(days:number) {
  const copy:Record<number,[string,string]>={7:['1 week streak!','You and your partner have been connecting for 7 days straight. Keep it up!'],14:['2 week streak!','Two weeks of daily connection. You two are on fire!'],30:['1 month streak!',"A whole month of daily connection! You're building something special."],60:['2 month streak!','60 days of daily connection. Your commitment is inspiring!'],100:['100 day streak!',"100 days! You've made connection a habit. Incredible!"]};
  const value=copy[days]??[`${days} day streak!`,`${days} days of connecting with your partner. Amazing!`]; return {title:value[0],body:value[1]};
}
