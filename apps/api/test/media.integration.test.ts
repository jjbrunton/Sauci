import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PostgresMediaRepository } from '../src/domains/media/repository.js';
import { PostgresProfileSettingsRepository } from '../src/domains/profile-settings/repository.js';

const databaseUrl=process.env.DATABASE_URL;
const local=databaseUrl ? ['127.0.0.1','localhost','::1'].includes(new URL(databaseUrl).hostname) : false;
if(databaseUrl&&!local) throw new Error('Media integration tests only permit localhost DATABASE_URL');
describe.skipIf(!databaseUrl||!local)('media repository + PostgreSQL',()=>{
  const admin=new Pool({connectionString:databaseUrl}); const schema=`media_test_${randomUUID().replaceAll('-','')}`;
  const alice='11111111-1111-4111-8111-111111111111',bob='22222222-2222-4222-8222-222222222222',outsider='33333333-3333-4333-8333-333333333333';
  const couple='44444444-4444-4444-8444-444444444444',other='55555555-5555-4555-8555-555555555555',category='66666666-6666-4666-8666-666666666666',pack='77777777-7777-4777-8777-777777777777',question='88888888-8888-4888-8888-888888888888',match='99999999-9999-4999-8999-999999999999';
  let pool:Pool,repository:PostgresMediaRepository;
  beforeAll(async()=>{
    await admin.query(`create schema "${schema}"`); const isolated=new URL(databaseUrl!); isolated.searchParams.set('options',`-c search_path=${schema}`);
    pool=new Pool({connectionString:isolated.toString()}); repository=new PostgresMediaRepository(isolated.toString());
    for(const migrationName of ['0000_identity_and_feature_interests.sql','0001_couples.sql','0002_packs_catalog_progress.sql','0003_answers_matches.sql','0004_chat.sql','0005_profile_settings.sql','0006_media_storage.sql']) {
      const migration=await readFile(new URL(`../drizzle/${migrationName}`,import.meta.url),'utf8');
      for(const statement of migration.split('--> statement-breakpoint')) if(statement.trim()) await pool.query(statement);
    }
    await pool.query('insert into couples(id,invite_code) values($1,$2),($3,$4)',[couple,'MEDIATST',other,'MEDIAOUT']);
    await pool.query('insert into profiles(id,couple_id) values($1,$3),($2,$3),($4,$5)',[alice,bob,couple,outsider,other]);
    await pool.query("insert into categories(id,name) values($1,'Media')",[category]); await pool.query("insert into question_packs(id,name,category_id) values($1,'Media',$2)",[pack,category]);
    await pool.query("insert into questions(id,pack_id,text) values($1,$2,'Share')",[question,pack]); await pool.query("insert into matches(id,couple_id,question_id,match_type) values($1,$2,$3,'yes_yes')",[match,couple,question]);
  });
  afterAll(async()=>{await repository.close();await pool.end();await admin.query(`drop schema "${schema}" cascade`);await admin.end();});
  it('allows only the owner and current partner to resolve response media',async()=>{
    const {media}=await repository.create(alice,'response','response/2026-01-01/random.jpg','image/jpeg',10,{questionId:question});
    expect((await repository.accessible(bob,media.id)).id).toBe(media.id);
    await expect(repository.accessible(outsider,media.id)).rejects.toMatchObject({code:'media_not_found'});
  });
  it('creates chat metadata and its message together after match authorization',async()=>{
    const created=await repository.create(alice,'chat','chat/2026-01-01/random.jpg','image/jpeg',10,{matchId:match});
    expect(created.message).toMatchObject({match_id:match,user_id:alice,media_path:`media:${created.media.id}`});
    await expect(repository.create(outsider,'chat','chat/2026-01-01/no.jpg','image/jpeg',10,{matchId:match})).rejects.toMatchObject({code:'match_not_found'});
  });
  it('keeps feedback screenshots owner-private and links them to feedback',async()=>{
    const {media}=await repository.create(alice,'feedback','feedback/2026-01-01/private.png','image/png',10,{});
    await expect(repository.accessible(bob,media.id)).rejects.toMatchObject({code:'media_not_found'});
    await expect(repository.accessible(outsider,media.id)).rejects.toMatchObject({code:'media_not_found'});
    const profiles=new PostgresProfileSettingsRepository((repository as any).pool.options.connectionString);
    const feedback=await profiles.submitFeedback(alice,{type:'bug',title:'Screenshot',description:'Private',screenshot_media_id:media.id});
    const linked=await pool.query('select screenshot_media_id from feedback where id=$1',[feedback.id]);
    expect(linked.rows[0].screenshot_media_id).toBe(media.id); await profiles.close();
  });
  it('queues replaced avatars and cascaded account media for retryable deletion',async()=>{
    await repository.create(alice,'avatar','avatar/2026-01-01/old.jpg','image/jpeg',10,{});
    await repository.create(alice,'avatar','avatar/2026-01-01/new.jpg','image/jpeg',10,{});
    expect(await repository.queuedDeletions(10)).toContain('avatar/2026-01-01/old.jpg');
    await pool.query('delete from profiles where id=$1',[alice]);
    expect(await repository.queuedDeletions(10)).toContain('avatar/2026-01-01/new.jpg');
  });
});
