import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { Pool } from 'pg';
import { afterAll,beforeAll,describe,expect,it } from 'vitest';
import { PostgresAnswersRepository } from '../src/domains/answers/repository.js';
const url=process.env.DATABASE_URL;const local=url?['127.0.0.1','localhost','::1'].includes(new URL(url).hostname):false;if(url&&!local)throw new Error('Answer integration tests only permit localhost');
describe.skipIf(!url||!local)('answers + PostgreSQL',()=>{const admin=new Pool({connectionString:url});const schema=`answers_${randomUUID().replaceAll('-','')}`;let pool:Pool;let repo:PostgresAnswersRepository;
const u1='11111111-1111-4111-8111-111111111111',u2='22222222-2222-4222-8222-222222222222',outsider='33333333-3333-4333-8333-333333333333',couple='44444444-4444-4444-8444-444444444444',other='55555555-5555-4555-8555-555555555555',pack='66666666-6666-4666-8666-666666666666',q='77777777-7777-4777-8777-777777777777',concurrentQ='88888888-8888-4888-8888-888888888888',femaleOnlyQ='99999999-9999-4999-8999-999999999999',limitQ1='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',limitQ2='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',catchUpQ='cccccccc-cccc-4ccc-8ccc-cccccccccccc',solo='dddddddd-dddd-4ddd-8ddd-dddddddddddd',soloQ1='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',soloQ2='ffffffff-ffff-4fff-8fff-ffffffffffff';
beforeAll(async()=>{await admin.query(`create schema "${schema}"`);const isolated=new URL(url!);isolated.searchParams.set('options',`-c search_path=${schema}`);pool=new Pool({connectionString:isolated.toString()});repo=new PostgresAnswersRepository(isolated.toString());for(const name of ['0000_identity_and_feature_interests.sql','0001_couples.sql','0002_packs_catalog_progress.sql','0003_answers_matches.sql','0004_chat.sql','0014_daily_limit_local_reset.sql','0015_daily_limit_response_index.sql','0016_couple_streak_locality.sql','0021_solo_sealed_answers.sql']){const sql=await readFile(new URL(`../drizzle/${name}`,import.meta.url),'utf8');for(const s of sql.split('--> statement-breakpoint'))if(s.trim())await pool.query(s);}await pool.query('insert into couples(id,invite_code) values($1,$2),($3,$4)',[couple,'ANSWERS1',other,'ANSWERS2']);await pool.query("insert into profiles(id,couple_id,gender,max_intensity) values($1,$4,'female',5),($2,$4,'male',3),($3,$5,'male',5)",[u1,u2,outsider,couple,other]);await pool.query("insert into profiles(id,gender,max_intensity) values($1,null,5)",[solo]);await pool.query("insert into question_packs(id,name) values($1,'Core')",[pack]);await pool.query("insert into questions(id,pack_id,text,intensity,target_user_genders) values($1,$2,'Question',3,array['female']),($3,$2,'Concurrent',2,null),($4,$2,'Female first',2,array['female']),($5,$2,'Limit one',2,null),($6,$2,'Limit two',2,null),($7,$2,'Catch up',2,null),($8,$2,'Solo one',2,null),($9,$2,'Solo two',2,null)",[q,pack,concurrentQ,femaleOnlyQ,limitQ1,limitQ2,catchUpQ,soloQ1,soloQ2]);await pool.query('insert into couple_packs(couple_id,pack_id,enabled) values($1,$2,true)',[couple,pack]);});afterAll(async()=>{await repo.close();await pool.end();await admin.query(`drop schema "${schema}" cascade`);await admin.end();});
it('targets recommendation by gender and excludes completed responses',async()=>{expect((await repo.recommended(u1)).map(x=>x.id)).toContain(q);expect((await repo.recommended(u2)).map(x=>x.id)).not.toContain(q);await repo.submit(u1,{questionId:q,answer:'yes'});expect((await repo.recommended(u1)).map(x=>x.id)).not.toContain(q);});
it('rejects direct answers that bypass target-gender eligibility',async()=>{await expect(repo.submit(u2,{questionId:femaleOnlyQ,answer:'yes'})).rejects.toMatchObject({code:'question_not_eligible'});});
it('serializes concurrent partner submissions and still creates one match',async()=>{await Promise.all([repo.submit(u1,{questionId:concurrentQ,answer:'yes'}),repo.submit(u2,{questionId:concurrentQ,answer:'yes'})]);const counts=await pool.query('select count(*)::int count from matches where question_id=$1',[concurrentQ]);expect(counts.rows[0].count).toBe(1);});
it('is idempotent and creates one match only after both partners answer',async()=>{await repo.submit(u1,{questionId:q,answer:'yes'});expect((await repo.submit(u1,{questionId:q,answer:'maybe'})).match).toBeNull();const second=await repo.submit(u2,{questionId:q,answer:'yes'});expect(second.match?.match_type).toBe('yes_maybe');await repo.submit(u2,{questionId:q,answer:'yes'});const counts=await pool.query('select (select count(*) from responses where question_id=$1) responses,(select count(*) from matches where question_id=$1) matches',[q]);expect(counts.rows[0]).toMatchObject({responses:'2',matches:'1'});});
it('requires confirmation before destroying a match and isolates outsiders',async()=>{const pending=await repo.update(u1,{questionId:q,answer:'no',confirmDeleteMatch:false});expect(pending).toMatchObject({success:false,requires_confirmation:true,message_count:0});expect(await repo.update(u1,{questionId:q,answer:'no',confirmDeleteMatch:true})).toMatchObject({success:true,match_deleted:true});await expect(repo.archive(outsider,'88888888-8888-4888-8888-888888888888',true)).rejects.toMatchObject({code:'match_not_found'});});
it('records both partners once per day and increments on a consecutive day',async()=>{await repo.submit(u1,{questionId:q,answer:'yes'});await repo.submit(u2,{questionId:q,answer:'yes'});expect(await repo.streak(u1)).toMatchObject({current_streak:1,longest_streak:1,you_answered_today:true,partner_answered_today:true});await pool.query("update couple_streaks set current_streak=1,longest_streak=1,last_active_date=current_date-1,last_completed_date=current_date-1,user1_answered_today=false,user2_answered_today=false where couple_id=$1",[couple]);await repo.submit(u1,{questionId:q,answer:'yes'});await repo.submit(u2,{questionId:q,answer:'yes'});expect(await repo.streak(u1)).toMatchObject({current_streak:2,longest_streak:2});});
it('answers the streak from the caller side rather than by stored position',async()=>{await pool.query("update profiles set name='Alex' where id=$1",[u2]);await pool.query("update profiles set name='Sam' where id=$1",[u1]);await pool.query('delete from responses where couple_id=$1',[couple]);await pool.query('delete from matches where couple_id=$1',[couple]);await pool.query("update couple_streaks set current_streak=0,last_active_date=null,last_completed_date=null,user1_answered_today=false,user2_answered_today=false where couple_id=$1",[couple]);
  await repo.submit(u1,{questionId:q,answer:'yes'});
  expect(await repo.streak(u1)).toMatchObject({you_answered_today:true,partner_answered_today:false,partner_name:'Alex',current_streak:0});
  expect(await repo.streak(u2)).toMatchObject({you_answered_today:false,partner_answered_today:true,partner_name:'Sam',current_streak:0});});

describe('match pagination',()=>{
  const paged=Array.from({length:5},(_,index)=>`d0000000-0000-4000-8000-00000000000${index}`);
  const pagedQuestions=Array.from({length:5},(_,index)=>`f0000000-0000-4000-8000-00000000000${index}`);
  const otherMatch='e0000000-0000-4000-8000-000000000000';
  beforeAll(async()=>{
    await pool.query('delete from match_archives');await pool.query('delete from messages');await pool.query('delete from matches');
    // One question per match: a couple may only match a given question once.
    for(const[index,id]of pagedQuestions.entries())await pool.query("insert into questions(id,pack_id,text,intensity) values($1,$2,$3,2)",[id,pack,`Paged ${index}`]);
    // Distinct creation times so the ordering assertion is about the query, not tie-breaking.
    for(const[index,id]of paged.entries())await pool.query("insert into matches(id,couple_id,question_id,match_type,created_at) values($1,$2,$3,'yes_yes',now()-($4::text||' minutes')::interval)",[id,couple,pagedQuestions[index],String(index)]);
    // A match belonging to another couple must never appear, whatever the page.
    await pool.query("insert into matches(id,couple_id,question_id,match_type) values($1,$2,$3,'yes_yes')",[otherMatch,other,q]);
    // Two unread from the partner on the oldest match; one message of our own, which is never unread.
    await pool.query("insert into messages(match_id,user_id,content) values($1,$2,'a'),($1,$2,'b'),($1,$3,'mine')",[paged[4],u2,u1]);
  });

  it('counts once on the first page, never again, and still reports hasMore',async()=>{
    const first=await repo.matches(u1,0,2,false);
    expect(first.totalCount).toBe(5);
    expect(first.hasMore).toBe(true);
    expect(first.matches).toHaveLength(2);

    // Later pages skip the count entirely: the client already has it and paging
    // is decided by hasMore, which comes from reading limit + 1 rows.
    const second=await repo.matches(u1,1,2,false);
    expect(second.totalCount).toBeNull();
    expect(second.hasMore).toBe(true);
    const last=await repo.matches(u1,2,2,false);
    expect(last.totalCount).toBeNull();
    expect(last.hasMore).toBe(false);
    expect(last.matches).toHaveLength(1);

    // An exactly-full final page must not claim another page exists.
    expect(await repo.matches(u1,0,5,false)).toMatchObject({hasMore:false,totalCount:5});
  });

  it('keeps unread-first ordering, aggregates unread once, and isolates the other couple',async()=>{
    const page=await repo.matches(u1,0,5,false);
    // The unread match sorts ahead of newer ones; the rest stay newest-first.
    expect(page.matches.map(item=>item.id)).toEqual([paged[4],paged[0],paged[1],paged[2],paged[3]]);
    expect(page.matches[0]).toMatchObject({unreadCount:2});
    // Our own message is not unread to us, and everything else is zero.
    expect(page.matches.slice(1).every(item=>item.unreadCount===0)).toBe(true);
    // Unread is per viewer: the partner's own two messages are not unread to them,
    // but ours is, so the same thread reports a different count on each side.
    expect((await repo.matches(u2,0,5,false)).matches.find(item=>item.id===paged[4])?.unreadCount).toBe(1);
    // The other couple's match is invisible here, and their member sees only theirs.
    expect(page.matches.some(item=>item.id===otherMatch)).toBe(false);
    expect((await repo.matches(outsider,0,5,false)).matches.map(item=>item.id)).toEqual([otherMatch]);
  });

  it('pages the archived view separately and per user',async()=>{
    await repo.archive(u1,paged[0],true);
    const active=await repo.matches(u1,0,5,false);
    expect(active.matches.some(item=>item.id===paged[0])).toBe(false);
    expect(active.totalCount).toBe(4);
    const archived=await repo.matches(u1,0,5,true);
    expect(archived.matches.map(item=>item.id)).toEqual([paged[0]]);
    expect(archived).toMatchObject({totalCount:1,hasMore:false});
    // Archiving is per user, so the partner still sees it in their active list.
    expect((await repo.matches(u2,0,5,false)).matches.some(item=>item.id===paged[0])).toBe(true);
    await repo.archive(u1,paged[0],false);
  });
});

it('counts the day in the couple shared zone and prefers the first reported member zone',async()=>{await pool.query('update profiles set timezone=$2 where id=$1',[u1,'Pacific/Auckland']);await pool.query('update profiles set timezone=$2 where id=$1',[u2,'America/Los_Angeles']);
  await pool.query('delete from responses where couple_id=$1',[couple]);await pool.query('delete from matches where couple_id=$1',[couple]);
  await repo.submit(u1,{questionId:q,answer:'yes'});
  const expected=await pool.query<{day:string}>("select (now() at time zone 'Pacific/Auckland')::date::text as day");
  expect(await repo.streak(u1)).toMatchObject({timezone:'Pacific/Auckland',last_active_date:expected.rows[0].day});
  // The lower member id decides the zone, so an unreported zone there falls through to the partner.
  await pool.query('update profiles set timezone=null where id=$1',[u1]);
  expect((await repo.streak(u1))?.timezone).toBe('America/Los_Angeles');
  await pool.query("update profiles set timezone='Not/AZone' where id=$1",[u1]);
  expect((await repo.streak(u1))?.timezone).toBe('UTC');
  await pool.query('update profiles set timezone=null where couple_id=$1',[couple]);});

it('reports a lapsed streak as broken before the next answer rewrites it',async()=>{await pool.query('update profiles set timezone=null where couple_id=$1',[couple]);await pool.query("update couple_streaks set current_streak=5,longest_streak=9,last_active_date=current_date-3,last_completed_date=current_date-3,user1_answered_today=true,user2_answered_today=true where couple_id=$1",[couple]);
  expect(await repo.streak(u1)).toMatchObject({current_streak:0,longest_streak:9,you_answered_today:false,partner_answered_today:false});
  // A streak completed yesterday is still alive and still shows its count.
  await pool.query('update couple_streaks set last_completed_date=current_date-1,last_active_date=current_date-1 where couple_id=$1',[couple]);
  expect(await repo.streak(u1)).toMatchObject({current_streak:5,you_answered_today:false});});

const resetLimit=async(limit:number,timezone:string|null=null)=>{await pool.query('delete from responses where couple_id=$1',[couple]);await pool.query('delete from matches where couple_id=$1',[couple]);await pool.query('update app_config set daily_response_limit=$1',[limit]);await pool.query('update profiles set timezone=$2 where id=$1',[u1,timezone]);};
it('serializes the daily limit across different questions',async()=>{await resetLimit(1);const results=await Promise.allSettled([repo.submit(u1,{questionId:limitQ1,answer:'yes'}),repo.submit(u1,{questionId:limitQ2,answer:'yes'})]);expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);expect(results.filter(r=>r.status==='rejected')).toHaveLength(1);expect(await repo.dailyLimit(u1)).toMatchObject({responses_today:1,remaining:0,is_blocked:true});});
it('exempts catching up on a question the partner answered first',async()=>{await resetLimit(1);await repo.submit(u2,{questionId:catchUpQ,answer:'yes'});await repo.submit(u1,{questionId:limitQ1,answer:'yes'});expect(await repo.dailyLimit(u1)).toMatchObject({responses_today:1,is_blocked:true});await expect(repo.submit(u1,{questionId:catchUpQ,answer:'yes'})).resolves.toBeTruthy();expect(await repo.dailyLimit(u1)).toMatchObject({responses_today:1,is_blocked:true});await expect(repo.submit(u1,{questionId:limitQ2,answer:'yes'})).rejects.toMatchObject({code:'daily_limit'});});
it('reports the daily limit error with the shape the client renders',async()=>{await resetLimit(1);await repo.submit(u1,{questionId:limitQ1,answer:'yes'});await expect(repo.submit(u1,{questionId:limitQ2,answer:'yes'})).rejects.toMatchObject({code:'daily_limit',status:429,details:{daily_limit:1,responses_today:1,remaining:0}});});
it('buckets the window on the user local day and falls back to UTC',async()=>{await resetLimit(5,'Pacific/Auckland');const nz=await repo.dailyLimit(u1);const nzBoundary=await pool.query<{expected:string}>("select ((date_trunc('day',now() at time zone 'Pacific/Auckland')+interval '1 day') at time zone 'Pacific/Auckland') expected");expect(nz.reset_at).toBe(new Date(nzBoundary.rows[0].expected).toISOString());
  const utcBoundary=await pool.query<{expected:string}>("select ((date_trunc('day',now() at time zone 'UTC')+interval '1 day') at time zone 'UTC') expected");
  for(const zone of [null,'Not/AZone']){await pool.query('update profiles set timezone=$2 where id=$1',[u1,zone]);expect((await repo.dailyLimit(u1)).reset_at).toBe(new Date(utcBoundary.rows[0].expected).toISOString());}});
it('blocks pack browsing once the limit is reached',async()=>{await resetLimit(1);expect((await repo.recommended(u1,pack)).length).toBeGreaterThan(0);await repo.submit(u1,{questionId:limitQ1,answer:'yes'});expect(await repo.recommended(u1,pack)).toEqual([]);expect(await repo.recommended(u1)).toEqual([]);await resetLimit(0);});

describe('solo answering before a couple exists',()=>{
  it('recommends questions to an unpaired user instead of a no_couple error',async()=>{
    const questions=await repo.recommended(solo);
    expect(questions.map(x=>x.id)).toContain(soloQ1);
  });
  it('banks a solo answer with no couple, skips match reconciliation, and reports the sealed count',async()=>{
    const first=await repo.submit(solo,{questionId:soloQ1,answer:'yes'});
    expect(first.match).toBeNull();
    expect(first.sealed_count).toBe(1);
    const stored=await pool.query('select couple_id from responses where user_id=$1 and question_id=$2',[solo,soloQ1]);
    expect(stored.rows[0].couple_id).toBeNull();

    const second=await repo.submit(solo,{questionId:soloQ2,answer:'maybe'});
    expect(second.match).toBeNull();
    expect(second.sealed_count).toBe(2);
  });
  it('lets a solo answerer edit a sealed answer without a couple to reconcile against',async()=>{
    await expect(repo.update(solo,{questionId:soloQ1,answer:'no',responseData:undefined,confirmDeleteMatch:false})).resolves.toMatchObject({success:true});
  });
});
});
