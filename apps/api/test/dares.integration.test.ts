import { randomUUID } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
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

  it('seeds the 150-item editorial catalogue with fail-closed review states', async () => {
    const seeded = await pool.query<{
      name: string; is_premium: boolean; is_public: boolean; is_explicit: boolean;
      content_status: string; min_intensity: number; max_intensity: number; avg_intensity: string; dare_count: string;
    }>(`
      select dp.name, dp.is_premium, dp.is_public, dp.is_explicit, dp.content_status,
             dp.min_intensity, dp.max_intensity, dp.avg_intensity::text,
             count(d.id)::text as dare_count
        from dare_packs dp
        join dares d on d.pack_id = dp.id
       where dp.id between '1f5e0000-0000-4000-8000-100000000001'::uuid
                       and '1f5e0000-0000-4000-8000-100000000010'::uuid
       group by dp.id
       order by dp.sort_order
    `);

    expect(seeded.rows).toEqual([
      { name: 'Little Things', is_premium: false, is_public: true, is_explicit: false, content_status: 'allowed', min_intensity: 1, max_intensity: 1, avg_intensity: '1.00', dare_count: '15' },
      { name: 'Make Me Laugh', is_premium: false, is_public: true, is_explicit: false, content_status: 'allowed', min_intensity: 1, max_intensity: 2, avg_intensity: '1.33', dare_count: '15' },
      { name: 'Sweet & Romantic', is_premium: false, is_public: true, is_explicit: false, content_status: 'allowed', min_intensity: 1, max_intensity: 2, avg_intensity: '1.80', dare_count: '15' },
      { name: 'Surprise Me', is_premium: true, is_public: true, is_explicit: false, content_status: 'allowed', min_intensity: 1, max_intensity: 2, avg_intensity: '1.80', dare_count: '15' },
      { name: 'Flirty Messages', is_premium: true, is_public: false, is_explicit: false, content_status: 'unreviewed', min_intensity: 2, max_intensity: 3, avg_intensity: '2.47', dare_count: '15' },
      { name: 'Long-Distance Heat', is_premium: true, is_public: false, is_explicit: true, content_status: 'unreviewed', min_intensity: 2, max_intensity: 3, avg_intensity: '2.67', dare_count: '15' },
      { name: 'Risky Photos & Audio', is_premium: true, is_public: false, is_explicit: true, content_status: 'unreviewed', min_intensity: 3, max_intensity: 4, avg_intensity: '3.53', dare_count: '15' },
      { name: 'Hands On', is_premium: true, is_public: false, is_explicit: true, content_status: 'unreviewed', min_intensity: 3, max_intensity: 4, avg_intensity: '3.40', dare_count: '15' },
      { name: 'After Dark', is_premium: true, is_public: false, is_explicit: true, content_status: 'unreviewed', min_intensity: 4, max_intensity: 4, avg_intensity: '4.00', dare_count: '15' },
      { name: 'Power Play', is_premium: true, is_public: false, is_explicit: true, content_status: 'unreviewed', min_intensity: 5, max_intensity: 5, avg_intensity: '5.00', dare_count: '15' },
    ]);

    const distribution = await pool.query<{
      total: string; free: string; premium: string; allowed: string; unreviewed: string; duplicate_texts: string; stat_mismatches: string;
    }>(`
      select count(*)::text as total,
             count(*) filter (where not dp.is_premium)::text as free,
             count(*) filter (where dp.is_premium)::text as premium,
             count(*) filter (where d.content_status = 'allowed')::text as allowed,
             count(*) filter (where d.content_status = 'unreviewed')::text as unreviewed,
             (select count(*)::text from (
               select text from dares
                where id between '1f5e0000-0000-4000-8000-000000000001'::uuid
                             and '1f5e0000-0000-4000-8000-000000000150'::uuid
                group by text having count(*) > 1
             ) duplicates) as duplicate_texts,
             (select count(*)::text from (
               select dp.id
                 from dare_packs dp
                 join dares expected on expected.pack_id = dp.id
                where dp.id between '1f5e0000-0000-4000-8000-100000000001'::uuid
                                and '1f5e0000-0000-4000-8000-100000000010'::uuid
                group by dp.id
               having dp.min_intensity is distinct from min(expected.intensity)
                   or dp.max_intensity is distinct from max(expected.intensity)
                   or dp.avg_intensity is distinct from round(avg(expected.intensity)::numeric, 2)
             ) mismatches) as stat_mismatches
        from dares d
        join dare_packs dp on dp.id = d.pack_id
       where d.id between '1f5e0000-0000-4000-8000-000000000001'::uuid
                      and '1f5e0000-0000-4000-8000-000000000150'::uuid
    `);
    expect(distribution.rows[0]).toEqual({ total: '150', free: '45', premium: '105', allowed: '60', unreviewed: '90', duplicate_texts: '0', stat_mismatches: '0' });

    const provenance = await pool.query<{ reviewed_rows: string; review_records: string; attributed_records: string }>(`
      select
        (select count(*)::text from (
          select content_reviewed_at
            from dare_packs
           where id between '1f5e0000-0000-4000-8000-100000000001'::uuid
                        and '1f5e0000-0000-4000-8000-100000000004'::uuid
          union all
          select content_reviewed_at
            from dares
           where id between '1f5e0000-0000-4000-8000-000000000001'::uuid
                        and '1f5e0000-0000-4000-8000-000000000060'::uuid
        ) reviewed where content_reviewed_at = '2026-09-05T16:00:00Z'::timestamptz)::text as reviewed_rows,
        (select count(*)::text from content_reviews
          where (entity_type = 'dare_packs' and entity_id between '1f5e0000-0000-4000-8000-100000000001'::uuid and '1f5e0000-0000-4000-8000-100000000004'::uuid)
             or (entity_type = 'dares' and entity_id between '1f5e0000-0000-4000-8000-000000000001'::uuid and '1f5e0000-0000-4000-8000-000000000060'::uuid)) as review_records,
        (select count(*)::text from content_reviews
          where ((entity_type = 'dare_packs' and entity_id between '1f5e0000-0000-4000-8000-100000000001'::uuid and '1f5e0000-0000-4000-8000-100000000004'::uuid)
              or (entity_type = 'dares' and entity_id between '1f5e0000-0000-4000-8000-000000000001'::uuid and '1f5e0000-0000-4000-8000-000000000060'::uuid))
            and changed_by is not null) as attributed_records
    `);
    expect(provenance.rows[0]).toEqual({ reviewed_rows: '64', review_records: '64', attributed_records: '0' });
  });

  it('is discovered by Drizzle and fails closed on a conflicting catalogue ID', async () => {
    const migrationSchema = `dare_migrator_${randomUUID().replaceAll('-', '')}`;
    await admin.query(`create schema "${migrationSchema}"`);
    const migrationUrl = new URL(url!);
    migrationUrl.searchParams.set('options', `-c search_path=${migrationSchema}`);
    const migrationPool = new Pool({ connectionString: migrationUrl.toString() });
    const dir = new URL('../drizzle/', import.meta.url);

    try {
      await migrate(drizzle(migrationPool), {
        migrationsFolder: fileURLToPath(dir),
        migrationsSchema: migrationSchema,
      });
      const discovered = await migrationPool.query<{ count: string }>(
        "select count(*)::text as count from dares where id between '1f5e0000-0000-4000-8000-000000000001'::uuid and '1f5e0000-0000-4000-8000-000000000150'::uuid",
      );
      expect(discovered.rows[0]?.count).toBe('150');

      const seed = await readFile(new URL('0023_dare_catalogue_150.sql', dir), 'utf8');
      const applySeed = async () => {
        for (const statement of seed.split('--> statement-breakpoint')) {
          if (statement.trim()) await migrationPool.query(statement);
        }
      };
      await applySeed();
      await migrationPool.query(
        "update content_reviews set reason = 'Conflicting review' where id = '2f5e0000-0000-4000-8000-000000000001'::uuid",
      );
      await expect(applySeed()).rejects.toThrow(/division by zero|review provenance/);
      await migrationPool.query(
        "update content_reviews set reason = 'Reviewed with Little Things pack' where id = '2f5e0000-0000-4000-8000-000000000001'::uuid",
      );
      await migrationPool.query(
        "update dares set text = 'Conflicting dare' where id = '1f5e0000-0000-4000-8000-000000000001'::uuid",
      );
      await expect(applySeed()).rejects.toThrow(/division by zero/);
    } finally {
      await migrationPool.end();
      await admin.query(`drop schema if exists "${migrationSchema}" cascade`);
    }
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

  async function insertProof(owner: string, coupleId: string | null, mime: string, kind = 'dare_proof') {
    const id = randomUUID();
    await pool.query(
      'insert into media_objects(id,owner_id,couple_id,kind,storage_key,mime_type,byte_size) values($1,$2,$3,$4,$5,$6,100)',
      [id, owner, coupleId, kind, `${kind}/test/${id}.bin`, mime],
    );
    return id;
  }

  it('stores the proof requirement and defaults to none', async () => {
    const plain = await repo.send(sender, { dare_id: freeDare });
    expect(plain).toMatchObject({ proof_type: 'none', proof_media_id: null });
    const proofed = await repo.send(sender, { dare_id: freeDare, proof_type: 'photo' });
    expect(proofed.proof_type).toBe('photo');
    await expect(repo.send(sender, { dare_id: freeDare, proof_type: 'video' as never }))
      .rejects.toMatchObject({ code: 'invalid_proof_type' });
  });

  it('requires matching proof media before a proofed dare can be submitted', async () => {
    const dare = await repo.send(sender, { dare_id: freeDare, proof_type: 'photo' });
    await repo.respond(recipient, dare.id, 'accept');

    await expect(repo.submit(recipient, dare.id)).rejects.toMatchObject({ code: 'proof_required' });
    const audio = await insertProof(recipient, couple, 'audio/mp4');
    await expect(repo.submit(recipient, dare.id, audio)).rejects.toMatchObject({ code: 'proof_type_mismatch' });

    const photo = await insertProof(recipient, couple, 'image/jpeg');
    const submitted = await repo.submit(recipient, dare.id, photo);
    expect(submitted).toMatchObject({ status: 'submitted', proof_media_id: photo });
    expect((await repo.complete(sender, dare.id)).status).toBe('completed');
  });

  it('refuses proof media the recipient does not own or that is not dare proof', async () => {
    const dare = await repo.send(sender, { dare_id: freeDare, proof_type: 'photo' });
    await repo.respond(recipient, dare.id, 'accept');

    const foreign = await insertProof(outsider, otherCouple, 'image/jpeg');
    await expect(repo.submit(recipient, dare.id, foreign)).rejects.toMatchObject({ code: 'proof_not_found' });
    const wrongKind = await insertProof(recipient, couple, 'image/jpeg', 'chat');
    await expect(repo.submit(recipient, dare.id, wrongKind)).rejects.toMatchObject({ code: 'proof_not_found' });
    const senderOwned = await insertProof(sender, couple, 'image/jpeg');
    await expect(repo.submit(recipient, dare.id, senderOwned)).rejects.toMatchObject({ code: 'proof_not_found' });
  });

  it('accepts voluntary proof on dares that did not require any', async () => {
    const dare = await repo.send(sender, { dare_id: freeDare });
    await repo.respond(recipient, dare.id, 'accept');
    const photo = await insertProof(recipient, couple, 'image/jpeg');
    const submitted = await repo.submit(recipient, dare.id, photo);
    expect(submitted).toMatchObject({ status: 'submitted', proof_type: 'none', proof_media_id: photo });
  });

  it('rejects durations outside the offered presets', async () => {
    await expect(repo.send(sender, { dare_id: freeDare, duration_hours: 5 })).rejects.toMatchObject({ code: 'invalid_duration' });
  });

  it('refuses to send without a partner', async () => {
    await expect(repo.send(outsider, { dare_id: freeDare })).rejects.toMatchObject({ code: 'no_couple' });
  });
});
