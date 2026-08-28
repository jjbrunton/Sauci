import { createClient } from "@supabase/supabase-js";
import { assert, assertEquals, assertMatch } from "std/assert/mod.ts";
import {
  adminClient,
  cleanup,
  createCouple,
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

Deno.test("catalogue enforcement exposes only reviewed allowed content to existing clients", async () => {
  const suffix = crypto.randomUUID();
  const email1 = `catalogue-enforcement-1-${suffix}@example.com`;
  const email2 = `catalogue-enforcement-2-${suffix}@example.com`;
  const userIds: string[] = [];
  const entityIds: string[] = [];
  let coupleId: string | undefined;
  let categoryId: string | undefined;
  let packIds: string[] = [];
  let questionIds: string[] = [];
  let darePackIds: string[] = [];
  let dareIds: string[] = [];

  try {
    const { data: category, error: categoryInsertError } = await adminClient
      .from("categories")
      .insert({ name: `Enforcement category ${suffix}`, is_public: true })
      .select("id")
      .single();
    if (categoryInsertError) throw categoryInsertError;
    categoryId = category.id;
    entityIds.push(category.id);

    const { data: packs, error: packInsertError } = await adminClient
      .from("question_packs")
      .insert([
        {
          name: `Allowed pack ${suffix}`,
          category_id: categoryId,
          is_public: true,
        },
        {
          name: `Archived pack ${suffix}`,
          category_id: categoryId,
          is_public: true,
        },
        {
          name: `Unreviewed pack ${suffix}`,
          category_id: categoryId,
          is_public: true,
        },
      ])
      .select("id");
    if (packInsertError) throw packInsertError;
    packIds = packs.map((pack) => pack.id);
    entityIds.push(...packIds);

    const { data: questions, error: questionInsertError } = await adminClient
      .from("questions")
      .insert(packIds.map((packId, index) => ({
        pack_id: packId,
        text: `Enforcement question ${index} ${suffix}`,
        intensity: 1,
      })))
      .select("id");
    if (questionInsertError) throw questionInsertError;
    questionIds = questions.map((question) => question.id);
    entityIds.push(...questionIds);

    const { data: darePacks, error: darePackInsertError } = await adminClient
      .from("dare_packs")
      .insert([
        {
          name: `Allowed dare pack ${suffix}`,
          category_id: categoryId,
          is_public: true,
        },
        {
          name: `Archived dare pack ${suffix}`,
          category_id: categoryId,
          is_public: true,
        },
      ])
      .select("id");
    if (darePackInsertError) throw darePackInsertError;
    darePackIds = darePacks.map((pack) => pack.id);
    entityIds.push(...darePackIds);

    const { data: dares, error: dareInsertError } = await adminClient
      .from("dares")
      .insert(darePackIds.map((packId, index) => ({
        pack_id: packId,
        text: `Enforcement dare ${index} ${suffix}`,
        intensity: 1,
      })))
      .select("id");
    if (dareInsertError) throw dareInsertError;
    dareIds = dares.map((dare) => dare.id);
    entityIds.push(...dareIds);

    const reviewResults = await Promise.all([
      adminClient.from("categories").update({
        content_status: "allowed",
        content_review_reason: "Allowed fixture category",
      }).eq("id", categoryId),
      adminClient.from("question_packs").update({
        content_status: "allowed",
        content_review_reason: "Allowed fixture pack",
      }).eq("id", packIds[0]),
      adminClient.from("question_packs").update({
        content_status: "archived",
        content_review_reason: "Archived fixture pack",
      }).eq("id", packIds[1]),
      adminClient.from("questions").update({
        content_status: "allowed",
        content_review_reason: "Allowed fixture question",
      }).eq("id", questionIds[0]),
      adminClient.from("questions").update({
        content_status: "archived",
        content_review_reason: "Archived fixture question",
      }).eq("id", questionIds[1]),
      adminClient.from("dare_packs").update({
        content_status: "allowed",
        content_review_reason: "Allowed fixture dare pack",
      }).eq("id", darePackIds[0]),
      adminClient.from("dare_packs").update({
        content_status: "archived",
        content_review_reason: "Archived fixture dare pack",
      }).eq("id", darePackIds[1]),
      adminClient.from("dares").update({
        content_status: "allowed",
        content_review_reason: "Allowed fixture dare",
      }).eq("id", dareIds[0]),
      adminClient.from("dares").update({
        content_status: "archived",
        content_review_reason: "Archived fixture dare",
      }).eq("id", dareIds[1]),
    ]);
    for (const { error } of reviewResults) if (error) throw error;

    const user1 = await createTestUser(email1);
    const user2 = await createTestUser(email2);
    userIds.push(user1.id, user2.id);
    const couple = await createCouple(user1.id, user2.id);
    coupleId = couple.id;

    const { data: matches, error: matchInsertError } = await adminClient
      .from("matches")
      .insert([
        {
          couple_id: coupleId,
          question_id: questionIds[0],
          match_type: "yes_yes",
        },
        {
          couple_id: coupleId,
          question_id: questionIds[1],
          match_type: "yes_yes",
        },
      ])
      .select("id, question_id");
    if (matchInsertError) throw matchInsertError;

    const userClient = createClient(SUPABASE_URL, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { error: signInError } = await userClient.auth.signInWithPassword({
      email: email1,
      password: "password123",
    });
    if (signInError) throw signInError;

    const [
      { data: visiblePacks, error: packError },
      { data: visibleQuestions, error: questionError },
      { data: visibleDarePacks, error: darePackError },
      { data: visibleDares, error: dareError },
      { data: visibleMatches, error: matchError },
    ] = await Promise.all([
      userClient.from("question_packs").select("id, content_status").in(
        "id",
        packIds,
      ),
      userClient.from("questions").select("id, content_status").in(
        "id",
        questionIds,
      ),
      userClient.from("dare_packs").select("id, content_status").in(
        "id",
        darePackIds,
      ),
      userClient.from("dares").select("id, content_status").in("id", dareIds),
      userClient.from("matches").select("id, question_id").in(
        "id",
        matches.map((match) => match.id),
      ),
    ]);
    if (packError) throw packError;
    if (questionError) throw questionError;
    if (darePackError) throw darePackError;
    if (dareError) throw dareError;
    if (matchError) throw matchError;

    assertEquals(visiblePacks.map((row) => row.id), [packIds[0]]);
    assertEquals(visibleQuestions.map((row) => row.id), [questionIds[0]]);
    assertEquals(visibleDarePacks.map((row) => row.id), [darePackIds[0]]);
    assertEquals(visibleDares.map((row) => row.id), [dareIds[0]]);
    assertEquals(visibleMatches.map((row) => row.question_id), [
      questionIds[0],
    ]);

    const allowedPackId = packIds[0];
    const archivedPackId = packIds[1];
    const {
      data: archivedRecommendations,
      error: archivedRecommendationError,
    } = await userClient.rpc("get_recommended_questions", {
      target_pack_id: archivedPackId,
    });
    if (archivedRecommendationError) throw archivedRecommendationError;
    assertEquals(archivedRecommendations.length, 0);

    const { data: allowedRecommendations, error: allowedRecommendationError } =
      await userClient.rpc(
        "get_recommended_questions",
        {
          target_pack_id: allowedPackId,
        },
      );
    if (allowedRecommendationError) throw allowedRecommendationError;
    assertEquals(allowedRecommendations.map((row: { id: string }) => row.id), [
      questionIds[0],
    ]);

    const [
      { data: archivedTeasers, error: archivedTeaserError },
      { data: allowedTeasers, error: allowedTeaserError },
    ] = await Promise.all([
      userClient.rpc("get_pack_teaser_questions", {
        target_pack_id: archivedPackId,
      }),
      userClient.rpc("get_pack_teaser_questions", {
        target_pack_id: allowedPackId,
      }),
    ]);
    if (archivedTeaserError) throw archivedTeaserError;
    if (allowedTeaserError) throw allowedTeaserError;
    assertEquals(archivedTeasers.length, 0);
    assertEquals(allowedTeasers.map((row: { id: string }) => row.id), [
      questionIds[0],
    ]);

    const { error: archivedPackEnableError } = await userClient
      .from("couple_packs")
      .insert({ couple_id: coupleId, pack_id: archivedPackId, enabled: true });
    assert(archivedPackEnableError);

    const { error: allowedPackEnableError } = await userClient
      .from("couple_packs")
      .insert({ couple_id: coupleId, pack_id: allowedPackId, enabled: true });
    if (allowedPackEnableError) throw allowedPackEnableError;
  } finally {
    await cleanup(userIds, coupleId);
    if (entityIds.length > 0) {
      await adminClient.from("content_reviews").delete().in(
        "entity_id",
        entityIds,
      );
    }
    if (questionIds.length > 0) {
      await adminClient.from("questions").delete().in("id", questionIds);
    }
    if (packIds.length > 0) {
      await adminClient.from("question_packs").delete().in("id", packIds);
    }
    if (dareIds.length > 0) {
      await adminClient.from("dares").delete().in("id", dareIds);
    }
    if (darePackIds.length > 0) {
      await adminClient.from("dare_packs").delete().in("id", darePackIds);
    }
    if (categoryId) {
      await adminClient.from("categories").delete().eq("id", categoryId);
    }
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

    // Enforcement is fail closed for existing clients: archived rows are hidden
    // even when their legacy is_public flag remains true.
    const { data: archivedRows, error: visibilityError } = await userClient
      .from("question_packs")
      .select("id, content_status")
      .eq("id", packId);
    if (visibilityError) throw visibilityError;
    assertEquals(archivedRows.length, 0);

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
      throw new Error(
        "Expected pack creator catalogue decision to be rejected",
      );
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
      .update({
        content_review_reason: "Test approval independently rechecked",
      })
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
      throw new Error(
        "Expected pack creator review metadata change to be rejected",
      );
    }
    assertMatch(forgedReason.message, /Only super admins/i);

    const { error: forgedReviewer } = await userClient
      .from("question_packs")
      .update({ content_reviewed_by: null })
      .eq("id", packId);
    if (!forgedReviewer) {
      throw new Error(
        "Expected database-managed reviewer metadata to be rejected",
      );
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
    const { error: signInError } = await reviewerClient.auth.signInWithPassword(
      {
        email,
        password: "password123",
      },
    );
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
