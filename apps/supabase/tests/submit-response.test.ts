
import { assert, assertEquals } from "std/testing/asserts.ts";
import { createTestUser, createCouple, cleanup, signInUser, createTestQuestion, adminClient, SUPABASE_URL } from "./utils.ts";

const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/submit-response`;

Deno.test("submit-response: creates match when both users answer yes", async () => {
  const email1 = `test_user_1_${Date.now()}@example.com`;
  const email2 = `test_user_2_${Date.now()}@example.com`;
  let coupleId: string | undefined;
  let questionId: string | undefined;
  let packId: string | undefined;
  let users: string[] = [];

  try {
    // 1. Setup Users and Couple
    const user1 = await createTestUser(email1);
    const user2 = await createTestUser(email2);
    users = [user1.id, user2.id];

    const couple = await createCouple(user1.id, user2.id);
    coupleId = couple.id;

    // 2. Setup Question
    const qData = await createTestQuestion();
    questionId = qData.question!.id;
    packId = qData.packId;

    // 3. Sign In Users to get tokens
    const session1 = await signInUser(email1);
    const session2 = await signInUser(email2);

    assert(session1?.access_token, "User 1 should have access token");
    assert(session2?.access_token, "User 2 should have access token");

    // 4. User 1 submits 'yes'
    const res1 = await fetch(FUNCTION_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${session1!.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        question_id: questionId,
        answer: "yes",
      }),
    });

    const data1 = await res1.json();
    assertEquals(res1.status, 200);
    assertEquals(data1.match, null, "First response should not create match");

    // 5. User 2 submits 'yes'
    const res2 = await fetch(FUNCTION_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${session2!.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        question_id: questionId,
        answer: "yes",
      }),
    });

    const data2 = await res2.json();
    assertEquals(res2.status, 200);
    assert(data2.match, "Second response should create match");
    assertEquals(data2.match.match_type, "yes_yes");

    // 6. Verify Match in DB
    const { data: match } = await adminClient
      .from("matches")
      .select("*")
      .eq("id", data2.match.id)
      .single();
    
    assert(match, "Match should exist in DB");
    assertEquals(match.match_type, "yes_yes");

  } finally {
    // Cleanup
    await cleanup(users, coupleId);
    if (questionId) await adminClient.from("questions").delete().eq("id", questionId);
    if (packId) await adminClient.from("question_packs").delete().eq("id", packId);
  }
});
