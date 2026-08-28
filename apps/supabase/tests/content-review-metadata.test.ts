import { createClient } from "@supabase/supabase-js";
import { assertEquals, assertMatch } from "std/assert/mod.ts";
import {
  adminClient,
  createTestUser,
  SUPABASE_URL,
} from "./utils.ts";

const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

if (!anonKey) {
  throw new Error("SUPABASE_ANON_KEY is required");
}

Deno.test("catalogue review migration stages the complete audited archive set", async () => {
  const migrationSql = await Deno.readTextFile(
    new URL(
      "../migrations/20260827215907_add_catalog_content_review_metadata.sql",
      import.meta.url,
    ),
  );
  const archiveBlocks = [...migrationSql.matchAll(
    /WITH archive_packs\(id\) AS \(\s*VALUES([\s\S]*?)\)\s*UPDATE/g,
  )];

  assertEquals(archiveBlocks.length, 2);

  const extractIds = (block: string) =>
    [...block.matchAll(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g,
    )].map(([id]) => id);
  const packIds = extractIds(archiveBlocks[0][1]);
  const questionPackIds = extractIds(archiveBlocks[1][1]);

  assertEquals(packIds.length, 30);
  assertEquals(new Set(packIds).size, 30);
  assertEquals(questionPackIds, packIds);

  for (
    const auditedMixedPackId of [
      "f0f597b1-889c-4537-beeb-d0f459bb7907", // Body Mapping
      "46288aa4-271c-44cf-bfe2-d25662d3f9f8", // Date Night Sparks
      "d2000000-0000-0000-0000-000000000001", // First Impressions
      "07f0da41-8ef7-4a48-8ec9-cef2dabaee73", // Love Notes
      "42c00d6c-ab1f-42ce-afb0-00839064263b", // Romantic Gestures
      "8a1e8650-a192-4f2e-86b0-0ec7bf6fb61c", // Sensual Massage
      "d5d1b8d2-a868-4150-86bc-da3f8e3e8b00", // Testing the Waters
      "19e4ddbd-a4aa-4b26-80bb-53b7187f0eba", // Missing You
    ]
  ) {
    assertEquals(packIds.includes(auditedMixedPackId), true);
  }
});

Deno.test("catalogue review metadata is reversible, audited, and non-super-admin decisions are rejected", async () => {
  const suffix = crypto.randomUUID();
  const email = `content-review-${suffix}@example.com`;
  let packId: string | undefined;
  let insertedPackId: string | undefined;
  let userId: string | undefined;

  try {
    const { data: pack, error: packError } = await adminClient
      .from("question_packs")
      .insert({
        name: `Content review test ${suffix}`,
        is_public: true,
        is_premium: false,
        is_explicit: false,
      })
      .select("id, content_status")
      .single();

    if (packError) throw packError;
    packId = pack.id;
    assertEquals(pack.content_status, "unreviewed");

    const { data: archived, error: archiveError } = await adminClient
      .from("question_packs")
      .update({
        content_status: "archived",
        content_review_reason: "Test archive decision",
      })
      .eq("id", packId)
      .select("content_status, content_review_reason")
      .single();

    if (archiveError) throw archiveError;
    assertEquals(archived.content_status, "archived");
    assertEquals(archived.content_review_reason, "Test archive decision");

    const { error: blankReasonError } = await adminClient
      .from("question_packs")
      .update({
        content_status: "allowed",
        content_review_reason: "   ",
      })
      .eq("id", packId);
    if (!blankReasonError) {
      throw new Error("Expected blank review reason to be rejected");
    }
    assertMatch(blankReasonError.message, /non-blank content_review_reason/i);

    const user = await createTestUser(email);
    userId = user.id;

    const userClient = createClient(SUPABASE_URL, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { error: signInError } = await userClient.auth.signInWithPassword({
      email,
      password: "password123",
    });
    if (signInError) throw signInError;

    // The metadata-only migration must not hide content from existing clients.
    const { data: stillVisible, error: visibilityError } = await userClient
      .from("question_packs")
      .select("id, content_status")
      .eq("id", packId)
      .single();
    if (visibilityError) throw visibilityError;
    assertEquals(stillVisible.id, packId);
    assertEquals(stillVisible.content_status, "archived");

    const { error: adminError } = await adminClient.from("admin_users").insert({
      user_id: userId,
      role: "pack_creator",
    });
    if (adminError) throw adminError;

    const { error: forbiddenDecision } = await userClient
      .from("question_packs")
      .update({
        content_status: "allowed",
        content_review_reason: "Pack creator should not approve content",
      })
      .eq("id", packId);

    if (!forbiddenDecision) {
      throw new Error("Expected pack creator catalogue decision to be rejected");
    }
    assertMatch(forbiddenDecision.message, /Only super admins/i);

    const { error: promoteError } = await adminClient
      .from("admin_users")
      .update({ role: "super_admin" })
      .eq("user_id", userId);
    if (promoteError) throw promoteError;

    const { data: allowed, error: allowedError } = await userClient
      .from("question_packs")
      .update({
        content_status: "allowed",
        content_review_reason: "Test super admin approval",
      })
      .eq("id", packId)
      .select("content_status, content_reviewed_by")
      .single();
    if (allowedError) throw allowedError;
    assertEquals(allowed.content_status, "allowed");
    assertEquals(allowed.content_reviewed_by, userId);

    const { data: rereviewed, error: rereviewError } = await userClient
      .from("question_packs")
      .update({ content_review_reason: "Test approval independently rechecked" })
      .eq("id", packId)
      .select("content_status, content_review_reason, content_reviewed_by")
      .single();
    if (rereviewError) throw rereviewError;
    assertEquals(rereviewed.content_status, "allowed");
    assertEquals(
      rereviewed.content_review_reason,
      "Test approval independently rechecked",
    );
    assertEquals(rereviewed.content_reviewed_by, userId);

    const { error: demoteError } = await adminClient
      .from("admin_users")
      .update({ role: "pack_creator" })
      .eq("user_id", userId);
    if (demoteError) throw demoteError;

    const { error: forgedReason } = await userClient
      .from("question_packs")
      .update({ content_review_reason: "Pack creator forged review reason" })
      .eq("id", packId);
    if (!forgedReason) {
      throw new Error("Expected pack creator review metadata change to be rejected");
    }
    assertMatch(forgedReason.message, /Only super admins/i);

    const { error: forgedReviewer } = await userClient
      .from("question_packs")
      .update({ content_reviewed_by: null })
      .eq("id", packId);
    if (!forgedReviewer) {
      throw new Error("Expected database-managed reviewer metadata to be rejected");
    }
    assertMatch(forgedReviewer.message, /database-managed/i);

    const { data: guardedInsert, error: guardedInsertError } = await userClient
      .from("question_packs")
      .insert({
        name: `Guarded content review insert ${suffix}`,
        is_public: true,
        is_premium: false,
        is_explicit: false,
        content_status: "allowed",
        content_review_reason: "Forged approval on insert",
        content_reviewed_at: new Date().toISOString(),
        content_reviewed_by: userId,
      })
      .select(
        "id, content_status, content_review_reason, content_reviewed_at, content_reviewed_by",
      )
      .single();
    if (guardedInsertError) throw guardedInsertError;
    insertedPackId = guardedInsert.id;
    assertEquals(guardedInsert.content_status, "unreviewed");
    assertEquals(guardedInsert.content_review_reason, null);
    assertEquals(guardedInsert.content_reviewed_at, null);
    assertEquals(guardedInsert.content_reviewed_by, null);

    const { data: edited, error: editError } = await userClient
      .from("question_packs")
      .update({ name: `Edited content review test ${suffix}` })
      .eq("id", packId)
      .select("content_status, content_review_reason")
      .single();

    if (editError) throw editError;
    assertEquals(edited.content_status, "unreviewed");
    assertEquals(
      edited.content_review_reason,
      "Visible content changed; review required",
    );

    const { data: reviews, error: reviewsError } = await adminClient
      .from("content_reviews")
      .select("previous_status, new_status, reason, changed_by")
      .eq("entity_type", "question_packs")
      .eq("entity_id", packId)
      .order("created_at", { ascending: true });

    if (reviewsError) throw reviewsError;
    assertEquals(reviews.length, 4);
    assertEquals(reviews[0].previous_status, "unreviewed");
    assertEquals(reviews[0].new_status, "archived");
    assertEquals(reviews[1].previous_status, "archived");
    assertEquals(reviews[1].new_status, "allowed");
    assertEquals(reviews[1].changed_by, userId);
    assertEquals(reviews[2].previous_status, "allowed");
    assertEquals(reviews[2].new_status, "allowed");
    assertEquals(reviews[2].changed_by, userId);
    assertEquals(reviews[3].previous_status, "allowed");
    assertEquals(reviews[3].new_status, "unreviewed");
    assertEquals(reviews[3].changed_by, userId);

    const { data: hiddenReviews, error: hiddenReviewsError } = await userClient
      .from("content_reviews")
      .select("id")
      .eq("entity_type", "question_packs")
      .eq("entity_id", packId);
    if (hiddenReviewsError) throw hiddenReviewsError;
    assertEquals(hiddenReviews.length, 0);

    const { error: forgedAuditInsert } = await userClient
      .from("content_reviews")
      .insert({
        entity_type: "question_packs",
        entity_id: packId,
        previous_status: "unreviewed",
        new_status: "allowed",
        reason: "Forged audit event",
      });
    if (!forgedAuditInsert) {
      throw new Error("Expected authenticated audit insertion to be rejected");
    }
  } finally {
    if (insertedPackId) {
      await adminClient
        .from("question_packs")
        .delete()
        .eq("id", insertedPackId);
    }
    if (packId) {
      await adminClient
        .from("content_reviews")
        .delete()
        .eq("entity_type", "question_packs")
        .eq("entity_id", packId);
      await adminClient.from("question_packs").delete().eq("id", packId);
    }
    if (userId) {
      await adminClient.from("admin_users").delete().eq("user_id", userId);
      await adminClient.auth.admin.deleteUser(userId);
    }
  }
});

Deno.test("deleting a reviewer preserves the decision and clears its current reviewer reference", async () => {
  const suffix = crypto.randomUUID();
  const email = `deleted-content-reviewer-${suffix}@example.com`;
  let packId: string | undefined;
  let userId: string | undefined;

  try {
    const user = await createTestUser(email);
    userId = user.id;

    const { error: adminError } = await adminClient.from("admin_users").insert({
      user_id: userId,
      role: "super_admin",
    });
    if (adminError) throw adminError;

    const reviewerClient = createClient(SUPABASE_URL, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { error: signInError } = await reviewerClient.auth.signInWithPassword({
      email,
      password: "password123",
    });
    if (signInError) throw signInError;

    const { data: pack, error: packError } = await adminClient
      .from("question_packs")
      .insert({
        name: `Reviewer deletion test ${suffix}`,
        is_public: true,
        is_premium: false,
        is_explicit: false,
      })
      .select("id")
      .single();
    if (packError) throw packError;
    packId = pack.id;

    const { error: approveError } = await reviewerClient
      .from("question_packs")
      .update({
        content_status: "allowed",
        content_review_reason: "Approval survives reviewer deletion",
      })
      .eq("id", packId);
    if (approveError) throw approveError;

    const { error: deleteUserError } = await adminClient.auth.admin.deleteUser(
      userId,
    );
    if (deleteUserError) throw deleteUserError;
    userId = undefined;

    const { data: afterDeletion, error: afterDeletionError } = await adminClient
      .from("question_packs")
      .select("content_status, content_review_reason, content_reviewed_by")
      .eq("id", packId)
      .single();
    if (afterDeletionError) throw afterDeletionError;
    assertEquals(afterDeletion.content_status, "allowed");
    assertEquals(
      afterDeletion.content_review_reason,
      "Approval survives reviewer deletion",
    );
    assertEquals(afterDeletion.content_reviewed_by, null);
  } finally {
    if (packId) {
      await adminClient
        .from("content_reviews")
        .delete()
        .eq("entity_type", "question_packs")
        .eq("entity_id", packId);
      await adminClient.from("question_packs").delete().eq("id", packId);
    }
    if (userId) {
      await adminClient.from("admin_users").delete().eq("user_id", userId);
      await adminClient.auth.admin.deleteUser(userId);
    }
  }
});
