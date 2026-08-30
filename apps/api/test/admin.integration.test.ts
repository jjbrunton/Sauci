import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PostgresAdminRepository } from '../src/domains/admin/repository.js';

const databaseUrl = process.env.DATABASE_URL;
const isLocal = databaseUrl ? ['127.0.0.1', 'localhost', '::1'].includes(new URL(databaseUrl).hostname) : false;
if (databaseUrl && !isLocal) throw new Error('Admin integration tests only permit a localhost DATABASE_URL');

describe.skipIf(!databaseUrl || !isLocal)('admin repository authorization + audit', () => {
  const adminPool = new Pool({ connectionString: databaseUrl });
  const schema = `admin_test_${randomUUID().replaceAll('-', '')}`;
  const creatorUser = '11111111-1111-4111-8111-111111111111';
  const superUser = '22222222-2222-4222-8222-222222222222';
  const ordinaryUser = '33333333-3333-4333-8333-333333333333';
  const moderatorUser = '44444444-4444-4444-8444-444444444444';
  const responseCouple = '55555555-5555-4555-8555-555555555555';
  const responseCategory = '66666666-6666-4666-8666-666666666666';
  const responsePack = '77777777-7777-4777-8777-777777777777';
  const responseQuestion = '88888888-8888-4888-8888-888888888888';
  const responseId = '99999999-9999-4999-8999-999999999999';
  const responseMediaId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const quizCouple = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  let pool: Pool; let repository: PostgresAdminRepository;

  beforeAll(async () => {
    await adminPool.query(`create schema "${schema}"`);
    const isolated = new URL(databaseUrl!); isolated.searchParams.set('options', `-c search_path=${schema}`);
    pool = new Pool({ connectionString: isolated.toString() }); repository = new PostgresAdminRepository(isolated.toString());
    for (const name of ['0000_identity_and_feature_interests.sql','0001_couples.sql','0002_packs_catalog_progress.sql','0003_answers_matches.sql','0004_chat.sql','0005_profile_settings.sql','0006_media_storage.sql','0007_billing_redemption.sql','0008_residual_realtime.sql','0009_operations_workers.sql','0010_admin.sql','0011_question_pack_average_precision.sql','0012_catalogue_field_parity.sql','0013_dares_loop.sql','0014_daily_limit_local_reset.sql','0015_daily_limit_response_index.sql','0016_couple_streak_locality.sql','0017_streak_reminder_preference.sql','0018_cutover_source_parity.sql','0019_quiz.sql','0020_quiz_question_pool.sql']) {
      const migration = await readFile(new URL(`../drizzle/${name}`, import.meta.url), 'utf8');
      for (const statement of migration.split('--> statement-breakpoint')) if (statement.trim()) await pool.query(statement);
    }
    await pool.query('insert into profiles(id,name) values($1,$5),($2,$6),($3,$7),($4,$8)', [creatorUser, superUser, ordinaryUser, moderatorUser, 'Creator', 'Super', 'User', 'Moderator']);
    await pool.query("insert into admin_users(user_id,role,permissions) values($1,'pack_creator',array['manage_packs']),($2,'super_admin','{}'),($3,'pack_creator',array['view_chats','view_media'])", [creatorUser, superUser, moderatorUser]);
  });

  afterAll(async () => { await repository.close(); await pool.end(); await adminPool.query(`drop schema "${schema}" cascade`); await adminPool.end(); });

  it('denies ordinary authenticated users and permission escalation', async () => {
    await expect(repository.principal(ordinaryUser)).rejects.toMatchObject({ code: 'admin_access_denied' });
    const creator = await repository.principal(creatorUser);
    await expect(repository.query(creator, 'profiles', {})).rejects.toMatchObject({ code: 'forbidden' });
    await expect(repository.query(creator, 'audit_logs', {})).rejects.toMatchObject({ code: 'forbidden' });
  });

  it('allows content permissions but isolates privileged resources', async () => {
    const creator = await repository.principal(creatorUser);
    const inserted = await repository.insert(creator, 'question_packs', [{ name: 'Creator pack' }]);
    const result = await repository.query(creator, 'question_packs', { filters: [{ column: 'id', op: 'eq', value: inserted[0]!.id }] });
    expect(result).toMatchObject({ count: 1, rows: [expect.objectContaining({ name: 'Creator pack' })] });
  });

  it('writes immutable audit evidence in the same transaction as mutations', async () => {
    const creator = await repository.principal(creatorUser);
    const [pack] = await repository.insert(creator, 'question_packs', [{ name: 'Audited pack' }]);
    await repository.update(creator, 'question_packs', String(pack!.id), { name: 'Updated pack' });
    await repository.delete(creator, 'question_packs', String(pack!.id));
    const audit = await pool.query('select action,actor_user_id,old_values,new_values from audit_logs where record_id=$1 order by created_at', [pack!.id]);
    expect(audit.rows.map(row => row.action)).toEqual(['INSERT', 'UPDATE', 'DELETE']);
    expect(audit.rows.every(row => row.actor_user_id === creatorUser)).toBe(true);
    expect(audit.rows[1]).toMatchObject({ old_values: expect.objectContaining({ name: 'Audited pack' }), new_values: expect.objectContaining({ name: 'Updated pack' }) });
  });

  it('preserves legacy AI config columns while redacting provider credentials from audit logs', async () => {
    const principal = await repository.principal(superUser);
    const [config] = await repository.insert(principal, 'ai_config', [{
      openrouter_api_key: 'sk-sensitive', default_model: 'openai/gpt-4o-mini',
      model_generate: 'anthropic/claude-3.5-sonnet', classifier_enabled: true,
      heuristics_enabled: true, heuristic_min_text_length: 18,
    }]);
    expect(config).toMatchObject({
      openrouter_api_key: 'sk-sensitive', model_generate: 'anthropic/claude-3.5-sonnet',
      classifier_enabled: true, heuristics_enabled: true, heuristic_min_text_length: 18,
    });
    const audit = await pool.query("select new_values from audit_logs where table_name='ai_config' and record_id=$1", [config!.id]);
    expect(audit.rows[0]?.new_values).toMatchObject({ openrouter_api_key: '[REDACTED]', default_model: 'openai/gpt-4o-mini' });
  });

  it('grants super admins read access without trusting client role claims', async () => {
    const principal = await repository.principal(superUser);
    expect((await repository.query(principal, 'profiles', {})).count).toBe(4);
    expect((await repository.query(principal, 'audit_logs', {})).count).toBeGreaterThan(0);
  });

  it('honors validated projections and never returns generic secret-bearing fields', async () => {
    await pool.query("update profiles set push_token='ExponentPushToken[secret]',public_key_jwk='{\"kty\":\"RSA\"}' where id=$1", [ordinaryUser]);
    const principal = await repository.principal(superUser);
    const projected = await repository.query(principal, 'profiles', { columns: ['id', 'name'], filters: [{ column: 'id', op: 'eq', value: ordinaryUser }] });
    expect(projected.rows).toEqual([{ id: ordinaryUser, name: 'User' }]);
    const defaultRow = (await repository.query(principal, 'profiles', { filters: [{ column: 'id', op: 'eq', value: ordinaryUser }] })).rows[0]!;
    expect(defaultRow).not.toHaveProperty('push_token');
    expect(defaultRow).not.toHaveProperty('public_key_jwk');
    await expect(repository.query(principal, 'profiles', { columns: ['id', 'push_token'] })).rejects.toMatchObject({ code: 'restricted_column' });
  });

  it('supports null-safe filters and scoped feature-interest aggregates', async () => {
    await pool.query("insert into feature_interests(user_id,feature) values($1,'better-chat'),($2,'better-chat')", [creatorUser, ordinaryUser]);
    const principal = await repository.principal(superUser);
    expect((await repository.query(principal, 'profiles', { filters: [{ column: 'email', op: 'neq', value: null }] })).count).toBe(0);
    expect(await repository.featureInterestCounts(principal)).toEqual([{
      feature_name: 'better-chat', opt_in_count: 2, opt_in_count_last_7_days: 2,
    }]);
  });

  it('gifts premium atomically and audits the explicit service action', async () => {
    const principal = await repository.principal(superUser);
    const result = await repository.giftPremium(principal, ordinaryUser, 30, 'support grant');
    expect(result.subscription_id).toEqual(expect.any(String));
    expect((await pool.query('select is_premium from profiles where id=$1', [ordinaryUser])).rows[0]?.is_premium).toBe(true);
    expect((await pool.query("select new_values from audit_logs where record_id=$1 and action='ACTION'", [result.subscription_id])).rows[0]?.new_values).toMatchObject({ action: 'gift_premium', target_user_id: ordinaryUser, days: 30 });
  });

  it('supports lifetime gifts without inventing an expiry', async () => {
    const principal = await repository.principal(superUser);
    const result = await repository.giftPremium(principal, ordinaryUser, null, 'lifetime support grant');
    expect(result.expires_at).toBeNull();
    expect((await pool.query('select expires_at from subscriptions where id=$1', [result.subscription_id])).rows[0]?.expires_at).toBeNull();
  });

  it('gates message moderation and media access independently from AI configuration', async () => {
    const creator = await repository.principal(creatorUser);
    const moderator = await repository.principal(moderatorUser);
    await expect(repository.query(creator, 'messages', {})).rejects.toMatchObject({ code: 'forbidden' });
    await expect(repository.query(creator, 'message_reports', {})).rejects.toMatchObject({ code: 'forbidden' });
    expect((await repository.query(moderator, 'messages', {})).count).toBe(0);
    expect((await repository.query(moderator, 'message_reports', {})).count).toBe(0);
    await expect(repository.authorizeMedia(creator, randomUUID())).rejects.toMatchObject({ code: 'forbidden' });
    await expect(repository.authorizeMedia(moderator, randomUUID())).rejects.toMatchObject({ code: 'media_not_found' });
  });

  it('requires view_responses and resolves only media linked to the response owner and couple', async () => {
    await pool.query('insert into couples(id,invite_code) values($1,$2)', [responseCouple, 'ADMINMED']);
    await pool.query('update profiles set couple_id=$2 where id=$1', [ordinaryUser, responseCouple]);
    await pool.query("insert into categories(id,name) values($1,'Response media')", [responseCategory]);
    await pool.query("insert into question_packs(id,name,category_id) values($1,'Response media',$2)", [responsePack, responseCategory]);
    await pool.query("insert into questions(id,pack_id,text,question_type) values($1,$2,'Share a photo','photo')", [responseQuestion, responsePack]);
    await pool.query(
      `insert into media_objects(id,owner_id,couple_id,kind,storage_key,mime_type,byte_size,question_id)
       values($1,$2,$3,'response','response/test.jpg','image/jpeg',14,$4)`,
      [responseMediaId, ordinaryUser, responseCouple, responseQuestion],
    );
    await pool.query(
      `insert into responses(id,user_id,question_id,couple_id,answer,response_data)
       values($1,$2,$3,$4,'yes',$5)`,
      [responseId, ordinaryUser, responseQuestion, responseCouple, { type: 'photo', media_path: `media:${responseMediaId}` }],
    );

    const creator = await repository.principal(creatorUser);
    const moderatorWithoutPermission = await repository.principal(moderatorUser);
    await expect(repository.responseMedia(creator, responseId)).rejects.toMatchObject({ code: 'forbidden' });
    await expect(repository.responseMedia(moderatorWithoutPermission, responseId)).rejects.toMatchObject({ code: 'forbidden' });

    await pool.query("update admin_users set permissions=array_append(permissions,'view_responses') where user_id=$1", [moderatorUser]);
    const responseViewer = await repository.principal(moderatorUser);
    await expect(repository.responseMedia(responseViewer, responseId)).resolves.toEqual({
      storageKey: 'response/test.jpg', mimeType: 'image/jpeg',
    });

    await pool.query('update media_objects set owner_id=$2 where id=$1', [responseMediaId, superUser]);
    await expect(repository.responseMedia(responseViewer, responseId)).rejects.toMatchObject({ code: 'response_media_not_found' });
  });

  it('exposes writable quiz content and read-only quiz activity resources', async () => {
    await pool.query('insert into couples(id,invite_code) values($1,$2)', [quizCouple, 'QUIZADMN']);
    await pool.query("update admin_users set permissions=array_append(permissions,'manage_questions') where user_id=$1", [creatorUser]);
    const creator = await repository.principal(creatorUser);
    const [question] = await repository.insert(creator, 'quiz_questions', [{
      prompt_self: 'How do you show affection?', prompt_guess: 'How does your partner show affection?', options: ['Touch', 'Words'],
    }]);
    expect(question).toMatchObject({ prompt_self: 'How do you show affection?' });

    const principal = await repository.principal(superUser);
    const listed = await repository.query(principal, 'quiz_questions', { filters: [{ column: 'id', op: 'eq', value: question!.id }] });
    expect(listed.count).toBe(1);
    expect((await repository.query(principal, 'quiz_sessions', {})).count).toBe(0);
    await expect(repository.insert(principal, 'quiz_sessions', [{
      couple_id: quizCouple, status: 'active', question_ids: [question!.id],
    }])).rejects.toMatchObject({ code: 'forbidden' });
  });

  it('reads sent dares for user support visibility without granting write access', async () => {
    await pool.query(
      `insert into sent_dares(couple_id,custom_dare_text,dare_text_snapshot,dare_intensity_snapshot,sender_id,recipient_id,status)
       values($1,'Give a compliment','Give a compliment',2,$2,$3,'pending')`,
      [quizCouple, creatorUser, moderatorUser],
    );
    const principal = await repository.principal(superUser);
    const result = await repository.query(principal, 'sent_dares', {});
    expect(result.count).toBe(1);
    expect(result.rows[0]).toMatchObject({ dare_text_snapshot: 'Give a compliment' });
    await expect(repository.insert(principal, 'sent_dares', [{
      couple_id: quizCouple, custom_dare_text: 'x', dare_text_snapshot: 'x',
      dare_intensity_snapshot: 1, sender_id: creatorUser, recipient_id: moderatorUser, status: 'pending',
    }])).rejects.toMatchObject({ code: 'forbidden' });
  });

  it('reads notification preferences for user support visibility without granting write access', async () => {
    await pool.query(
      "insert into notification_preferences(user_id,matches_enabled,dares_enabled) values($1,true,false)",
      [creatorUser],
    );
    const principal = await repository.principal(superUser);
    const result = await repository.query(principal, 'notification_preferences', {
      filters: [{ column: 'user_id', op: 'eq', value: creatorUser }],
    });
    expect(result).toMatchObject({ count: 1, rows: [expect.objectContaining({ matches_enabled: true, dares_enabled: false })] });
    await expect(repository.insert(principal, 'notification_preferences', [{
      user_id: moderatorUser,
    }])).rejects.toMatchObject({ code: 'forbidden' });
  });

  it('creates all legacy admin and dare cutover tables with preserved foreign keys', async () => {
    const tables = await pool.query<{ table_name: string }>(
      `select table_name from information_schema.tables where table_schema=current_schema()
       and table_name=any($1::text[]) order by table_name`,
      [['admin_users','audit_logs','topics','pack_topics','ai_config','dare_packs','dares','master_keys','sent_dares','dare_messages']],
    );
    expect(tables.rows.map(row => row.table_name)).toEqual([
      'admin_users','ai_config','audit_logs','dare_messages','dare_packs','dares','master_keys','pack_topics','sent_dares','topics',
    ]);
    const fks = await pool.query<{ constraint_name: string }>(
      `select constraint_name from information_schema.table_constraints
       where table_schema=current_schema() and constraint_type='FOREIGN KEY'
       and table_name in ('sent_dares','dare_messages')`,
    );
    expect(fks.rows).toHaveLength(6);
    expect((await pool.query(`select column_name from information_schema.columns where table_schema=current_schema() and table_name='feedback' and column_name='admin_notes'`)).rowCount).toBe(1);
  });
});
