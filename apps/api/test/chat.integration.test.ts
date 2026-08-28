import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ChatError, PostgresChatRepository } from '../src/domains/chat/repository.js';

const databaseUrl = process.env.DATABASE_URL;
const isLocal = databaseUrl ? ['127.0.0.1', 'localhost', '::1'].includes(new URL(databaseUrl).hostname) : false;
if (databaseUrl && !isLocal) throw new Error('Chat integration tests only permit a localhost DATABASE_URL');

describe.skipIf(!databaseUrl || !isLocal)('chat repository + PostgreSQL', () => {
  const adminPool = new Pool({ connectionString: databaseUrl });
  const schema = `chat_test_${randomUUID().replaceAll('-', '')}`;
  const alice = '11111111-1111-4111-8111-111111111111';
  const bob = '22222222-2222-4222-8222-222222222222';
  const outsider = '33333333-3333-4333-8333-333333333333';
  const couple = '44444444-4444-4444-8444-444444444444';
  const otherCouple = '55555555-5555-4555-8555-555555555555';
  const category = '66666666-6666-4666-8666-666666666666';
  const pack = '77777777-7777-4777-8777-777777777777';
  const question = '88888888-8888-4888-8888-888888888888';
  const match = '99999999-9999-4999-8999-999999999999';
  let pool: Pool;
  let repository: PostgresChatRepository;

  beforeAll(async () => {
    await adminPool.query(`create schema "${schema}"`);
    const isolatedUrl = new URL(databaseUrl!);
    isolatedUrl.searchParams.set('options', `-c search_path=${schema}`);
    pool = new Pool({ connectionString: isolatedUrl.toString() });
    repository = new PostgresChatRepository(isolatedUrl.toString());
    for (const migrationName of ['0000_identity_and_feature_interests.sql', '0001_couples.sql', '0002_packs_catalog_progress.sql', '0003_answers_matches.sql', '0004_chat.sql', '0005_profile_settings.sql']) {
      const migration = await readFile(new URL(`../drizzle/${migrationName}`, import.meta.url), 'utf8');
      for (const statement of migration.split('--> statement-breakpoint')) if (statement.trim()) await pool.query(statement);
    }
    await pool.query('insert into couples (id, invite_code) values ($1, $2), ($3, $4)', [couple, 'CHATTEST', otherCouple, 'CHATOUTS']);
    await pool.query('insert into profiles (id, couple_id) values ($1, $3), ($2, $3), ($4, $5)', [alice, bob, couple, outsider, otherCouple]);
    await pool.query("insert into categories (id, name) values ($1, 'Chat')", [category]);
    await pool.query("insert into question_packs (id, name, category_id) values ($1, 'Chat', $2)", [pack, category]);
    await pool.query("insert into questions (id, pack_id, text) values ($1, $2, 'Talk')", [question, pack]);
    await pool.query("insert into matches (id, couple_id, question_id, match_type) values ($1, $2, $3, 'yes_yes')", [match, couple, question]);
  });

  afterAll(async () => {
    await repository.close(); await pool.end();
    await adminPool.query(`drop schema "${schema}" cascade`); await adminPool.end();
  });

  it('sends, lists, counts and reads text messages for couple members only', async () => {
    const sent = await repository.sendText(alice, match, 'Hello');
    expect((await repository.listMessages(bob, match))[0]?.content).toBe('Hello');
    expect(await repository.unreadCounts(bob)).toEqual({ total: 1, by_match: { [match]: 1 } });
    expect((await repository.markDelivered(bob, sent.id)).delivered_at).not.toBeNull();
    expect((await repository.markMatchRead(bob, match)).updated).toBe(1);
    await expect(repository.listMessages(outsider, match)).rejects.toMatchObject({ code: 'match_not_found' });
  });

  it('enforces per-user and author-only deletions plus reports', async () => {
    const sent = await repository.sendText(alice, match, 'Moderate me');
    await repository.deleteForSelf(bob, sent.id);
    expect((await repository.listMessages(bob, match)).some(item => item.id === sent.id)).toBe(false);
    expect((await repository.listMessages(alice, match)).some(item => item.id === sent.id)).toBe(true);
    await expect(repository.deleteForEveryone(bob, sent.id)).rejects.toMatchObject({ code: 'not_message_author' });
    expect((await repository.deleteForEveryone(alice, sent.id)).deleted_at).not.toBeNull();
    await repository.report(bob, sent.id, 'harassment');
    await expect(repository.report(bob, sent.id, 'spam')).rejects.toBeInstanceOf(ChatError);
  });

  it('stores typing state with a short expiry and exposes only the partner state', async () => {
    await repository.setTyping(alice, match, 4_000);
    expect((await repository.getPartnerTyping(bob, match)).typing).toBe(true);
    expect((await repository.getPartnerTyping(alice, match)).typing).toBe(false);
  });
});
