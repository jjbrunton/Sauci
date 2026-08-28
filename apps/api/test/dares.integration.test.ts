import { randomUUID } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { FREE_WEEKLY_SEND_LIMIT, PostgresDaresRepository } from '../src/domains/dares/repository.js';

const url = process.env.DATABASE_URL;
const local = url ? ['127.0.0.1', 'localhost', '::1'].includes(new URL(url).hostname) : false;
if (url && !local) throw new Error('Dare integration tests only permit localhost');

describe.skipIf(!url || !local)('dares + PostgreSQL', () => {
  const admin = new Pool({ connectionString: url });
  const schema = `dares_${randomUUID().replaceAll('-', '')}`;
  let pool: Pool;
  let repo: PostgresDaresRepository;

  const sender = '11111111-1111-4111-8111-111111111111';
  const recipient = '22222222-2222-4222-8222-222222222222';
  const outsider = '33333333-3333-4333-8333-333333333333';
  const couple = '44444444-4444-4444-8444-444444444444';
  const otherCouple = '55555555-5555-4555-8555-555555555555';
  const freePack = '66666666-6666-4666-8666-666666666666';
  const premiumPack = '77777777-7777-4777-8777-777777777777';
  const unreviewedPack = '88888888-8888-4888-8888-888888888888';
  const freeDare = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const premiumDare = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const unreviewedDare = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

  beforeAll(async () => {
    await admin.query(`create schema "${schema}"`);
    const isolated = new URL(url!);
    isolated.searchParams.set('options', `-c search_path=${schema}`);
    pool = new Pool({ connectionString: isolated.toString() });
    repo = new PostgresDaresRepository(isolated.toString());

    const dir = new URL('../drizzle/', import.meta.url);
    const files = (await readdir(dir)).filter((name) => name.endsWith('.sql')).sort();
    for (const name of files) {
      const sql = await readFile(new URL(name, dir), 'utf8');
      for (const statement of sql.split('--> statement-breakpoint')) {
        if (statement.trim()) await pool.query(statement);
      }
    }

    await pool.query('insert into couples(id,invite_code) values($1,$2),($3,$4)', [couple, 'DARESAA1', otherCouple, 'DARESBB2']);
    await pool.query(
      'insert into profiles(id,couple_id,is_premium,hide_nsfw,max_intensity) values($1,$4,false,false,5),($2,$4,false,false,5),($3,$5,false,false,5)',
      [sender, recipient, outsider, couple, otherCouple],
    );
    await pool.query(
      `insert into dare_packs(id,name,is_premium,content_status) values
        ($1,'Free Pack',false,'allowed'),($2,'Premium Pack',true,'allowed'),($3,'Unreviewed Pack',false,'unreviewed')`,
      [freePack, premiumPack, unreviewedPack],
    );
    await pool.query(
      `insert into dares(id,pack_id,text,intensity,content_status) values
        ($1,$4,'Free dare text',2,'allowed'),($2,$5,'Premium dare text',3,'allowed'),($3,$6,'Unreviewed dare text',1,'unreviewed')`,
      [freeDare, premiumDare, unreviewedDare, freePack, premiumPack, unreviewedPack],
    );
  });

  beforeEach(async () => {
    await pool.query('delete from sent_dares');
    await pool.query('delete from operations_outbox');
    await pool.query('update profiles set is_premium=false');
  });

  afterAll(async () => {
    await repo.close();
    await pool.end();
    await admin.query(`drop schema "${schema}" cascade`);
    await admin.end();
  });

  it('hides unreviewed packs and dares from the catalogue', async () => {
    const catalog = await repo.getCatalog(sender);
    const ids = catalog.packs.map((pack) => pack.id);
    expect(ids).toContain(freePack);
    expect(ids).toContain(premiumPack);
    expect(ids).not.toContain(unreviewedPack);
    await expect(repo.listPackDares(sender, unreviewedPack)).rejects.toMatchObject({ code: 'pack_not_found' });
    await expect(repo.send(sender, { dare_id: unreviewedDare })).rejects.toMatchObject({ code: 'dare_not_found' });
  });

  it('gates premium packs and custom dares, and unlocks when either partner pays', async () => {
    await expect(repo.listPackDares(sender, premiumPack)).rejects.toMatchObject({ code: 'premium_required' });
    await expect(repo.send(sender, { dare_id: premiumDare })).rejects.toMatchObject({ code: 'premium_required' });
    await expect(repo.send(sender, { custom_dare_text: 'My own dare' })).rejects.toMatchObject({ code: 'premium_required' });

    // Premium is couple-shared: the partner paying unlocks the sender.
    await pool.query('update profiles set is_premium=true where id=$1', [recipient]);
    expect((await repo.getCatalog(sender)).entitlement).toMatchObject({ is_premium: true, sends_remaining: null });
    await expect(repo.listPackDares(sender, premiumPack)).resolves.toHaveLength(1);
    const custom = await repo.send(sender, { custom_dare_text: '  My own dare  ', custom_dare_intensity: 4 });
    expect(custom).toMatchObject({ is_custom: true, text: 'My own dare', intensity: 4 });
  });

  it('enforces the free weekly send allowance without blocking the response side', async () => {
    for (let index = 0; index < FREE_WEEKLY_SEND_LIMIT; index += 1) {
      await repo.send(sender, { dare_id: freeDare });
    }
    expect((await repo.getCatalog(sender)).entitlement.sends_remaining).toBe(0);
    await expect(repo.send(sender, { dare_id: freeDare })).rejects.toMatchObject({ code: 'send_limit_reached' });

    // The quota is per-sender, so the recipient can still answer back.
    const reply = await repo.send(recipient, { dare_id: freeDare });
    expect(reply.direction).toBe('outgoing');
  });

  it('serializes concurrent sends so the free allowance cannot be raced', async () => {
    const attempts = await Promise.allSettled(
      Array.from({ length: FREE_WEEKLY_SEND_LIMIT + 3 }, () => repo.send(sender, { dare_id: freeDare })),
    );
    expect(attempts.filter((attempt) => attempt.status === 'fulfilled')).toHaveLength(FREE_WEEKLY_SEND_LIMIT);
    const stored = await pool.query<{ count: string }>('select count(*) as count from sent_dares where sender_id=$1', [sender]);
    expect(stored.rows[0]!.count).toBe(String(FREE_WEEKLY_SEND_LIMIT));
  });

  it('walks the full loop and records each transition exactly once', async () => {
    const dare = await repo.send(sender, { dare_id: freeDare, duration_hours: 24, sender_notes: 'have fun' });
    expect(dare).toMatchObject({ status: 'pending', direction: 'outgoing', text: 'Free dare text' });
    expect(dare.expires_at).not.toBeNull();

    expect((await repo.respond(recipient, dare.id, 'accept')).status).toBe('active');
    expect((await repo.submit(recipient, dare.id)).status).toBe('submitted');
    expect((await repo.complete(sender, dare.id)).status).toBe('completed');

    const events = await pool.query<{ dedupe_key: string; recipient_id: string }>(
      "select dedupe_key, recipient_id from operations_outbox where kind='expo' order by created_at",
    );
    expect(events.rows.map((row) => row.dedupe_key.split(':')[2])).toEqual(['sent', 'active', 'submitted', 'completed']);
    expect(events.rows.map((row) => row.recipient_id)).toEqual([recipient, sender, sender, recipient]);
  });

  it('never puts dare text in a notification payload', async () => {
    const dare = await repo.send(sender, { dare_id: freeDare });
    await repo.respond(recipient, dare.id, 'accept');
    const leaked = await pool.query<{ count: string }>(
      "select count(*) as count from operations_outbox where payload::text ilike '%Free dare text%'",
    );
    expect(leaked.rows[0]!.count).toBe('0');
  });

  it('respects the dares notification preference', async () => {
    await pool.query('insert into notification_preferences(user_id,dares_enabled) values($1,false)', [recipient]);
    const dare = await repo.send(sender, { dare_id: freeDare });
    const events = await pool.query('select 1 from operations_outbox where recipient_id=$1', [recipient]);
    expect(events.rowCount).toBe(0);
    // The sender has not opted out, so their side still fires.
    await repo.respond(recipient, dare.id, 'decline');
    const senderEvents = await pool.query('select 1 from operations_outbox where recipient_id=$1', [sender]);
    expect(senderEvents.rowCount).toBe(1);
    await pool.query('delete from notification_preferences where user_id=$1', [recipient]);
  });

  it('enforces actor and state on every transition', async () => {
    const dare = await repo.send(sender, { dare_id: freeDare });
    await expect(repo.respond(sender, dare.id, 'accept')).rejects.toMatchObject({ code: 'not_permitted' });
    await expect(repo.submit(recipient, dare.id)).rejects.toMatchObject({ code: 'invalid_transition' });
    await expect(repo.complete(sender, dare.id)).rejects.toMatchObject({ code: 'invalid_transition' });
    await expect(repo.respond(outsider, dare.id, 'accept')).rejects.toMatchObject({ code: 'dare_not_found' });

    await repo.respond(recipient, dare.id, 'accept');
    await expect(repo.cancel(recipient, dare.id)).rejects.toMatchObject({ code: 'not_permitted' });
    expect((await repo.cancel(sender, dare.id)).status).toBe('cancelled');
    await expect(repo.complete(sender, dare.id)).rejects.toMatchObject({ code: 'invalid_transition' });
  });

  it('keeps history intact when the source dare is deleted', async () => {
    const dare = await repo.send(sender, { dare_id: freeDare });
    await pool.query('delete from dares where id=$1', [freeDare]);
    const history = await repo.listDares(sender, 'active');
    expect(history.find((row) => row.id === dare.id)).toMatchObject({ dare_id: null, text: 'Free dare text', intensity: 2 });
    await pool.query(
      "insert into dares(id,pack_id,text,intensity,content_status) values($1,$2,'Free dare text',2,'allowed')",
      [freeDare, freePack],
    );
  });

  it('scopes listing and stats to the couple', async () => {
    const dare = await repo.send(sender, { dare_id: freeDare });
    await repo.respond(recipient, dare.id, 'accept');
    await repo.submit(recipient, dare.id);
    await repo.complete(sender, dare.id);

    expect(await repo.listDares(outsider, 'active')).toEqual([]);
    expect(await repo.stats(outsider)).toMatchObject({ sent: 0, completed_together: 0 });
    expect(await repo.stats(sender)).toMatchObject({ sent: 1, received: 0, completed_together: 1, completed_by_partner: 1 });
    expect(await repo.stats(recipient)).toMatchObject({ sent: 0, received: 1, completed_together: 1, completed_by_me: 1 });

    const active = await repo.listDares(sender, 'active');
    const history = await repo.listDares(sender, 'history');
    expect(active).toEqual([]);
    expect(history).toHaveLength(1);
    expect(history[0]!.direction).toBe('outgoing');
    expect((await repo.listDares(recipient, 'history'))[0]!.direction).toBe('incoming');
  });

  it('rejects durations outside the offered presets', async () => {
    await expect(repo.send(sender, { dare_id: freeDare, duration_hours: 5 })).rejects.toMatchObject({ code: 'invalid_duration' });
  });

  it('refuses to send without a partner', async () => {
    await expect(repo.send(outsider, { dare_id: freeDare })).rejects.toMatchObject({ code: 'no_couple' });
  });
});
