import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PostgresAppDataRepository } from '../src/domains/app-data/repository.js';

const databaseUrl = process.env.DATABASE_URL;
const local = databaseUrl ? ['127.0.0.1', 'localhost', '::1'].includes(new URL(databaseUrl).hostname) : false;
if (databaseUrl && !local) throw new Error('App-data integration tests only permit a localhost DATABASE_URL');

describe.skipIf(!databaseUrl || !local)('app-data repository + PostgreSQL', () => {
  const admin = new Pool({ connectionString: databaseUrl }); const schema = `app_data_${randomUUID().replaceAll('-', '')}`;
  const alice='11111111-1111-4111-8111-111111111111', bob='22222222-2222-4222-8222-222222222222', outsider='33333333-3333-4333-8333-333333333333';
  const couple='44444444-4444-4444-8444-444444444444', otherCouple='55555555-5555-4555-8555-555555555555', category='66666666-6666-4666-8666-666666666666';
  const pack='77777777-7777-4777-8777-777777777777', question='88888888-8888-4888-8888-888888888888', match='99999999-9999-4999-8999-999999999999', message='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  let pool: Pool; let repo: PostgresAppDataRepository;
  beforeAll(async () => {
    await admin.query(`create schema "${schema}"`); const url=new URL(databaseUrl!); url.searchParams.set('options',`-c search_path=${schema}`);
    pool=new Pool({connectionString:url.toString()}); repo=new PostgresAppDataRepository(url.toString());
    for (const name of ['0000_identity_and_feature_interests.sql','0001_couples.sql','0002_packs_catalog_progress.sql','0003_answers_matches.sql','0004_chat.sql','0005_profile_settings.sql','0008_residual_realtime.sql']) {
      const sql=await readFile(new URL(`../drizzle/${name}`,import.meta.url),'utf8'); for(const statement of sql.split('--> statement-breakpoint')) if(statement.trim()) await pool.query(statement);
    }
    await pool.query('insert into couples(id,invite_code) values($1,$2),($3,$4)',[couple,'APDATA01',otherCouple,'APDATA02']);
    await pool.query('insert into profiles(id,couple_id,name,hide_nsfw) values($1,$4,$5,false),($2,$4,$6,false),($3,$7,$8,false)',[alice,bob,outsider,couple,'Alice','Bob',otherCouple,'Out']);
    await pool.query("insert into categories(id,name) values($1,'Visible')",[category]);
    await pool.query("insert into question_packs(id,name,category_id) values($1,'Pack',$2)",[pack,category]);
    await pool.query("insert into questions(id,pack_id,text) values($1,$2,'Question')",[question,pack]);
    await pool.query("insert into responses(id,user_id,question_id,couple_id,answer) values(gen_random_uuid(),$1,$3,$4,'yes'),(gen_random_uuid(),$2,$3,$4,'yes')",[alice,bob,question,couple]);
    await pool.query("insert into matches(id,couple_id,question_id,match_type) values($1,$2,$3,'yes_yes')",[match,couple,question]);
    await pool.query("insert into messages(id,match_id,user_id,media_path,media_type) values($1,$2,$3,'x.jpg','image')",[message,match,alice]);
  });
  afterAll(async()=>{await repo.close();await pool.end();await admin.query(`drop schema "${schema}" cascade`);await admin.end();});
  it('returns only public catalog data and couple-owned match context',async()=>{
    expect((await repo.packQuestions(alice,pack))[0]?.text).toBe('Question');
    expect((await repo.matchContext(bob,match)).responses).toHaveLength(2);
    await expect(repo.matchContext(outsider,match)).rejects.toMatchObject({status:404});
  });
  it('allows only the recipient in the owning couple to mark media viewed',async()=>{
    expect((await repo.markMediaViewed(bob,message,null)).media_viewed_at).toBeTruthy();
    await expect(repo.markMediaViewed(alice,message,null)).rejects.toMatchObject({status:404});
    await expect(repo.markMediaViewed(outsider,message,null)).rejects.toMatchObject({status:404});
  });
  it('persists drawing state per couple and rejects foreign stroke owners',async()=>{
    const stroke={id:'s1',userId:alice,points:[{x:.2,y:.3}],color:'#fff',width:2,timestamp:1,isEraser:false};
    expect((await repo.putLiveDraw(alice,[stroke],0)).revision).toBe(1);
    expect((await repo.getLiveDraw(bob)).strokes).toEqual([stroke]);
    expect((await repo.getLiveDraw(outsider)).strokes).toEqual([]);
    await expect(repo.putLiveDraw(alice,[{...stroke,userId:outsider}],1)).rejects.toMatchObject({status:403});
  });
  it('rejects one of two concurrent writes from the same base revision with current state',async()=>{
    const current=await repo.getLiveDraw(alice);
    const a={id:'concurrent-a',userId:alice,points:[{x:.1,y:.1}],color:'#fff',width:2,timestamp:2,isEraser:false};
    const b={...a,id:'concurrent-b',userId:bob};
    const results=await Promise.allSettled([
      repo.putLiveDraw(alice,[...current.strokes,a],current.revision),
      repo.putLiveDraw(bob,[...current.strokes,b],current.revision),
    ]);
    expect(results.filter(result=>result.status==='fulfilled')).toHaveLength(1);
    const rejected=results.find(result=>result.status==='rejected');
    expect(rejected).toMatchObject({status:'rejected',reason:{status:409,code:'revision_conflict',details:{current_state:{revision:current.revision+1}}}});
  });
  it('atomically records nudge cooldown before reporting a missing push token',async()=>{
    await expect(repo.sendNudge(alice)).resolves.toMatchObject({success:true,notification_sent:false,reason:'no_push_token'});
    await expect(repo.sendNudge(alice)).rejects.toMatchObject({status:429,code:'rate_limited'});
  });
});
