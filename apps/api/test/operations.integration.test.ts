import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { Pool } from 'pg';
import { afterAll,beforeAll,describe,expect,it } from 'vitest';
import { OUTBOX_STATE_SQL, PostgresOperationsRepository } from '../src/domains/operations/repository.js';

const databaseUrl=process.env.DATABASE_URL;const local=databaseUrl?['127.0.0.1','localhost','::1'].includes(new URL(databaseUrl).hostname):false;
if(databaseUrl&&!local)throw new Error('Operations integration tests only permit a localhost DATABASE_URL');
describe.skipIf(!databaseUrl||!local)('PostgresOperationsRepository',()=>{
  const admin=new Pool({connectionString:databaseUrl});const schema=`operations_test_${randomUUID().replaceAll('-','')}`;
  const alice='11111111-1111-4111-8111-111111111111',bob='22222222-2222-4222-8222-222222222222',couple='33333333-3333-4333-8333-333333333333';
  const pack='44444444-4444-4444-8444-444444444444',question='55555555-5555-4555-8555-555555555555';let pool:Pool;let repo:PostgresOperationsRepository;let repo2:PostgresOperationsRepository;
  beforeAll(async()=>{
    await admin.query(`create schema "${schema}"`);const url=new URL(databaseUrl!);url.searchParams.set('options',`-c search_path=${schema}`);pool=new Pool({connectionString:url.toString()});repo=new PostgresOperationsRepository(url.toString());repo2=new PostgresOperationsRepository(url.toString());
    for(const name of ['0000_identity_and_feature_interests.sql','0001_couples.sql','0002_packs_catalog_progress.sql','0003_answers_matches.sql','0004_chat.sql','0005_profile_settings.sql','0006_media_storage.sql','0009_operations_workers.sql','0010_admin.sql','0014_daily_limit_local_reset.sql','0016_couple_streak_locality.sql','0017_streak_reminder_preference.sql','0022_solo_sealed_answers.sql']){
      const sql=await readFile(new URL(`../drizzle/${name}`,import.meta.url),'utf8');for(const statement of sql.split('--> statement-breakpoint'))if(statement.trim())await pool.query(statement);
    }
    await pool.query('insert into couples(id,invite_code) values($1,$2)',[couple,'ABCD2345']);
    await pool.query(`insert into profiles(id,name,email,couple_id,push_token,onboarding_completed) values($1,'Alice','alice@test',$3,'token-a',false),($2,'Bob','bob@test',$3,'token-b',false)`,[alice,bob,couple]);
    await pool.query(`insert into question_packs(id,name,is_public,scheduled_release_at) values($1,'Coming soon',false,now()-interval '1 minute')`,[pack]);
    await pool.query('insert into questions(id,pack_id,text) values($1,$2,$3)',[question,pack,'Question']);
  });
  afterAll(async()=>{await Promise.all([repo.close(),repo2.close()]);await pool.end();await admin.query(`drop schema "${schema}" cascade`);await admin.end();});

  it('queues message delivery and classification once at the write boundary',async()=>{
    const response=randomUUID(),match=randomUUID(),message=randomUUID();
    await pool.query(`insert into responses(id,user_id,question_id,couple_id,answer) values($1,$2,$3,$4,'yes')`,[response,alice,question,couple]);
    await pool.query(`insert into matches(id,couple_id,question_id,match_type) values($1,$2,$3,'yes_yes')`,[match,couple,question]);
    await pool.query(`insert into messages(id,match_id,user_id,content) values($1,$2,$3,'hello')`,[message,match,alice]);
    const rows=await pool.query(`select kind,dedupe_key,recipient_id from operations_outbox where dedupe_key like $1 order by kind`,[`%${message}%`]);
    expect(rows.rows).toEqual([{kind:'classify',dedupe_key:`classify:${message}`,recipient_id:null},{kind:'expo',dedupe_key:`message:${message}:${bob}`,recipient_id:bob}]);
  });

  it('loads live classifier settings from the self-hosted database',async()=>{
    await pool.query("insert into ai_config(classifier_enabled,classifier_model) values(false,'test/live-model')");
    await expect(repo.classifierConfig()).resolves.toMatchObject({enabled:false,model:'test/live-model'});
  });

  it('suppresses side effects during historical cutover imports',async()=>{
    const match=(await pool.query<{id:string}>('select id from matches limit 1')).rows[0]!.id;const message=randomUUID();
    const client=await pool.connect();try{await client.query('begin');await client.query("set local sauci.suppress_operations='on'");
      await client.query(`insert into messages(id,match_id,user_id,content) values($1,$2,$3,'historical')`,[message,match,alice]);await client.query('commit');
    }finally{client.release();}
    expect((await pool.query('select count(*)::int count from operations_outbox where dedupe_key like $1',[`%${message}%`])).rows[0].count).toBe(0);
  });

  it('reminds an invite creator without reporting a couple as paired prematurely',async()=>{
    const inviteCouple=randomUUID(),creator=randomUUID(),partner=randomUUID();
    await pool.query('insert into couples(id,invite_code) values($1,$2)',[inviteCouple,'WAIT2345']);
    await pool.query(`insert into profiles(id,name,email,couple_id,push_token,onboarding_completed) values($1,'Creator','creator@test',$2,'token-creator',false)`,[creator,inviteCouple]);
    expect((await pool.query('select count(*)::int count from operations_outbox where dedupe_key=$1',[`discord:couple_paired:${inviteCouple}`])).rows[0].count).toBe(0);

    const summary=await repo.produce(new Date('2026-08-27T18:00:00.000Z'),100);
    expect(summary.unpairedReminders).toBeGreaterThanOrEqual(1);
    expect((await pool.query<{body:string}>(`select payload->>'body' body from operations_outbox where dedupe_key=$1`,[`unpaired:2026-08-27:${creator}`])).rows[0]?.body).toContain('invite code is waiting');

    await pool.query(`insert into profiles(id,name,email,push_token,onboarding_completed) values($1,'Partner','partner@test','token-partner',false)`,[partner]);
    await pool.query('update profiles set couple_id=$1 where id=$2',[inviteCouple,partner]);
    expect((await pool.query('select count(*)::int count from operations_outbox where dedupe_key=$1',[`discord:couple_paired:${inviteCouple}`])).rows[0].count).toBe(1);
  });

  it('escalates the unpaired nudge copy with the sealed answer count',async()=>{
    const solo=randomUUID(),secondQuestion=randomUUID();
    await pool.query(`insert into profiles(id,name,email,push_token,onboarding_completed) values($1,'Solo','solo@test','token-solo',false)`,[solo]);
    await pool.query('insert into questions(id,pack_id,text) values($1,$2,$3)',[secondQuestion,pack,'Second question']);
    await pool.query(`insert into responses(id,user_id,question_id,couple_id,answer) values($1,$2,$3,null,'yes'),($4,$2,$5,null,'maybe')`,
      [randomUUID(),solo,question,randomUUID(),secondQuestion]);

    await repo.produce(new Date('2026-08-28T18:00:00.000Z'),100);
    const body=(await pool.query<{body:string;data:{sealed_count:number}}>(
      `select payload->>'body' body,payload->'data' data from operations_outbox where dedupe_key=$1`,
      [`unpaired:2026-08-28:${solo}`],
    )).rows[0];
    expect(body?.body).toContain('2 sealed answers waiting');
    expect(body?.data).toMatchObject({sealed_count:2});
  });

  it('atomically releases packs, celebrates milestones, and produces a single digest',async()=>{
    await pool.query(`insert into couple_streaks(couple_id,current_streak,longest_streak,streak_celebrated_at) values($1,7,7,0) on conflict(couple_id) do update set current_streak=7,streak_celebrated_at=0`,[couple]);
    const result=await repo.produce(new Date(Date.now()+10*60*1000),100);
    expect(result.releasedPacks).toBe(1);expect(result.streakMilestones).toBe(1);expect(result.digests).toBe(1);
    expect((await pool.query('select is_public,release_notified from question_packs where id=$1',[pack])).rows[0]).toEqual({is_public:true,release_notified:true});
    const before=(await pool.query('select count(*)::int count from operations_outbox')).rows[0].count;
    await repo.produce(new Date(Date.now()+10*60*1000),100);expect((await pool.query('select count(*)::int count from operations_outbox')).rows[0].count).toBe(before);
  });

  it('nudges only the partner who still owes an answer, in the couple evening',async()=>{
    // Alice sorts below Bob, so Alice is user1. She has answered today; Bob has not.
    await pool.query("update profiles set timezone='UTC' where couple_id=$1",[couple]);
    const evening=new Date('2026-08-27T21:00:00Z');
    await pool.query(`insert into couple_streaks(couple_id,current_streak,longest_streak,last_active_date,last_completed_date,user1_answered_today,user2_answered_today,streak_celebrated_at)
      values($1,6,6,'2026-08-27','2026-08-26',true,false,6) on conflict(couple_id) do update set current_streak=6,longest_streak=6,
      last_active_date='2026-08-27',last_completed_date='2026-08-26',user1_answered_today=true,user2_answered_today=false,streak_celebrated_at=6`,[couple]);

    expect((await repo.produce(evening,100)).streakReminders).toBe(1);
    const queued=await pool.query<{recipient_id:string;title:string;body:string}>(
      `select recipient_id,payload->>'title' title,payload->>'body' body from operations_outbox where dedupe_key like 'streak_risk:%'`);
    expect(queued.rows).toHaveLength(1);
    expect(queued.rows[0]).toMatchObject({recipient_id:bob,title:'Alice answered today'});
    expect(queued.rows[0].body).toContain('6 days in');
    expect((await pool.query('select 1 from operations_outbox where dedupe_key=$1',[`streak_risk:${couple}:2026-08-27:${bob}`])).rowCount).toBe(1);

    // A second tick inside the same couple-local evening must not queue a second nudge.
    expect((await repo.produce(evening,100)).streakReminders).toBe(0);
  });

  it('addresses both partners when neither has answered and honours the preference',async()=>{
    const next=new Date('2026-08-28T21:00:00Z');
    await pool.query(`update couple_streaks set last_active_date='2026-08-27',last_completed_date='2026-08-27',
      user1_answered_today=true,user2_answered_today=true where couple_id=$1`,[couple]);
    expect((await repo.produce(next,100)).streakReminders).toBe(2);
    const both=await pool.query<{title:string;body:string}>(
      `select payload->>'title' title,payload->>'body' body from operations_outbox where dedupe_key like $1 order by recipient_id`,
      [`streak_risk:${couple}:2026-08-28:%`]);
    expect(both.rows.map(r=>r.title)).toEqual(['Your 6-day streak','Your 6-day streak']);
    expect(both.rows[0].body).toContain('One question each');

    await pool.query(`insert into notification_preferences(user_id,streak_reminders_enabled) values($1,false),($2,false)
      on conflict(user_id) do update set streak_reminders_enabled=false`,[alice,bob]);
    await pool.query(`update couple_streaks set last_active_date='2026-08-28',last_completed_date='2026-08-28' where couple_id=$1`,[couple]);
    expect((await repo.produce(new Date('2026-08-29T21:00:00Z'),100)).streakReminders).toBe(0);
    await pool.query('update notification_preferences set streak_reminders_enabled=true where user_id in ($1,$2)',[alice,bob]);
  });

  it('uses skip-locked claims so concurrent workers never receive the same item',async()=>{
    await pool.query('insert into notification_preferences(user_id,messages_enabled) values($1,false) on conflict(user_id) do update set messages_enabled=false',[bob]);
    const [a,b]=await Promise.all([repo.claim(100),repo2.claim(100)]);const ids=[...a,...b].map(item=>item.id);expect(new Set(ids).size).toBe(ids.length);expect(ids.length).toBeGreaterThan(0);
    expect([...a,...b].find(item=>item.dedupeKey.startsWith('message:'))?.pushToken).toBeNull();
  });

  it('keeps due/unlocked outbox observation eligible for the existing due index',async()=>{
    const client=await pool.connect();
    try {
      await client.query('begin'); await client.query('set local enable_seqscan=off');
      const plan=await client.query<{"QUERY PLAN":string}>(`explain (costs off) ${OUTBOX_STATE_SQL}`);
      expect(plan.rows.map(row=>row['QUERY PLAN']).join('\n')).toContain('operations_outbox_due_idx');
    } finally { await client.query('rollback').catch(()=>undefined); client.release(); }
  });
});
