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
    expect((await repository.listMessages(bob, match)).messages[0]?.content).toBe('Hello');
    expect(await repository.unreadCounts(bob)).toEqual({ total: 1, by_match: { [match]: 1 } });
    expect((await repository.markDelivered(bob, sent.id)).delivered_at).not.toBeNull();
    expect((await repository.markMatchRead(bob, match)).updated).toBe(1);
    await expect(repository.listMessages(outsider, match)).rejects.toMatchObject({ code: 'match_not_found' });
  });

  it('enforces per-user and author-only deletions plus reports', async () => {
    const sent = await repository.sendText(alice, match, 'Moderate me');
    await repository.deleteForSelf(bob, sent.id);
    expect((await repository.listMessages(bob, match)).messages.some(item => item.id === sent.id)).toBe(false);
    expect((await repository.listMessages(alice, match)).messages.some(item => item.id === sent.id)).toBe(true);
    await expect(repository.deleteForEveryone(bob, sent.id)).rejects.toMatchObject({ code: 'not_message_author' });
    expect((await repository.deleteForEveryone(alice, sent.id)).deleted_at).not.toBeNull();
    await repository.report(bob, sent.id, 'harassment');
    await expect(repository.report(bob, sent.id, 'spam')).rejects.toBeInstanceOf(ChatError);
  });

  it('answers a delta with only what changed, and the same rows a full read would give', async () => {
    const before = await repository.listMessages(bob, match);
    const cursor = before.server_time;
    expect(before.complete).toBe(true);

    // Nothing has happened since the cursor, so the delta carries no row the client
    // has not already seen. The cursor is deliberately held a couple of seconds
    // behind wall clock so a write racing the read is repeated rather than lost;
    // that repetition is absorbed by merging on id, never by blanking the thread.
    const known = new Set(before.messages.map(item => item.id));
    const quiet = await repository.listMessages(bob, match, { since: cursor });
    expect(quiet.complete).toBe(false);
    expect(quiet.messages.every(item => known.has(item.id))).toBe(true);
    expect(quiet.removed_ids?.every(id => !known.has(id))).toBe(true);

    const fresh = await repository.sendText(alice, match, 'Delta arrival');
    const delta = await repository.listMessages(bob, match, { since: cursor });
    expect(delta.messages.map(item => item.id)).toContain(fresh.id);
    // Media and moderation columns must survive the narrower query.
    expect(delta.messages.find(item => item.id === fresh.id)).toMatchObject({
      content: 'Delta arrival', media_path: null, media_type: null, media_expired: false, read_at: null,
    });

    // A status change with no new row still reaches the sender through the delta.
    const afterSend = await repository.listMessages(alice, match);
    await repository.markMatchRead(bob, match);
    const readDelta = await repository.listMessages(alice, match, { since: afterSend.server_time });
    expect(readDelta.messages.find(item => item.id === fresh.id)?.read_at).not.toBeNull();

    // So does a deletion, which arrives as a removal rather than a silent gap.
    const doomed = await repository.sendText(alice, match, 'Delete me');
    const beforeDelete = await repository.listMessages(bob, match);
    await repository.deleteForSelf(bob, doomed.id);
    const removal = await repository.listMessages(bob, match, { since: beforeDelete.server_time });
    expect(removal.removed_ids).toContain(doomed.id);

    // Ordering is the contract the screen renders against: newest first, both ways.
    const full = await repository.listMessages(bob, match);
    const timestamps = full.messages.map(item => Date.parse(item.created_at));
    expect([...timestamps].sort((a, b) => b - a)).toEqual(timestamps);

    // Access control is unchanged on the delta path.
    await expect(repository.listMessages(outsider, match, { since: cursor })).rejects.toMatchObject({ code: 'match_not_found' });
  });

  it('surfaces an expiring video to a chat that is already open, and only in the window it expires', async () => {
    // Expiry is the one visible change no write announces: the deadline simply
    // passes. Backdated so neither `created_at` nor `media_viewed_at` can be what
    // puts the row in a delta — only the deadline crossing may.
    const video = await repository.sendText(alice, match, 'Sent a video');
    await pool.query(
      `update messages
          set media_path = 'media:expiring', media_type = 'video',
              moderation_status = 'safe', encrypted_content = 'cipher', encryption_iv = 'iv',
              created_at = now() - interval '1 hour',
              media_viewed_at = now() - interval '1 hour',
              media_expires_at = now() + interval '1 hour'
        where id = $1`,
      [video.id],
    );

    const before = await repository.listMessages(bob, match);
    expect(before.messages.find(item => item.id === video.id)).toMatchObject({ media_expired: false });

    // A deadline still in the future is not a change, so the row is not re-sent on
    // every poll until it arrives.
    const quiet = await repository.listMessages(bob, match, { since: before.server_time });
    expect(quiet.messages.some(item => item.id === video.id)).toBe(false);

    // The deadline now falls inside this poll's window.
    await pool.query(`update messages set media_expires_at = now() - interval '1 second' where id = $1`, [video.id]);
    const delta = await repository.listMessages(bob, match, { since: before.server_time });
    const expired = delta.messages.find(item => item.id === video.id);
    // Media, encryption and moderation columns still arrive whole on the delta path.
    expect(expired).toMatchObject({
      media_expired: true, media_type: 'video', media_path: 'media:expiring',
      moderation_status: 'safe', encrypted_content: 'cipher', encryption_iv: 'iv',
    });
    expect(expired?.media_expires_at).not.toBeNull();
    expect(expired?.media_viewed_at).not.toBeNull();

    // A full read agrees, so leaving and re-entering the chat shows the same thing.
    expect((await repository.listMessages(bob, match)).messages.find(item => item.id === video.id))
      .toMatchObject({ media_expired: true });
  });

  it('folds the partner typing check into the message read when asked', async () => {
    await repository.setTyping(alice, match, 4_000);
    const withTyping = await repository.listMessages(bob, match, { includeTyping: true });
    expect(withTyping.typing?.typing).toBe(true);
    // Own typing is never reflected back, so the sender does not see themselves.
    expect((await repository.listMessages(alice, match, { includeTyping: true })).typing?.typing).toBe(false);
    // And it stays absent unless requested, so the default read costs no extra work.
    expect((await repository.listMessages(bob, match)).typing).toBeUndefined();
  });

  it('stores typing state with a short expiry and exposes only the partner state', async () => {
    await repository.setTyping(alice, match, 4_000);
    expect((await repository.getPartnerTyping(bob, match)).typing).toBe(true);
    expect((await repository.getPartnerTyping(alice, match)).typing).toBe(false);
  });
});
