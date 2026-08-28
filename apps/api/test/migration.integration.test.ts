import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  migrateDatabase,
  relationalParity,
} from "../src/migration/database.js";
import { migrateStorage, fileDigest } from "../src/migration/storage.js";
import type { MigrationCheckpoint } from "../src/migration/types.js";

const databaseUrl = process.env.DATABASE_URL;
const local = databaseUrl
  ? ["127.0.0.1", "localhost", "::1"].includes(new URL(databaseUrl).hostname)
  : false;
if (databaseUrl && !local)
  throw new Error("Migration integration tests only permit localhost");
describe.skipIf(!databaseUrl || !local)("cutover migration fixtures", () => {
  const admin = new Pool({ connectionString: databaseUrl });
  const suffix = randomUUID().replaceAll("-", "");
  const sourceSchema = `migration_source_${suffix}`;
  const targetSchema = `migration_target_${suffix}`;
  const storageSchema = `migration_storage_${suffix}`;
  let source: Pool;
  let target: Pool;
  let mediaRoot: string;
  const couple = "11111111-1111-4111-8111-111111111111",
    user = "22222222-2222-4222-8222-222222222222",
    pack = "33333333-3333-4333-8333-333333333333",
    question = "44444444-4444-4444-8444-444444444444",
    inverseQuestion = "45454545-4545-4545-8545-454545454545",
    response = "55555555-5555-4555-8555-555555555555",
    object = "66666666-6666-4666-8666-666666666666",
    adminRow = "77777777-7777-4777-8777-777777777777",
    category = "88888888-8888-4888-8888-888888888888",
    review = "99999999-9999-4999-8999-999999999999",
    audit = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    legacyUser = "a0000000-0000-0000-0000-000000000001",
    sourceAppConfig = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const checkpoint = (): MigrationCheckpoint => ({
    version: 1,
    runId: randomUUID(),
    mode: "initial",
    completedTables: [],
    storage: {},
    updatedAt: new Date().toISOString(),
  });
  beforeAll(async () => {
    await admin.query(
      `create schema "${sourceSchema}"; create schema "${targetSchema}"; create schema "${storageSchema}"`,
    );
    const sourceUrl = new URL(databaseUrl!);
    sourceUrl.searchParams.set("options", `-c search_path=${sourceSchema}`);
    source = new Pool({ connectionString: sourceUrl.toString() });
    const targetUrl = new URL(databaseUrl!);
    targetUrl.searchParams.set("options", `-c search_path=${targetSchema}`);
    target = new Pool({ connectionString: targetUrl.toString() });
    for (let index = 0; index <= 18; index++) {
      const files = (await import("node:fs/promises")).readdir(
        new URL("../drizzle", import.meta.url),
      );
      const name = (await files).find((file) =>
        file.startsWith(`${String(index).padStart(4, "0")}_`),
      );
      if (!name) continue;
      const sql = await readFile(
        new URL(`../drizzle/${name}`, import.meta.url),
        "utf8",
      );
      for (const statement of sql.split("--> statement-breakpoint"))
        if (statement.trim()) await target.query(statement);
    }
    await source.query(
      `create table couples(id uuid primary key,invite_code text,created_at timestamptz);create table profiles(id uuid primary key,name text,email text,couple_id uuid,created_at timestamptz,updated_at timestamptz);create table admin_users(id uuid primary key,user_id uuid,role text,created_at timestamptz,created_by uuid,updated_at timestamptz,permissions jsonb);create table categories(id uuid primary key,name text,is_public boolean,sort_order int,content_status text,content_review_reason text,content_reviewed_at timestamptz,content_reviewed_by uuid,created_at timestamptz);create table question_packs(id uuid primary key,name text,is_public boolean,is_premium boolean,avg_intensity numeric(3,2),content_status text,content_review_reason text,content_reviewed_at timestamptz,content_reviewed_by uuid,created_at timestamptz);create table questions(id uuid primary key,pack_id uuid,text text,intensity int,required_props text[],inverse_of uuid,content_status text,content_review_reason text,content_reviewed_at timestamptz,content_reviewed_by uuid,created_at timestamptz);create table content_reviews(id uuid primary key,entity_type text,entity_id uuid,previous_status text,new_status text,reason text,changed_by uuid,created_at timestamptz);create table responses(id uuid primary key,user_id uuid,question_id uuid,couple_id uuid,answer text,created_at timestamptz);create table feature_interests(id uuid primary key,user_id uuid,feature_name text,created_at timestamptz);create table live_draw_sessions(id uuid primary key,couple_id uuid,strokes jsonb,updated_at timestamptz,created_at timestamptz);create table audit_logs(id uuid primary key,table_name text,record_id uuid,action text,old_values jsonb,new_values jsonb,changed_fields text[],admin_user_id uuid,admin_role text,created_at timestamptz,admin_username text);create table app_config(id uuid primary key,answer_gap_threshold int,daily_response_limit int,updated_at timestamptz);`,
    );
    await source.query(
      `insert into couples values($1,'e5d3012e','2024-01-01T00:00:00Z')`,
      [couple],
    );
    await source.query(
      `insert into app_config values($1,99,99,'2024-01-01T00:00:00Z')`,
      [sourceAppConfig],
    );
    await source.query(
      `insert into profiles values($1,'Alice','alice@test',$2,'2024-01-02T00:00:00Z','2024-01-03T00:00:00Z')`,
      [user, couple],
    );
    await source.query(
      `insert into admin_users values($1,$2,'super_admin',now(),null,now(),$3::jsonb)`,
      [adminRow, user, JSON.stringify(["manage_packs"])],
    );
    await source.query("alter table profiles add column avatar_url text");
    await source.query("update profiles set avatar_url=$2 where id=$1", [
      user,
      `https://source.test/storage/v1/object/public/avatars/${user}/avatar.png`,
    ]);
    await source.query(
      `insert into categories values($1,'Core',true,1,'allowed','Reviewed',null,null,'2024-01-03T00:00:00Z')`,
      [category],
    );
    await source.query(
      `insert into question_packs values($1,'Core',true,false,3.36,'allowed','Reviewed',null,null,'2024-01-04T00:00:00Z')`,
      [pack],
    );
    await source.query(
      `insert into questions values($1,$2,'Question',2,array['blindfold'],$3,'allowed','Reviewed',null,null,'2024-01-05T00:00:00Z'),($3,$2,'Inverse',2,array[]::text[],null,'allowed','Reviewed',null,null,'2024-01-05T00:00:01Z')`,
      [question, pack, inverseQuestion],
    );
    await source.query(
      `insert into content_reviews values($1,'categories',$2,'unreviewed','allowed','Reviewed',null,'2024-01-03T00:00:00Z')`,
      [review, category],
    );
    await source.query(
      `insert into responses values($1,$2,$3,$4,'yes','2024-01-06T00:00:00Z')`,
      [response, user, question, couple],
    );
    await source.query(
      `insert into feature_interests values(gen_random_uuid(),$1,'daily_dares','2024-01-07T00:00:00Z')`,
      [user],
    );
    await source.query(
      `insert into live_draw_sessions values(gen_random_uuid(),$1,'[]'::jsonb,'2024-01-08T00:00:00Z','2024-01-08T00:00:00Z')`,
      [couple],
    );
    await source.query(
      `insert into audit_logs values($1,'categories',$2,'UPDATE',null,$3::jsonb,array['content_status'],$4,'super_admin','2024-01-09T00:00:00Z','alice')`,
      [audit, category, JSON.stringify({ content_status: "allowed" }), user],
    );
    await admin.query(
      `create table "${storageSchema}".objects(id uuid primary key,bucket_id text,name text,owner_id uuid,metadata jsonb,created_at timestamptz,updated_at timestamptz)`,
    );
    await admin.query(
      `insert into "${storageSchema}".objects values($1,'avatars',$2,$3,$4,now(),now())`,
      [object, `${user}/avatar.png`, user, { size: 4, mimetype: "image/png" }],
    );
    mediaRoot = await mkdtemp(join(tmpdir(), "sauci-migration-"));
  });
  afterAll(async () => {
    await Promise.all([source?.end(), target?.end()]);
    await admin.query(
      `drop schema if exists "${storageSchema}" cascade;drop schema if exists "${sourceSchema}" cascade;drop schema if exists "${targetSchema}" cascade`,
    );
    await admin.end();
    if (mediaRoot) await rm(mediaRoot, { recursive: true, force: true });
  });
  it("preserves IDs, schema mappings, catalogue reviews, timestamps, side-effect suppression, and FK parity", async () => {
    const state = checkpoint();
    const result = await migrateDatabase(source, target, {
      dryRun: false,
      finalSync: false,
      prune: false,
      checkpoint: state,
    });
    expect(result.find((row) => row.table === "responses")).toMatchObject({
      sourceRows: 1,
      targetRows: 1,
      status: "equal",
    });
    expect(result.find((row) => row.table === "app_config")).toMatchObject({
      sourceRows: 1,
      targetRows: 1,
      importedRows: 0,
      status: "equal",
    });
    expect(
      (await target.query("select id from app_config")).rows[0].id,
    ).not.toBe(sourceAppConfig);
    const row = await target.query("select id,created_at from responses");
    expect(row.rows[0].id).toBe(response);
    expect(new Date(row.rows[0].created_at).toISOString()).toBe(
      "2024-01-06T00:00:00.000Z",
    );
    expect(
      (
        await target.query("select invite_code from couples where id=$1", [
          couple,
        ])
      ).rows[0].invite_code,
    ).toBe("E5D3012E");
    expect(
      (
        await target.query(
          "select avg_intensity,content_status from question_packs where id=$1",
          [pack],
        )
      ).rows[0],
    ).toMatchObject({ avg_intensity: "3.36", content_status: "allowed" });
    expect(
      (
        await target.query(
          "select required_props,inverse_of,content_status from questions where id=$1",
          [question],
        )
      ).rows[0],
    ).toMatchObject({
      required_props: ["blindfold"],
      inverse_of: inverseQuestion,
      content_status: "allowed",
    });
    expect(
      (
        await target.query(
          "select feature from feature_interests where user_id=$1",
          [user],
        )
      ).rows[0].feature,
    ).toBe("daily_dares");
    expect(
      (
        await target.query(
          "select updated_by from live_draw_sessions where couple_id=$1",
          [couple],
        )
      ).rows[0].updated_by,
    ).toBe(user);
    expect(
      (
        await target.query(
          "select actor_user_id,admin_user_id,changed_fields,admin_role,admin_username from audit_logs where id=$1",
          [audit],
        )
      ).rows[0],
    ).toMatchObject({
      actor_user_id: user,
      admin_user_id: adminRow,
      changed_fields: ["content_status"],
      admin_role: "super_admin",
      admin_username: "alice",
    });
    expect(
      (
        await target.query(
          "select count(*)::int count from content_reviews where id=$1",
          [review],
        )
      ).rows[0].count,
    ).toBe(1);
    expect(
      (await target.query("select count(*)::int count from operations_outbox"))
        .rows[0].count,
    ).toBe(0);
    expect(await relationalParity(target)).toEqual({
      profiles_without_couple: 0,
      responses_with_missing_owner: 0,
      matches_with_missing_relation: 0,
      messages_with_missing_relation: 0,
      couple_mismatch_responses: 0,
    });
  });
  it("keeps a newer live profile during an initial merge", async () => {
    const liveCouple = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
    await target.query(
      "insert into couples(id,invite_code,created_at) values($1,'LIVE0001',now())",
      [liveCouple],
    );
    await target.query(
      "update profiles set name='Live Alice',couple_id=$2,updated_at='2026-08-28T00:00:00Z' where id=$1",
      [user, liveCouple],
    );
    await migrateDatabase(source, target, {
      dryRun: false,
      finalSync: false,
      prune: false,
      checkpoint: checkpoint(),
    });
    expect(
      (
        await target.query(
          "select name,couple_id,updated_at from profiles where id=$1",
          [user],
        )
      ).rows[0],
    ).toMatchObject({ name: "Live Alice", couple_id: couple });
  });
  it("dry-run reads and reports without changing the target", async () => {
    await source.query(
      "update profiles set name='Changed at source' where id=$1",
      [user],
    );
    await migrateDatabase(source, target, {
      dryRun: true,
      finalSync: false,
      prune: false,
      checkpoint: checkpoint(),
    });
    expect(
      (await target.query("select name from profiles where id=$1", [user]))
        .rows[0].name,
    ).toBe("Live Alice");
    await source.query("update profiles set name='Alice' where id=$1", [user]);
  });
  it("is resumable and a stopped-source prune restores exact row parity", async () => {
    const state = checkpoint();
    state.completedTables = ["couples"];
    await target.query(
      `insert into couples(id,invite_code,created_at) values('77777777-7777-4777-8777-777777777777','STALE001',now())`,
    );
    const resumed = await migrateDatabase(source, target, {
      dryRun: false,
      finalSync: false,
      prune: false,
      checkpoint: state,
    });
    expect(resumed.find((row) => row.table === "couples")?.note).toContain(
      "resumed from checkpoint",
    );
    const final = await migrateDatabase(source, target, {
      dryRun: false,
      finalSync: true,
      prune: true,
      checkpoint: checkpoint(),
    });
    expect(final.find((row) => row.table === "couples")).toMatchObject({
      sourceRows: 1,
      targetRows: 1,
      prunedRows: 2,
      status: "equal",
    });
  });
  it("copies storage atomically, quarantines unattributable legacy objects, rewrites references, verifies checkpoints, and prunes source-deleted files", async () => {
    const legacyAvatar = randomUUID(),
      orphanChat = randomUUID(),
      unmatchedChat = randomUUID(),
      feedbackObject = randomUUID(),
      feedbackId = randomUUID();
    await source.query(
      "insert into profiles values($1,$2,$3,$4,now(),now(),null)",
      [legacyUser, "Legacy", "legacy@test", couple],
    );
    await target.query(
      "insert into profiles(id,name,email,couple_id,created_at,updated_at) values($1,$2,$3,$4,now(),now())",
      [legacyUser, "Legacy", "legacy@test", couple],
    );
    await source.query(
      "create table messages(user_id uuid,match_id uuid,media_path text);create table feedback(id uuid primary key,user_id uuid,screenshot_url text)",
    );
    await source.query("insert into feedback values($1,$2,$3)", [
      feedbackId,
      user,
      `https://source.test/storage/v1/object/public/feedback-screenshots/${user}/shot.jpg`,
    ]);
    await target.query(
      "insert into feedback(id,user_id,type,title,description) values($1,$2,'bug','Screenshot','Details')",
      [feedbackId, user],
    );
    await admin.query(
      `insert into "${storageSchema}".objects values($1,'avatars',$2,$3,$4,now(),now()),($5,'chat-media',$6,null,$4,now(),now()),($7,'chat-media',$8,$9,$4,now(),now()),($10,'feedback-screenshots',$11,$9,$4,now(),now())`,
      [
        legacyAvatar,
        `${legacyUser}/legacy.jpg`,
        legacyUser,
        { size: 4, mimetype: "image/jpeg" },
        orphanChat,
        `${randomUUID()}/orphan.jpg`,
        unmatchedChat,
        `${randomUUID()}/chat.jpg`,
        user,
        feedbackObject,
        `${user}/shot.jpg`,
      ],
    );
    const state = checkpoint();
    const first = await migrateStorage(source, target, {
      dryRun: false,
      mediaRoot,
      storageSchema,
      checkpoint: state,
      download: async () => new Uint8Array([1, 2, 3, 4]),
    });
    expect(first.failures).toEqual([]);
    expect(first).toMatchObject({
      sourceFiles: 5,
      targetFiles: 5,
      copiedFiles: 5,
      quarantinedFiles: 1,
      failedFiles: 0,
      missingOnDisk: [],
    });
    const path = join(mediaRoot, "avatars", user, "avatar.png");
    expect(await fileDigest(path)).toBe(
      "9f64a747e1b97f131fabb6b447296c9b6f0201e79fb3c5356e6c77e89b6a806a",
    );
    expect(
      (
        await target.query(
          "select owner_id,kind,byte_size from media_objects where id=$1",
          [object],
        )
      ).rows[0],
    ).toMatchObject({ owner_id: user, kind: "avatar", byte_size: 4 });
    expect(
      (
        await target.query("select owner_id from media_objects where id=$1", [
          legacyAvatar,
        ])
      ).rows[0].owner_id,
    ).toBe(legacyUser);
    expect(
      (
        await target.query("select match_id from media_objects where id=$1", [
          unmatchedChat,
        ])
      ).rows[0].match_id,
    ).toBeNull();
    expect(
      (
        await target.query(
          "select reason from legacy_media_quarantine where id=$1",
          [orphanChat],
        )
      ).rowCount,
    ).toBe(1);
    expect(
      (
        await target.query(
          "select screenshot_media_id from feedback where id=$1",
          [feedbackId],
        )
      ).rows[0].screenshot_media_id,
    ).toBe(feedbackObject);
    expect(
      (
        await target.query("select avatar_url from profiles where id=$1", [
          user,
        ])
      ).rows[0].avatar_url,
    ).toBe(`media:${object}`);
    const resumed = await migrateStorage(source, target, {
      dryRun: false,
      mediaRoot,
      storageSchema,
      checkpoint: state,
      download: async () => {
        throw new Error("must not redownload");
      },
    });
    expect(resumed).toMatchObject({
      copiedFiles: 0,
      skippedFiles: 5,
      failedFiles: 0,
    });
    const stale = "77777777-7777-4777-8777-777777777777";
    const staleKey = `avatars/${user}/stale.png`;
    await target.query(
      "insert into media_objects(id,owner_id,couple_id,kind,storage_key,mime_type,byte_size) values($1,$2,$3,'avatar',$4,'image/png',1)",
      [stale, user, couple, staleKey],
    );
    await writeFile(join(mediaRoot, staleKey), new Uint8Array([9]));
    await admin.query(
      `delete from "${storageSchema}".objects where id=$1`,
      [orphanChat],
    );
    const pruned = await migrateStorage(source, target, {
      dryRun: false,
      prune: true,
      mediaRoot,
      storageSchema,
      checkpoint: state,
      download: async () => {
        throw new Error("must not redownload");
      },
    });
    expect(pruned).toMatchObject({
      sourceFiles: 4,
      targetFiles: 4,
      prunedFiles: 2,
      skippedFiles: 4,
      failedFiles: 0,
    });
    expect(
      (await target.query("select 1 from legacy_media_quarantine where id=$1", [orphanChat])).rowCount,
    ).toBe(0);
  });
});
