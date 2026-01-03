
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { assert } from "std/testing/asserts.ts";

export const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "http://127.0.0.1:54321";
export const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("SUPABASE_SERVICE_ROLE_KEY is required");
}

export const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

export async function createTestUser(email: string) {
  const { data, error } = await adminClient.auth.admin.createUser({
    email,
    password: "password123",
    email_confirm: true,
  });

  if (error) throw error;
  if (!data.user) throw new Error("User not created");

  return data.user;
}

export async function signInUser(email: string) {
  const { data, error } = await adminClient.auth.signInWithPassword({
    email,
    password: "password123",
  });

  if (error) throw error;
  return data.session;
}

export async function createTestQuestion(packId?: string) {
    let finalPackId = packId;
    if (!finalPackId) {
        const { data: pack } = await adminClient.from("question_packs").insert({
            name: "Test Pack " + Math.random(),
            is_premium: false,
            sort_order: 999
        }).select().single();
        finalPackId = pack!.id;
    }

    const { data: question } = await adminClient.from("questions").insert({
        pack_id: finalPackId,
        text: "Test Question?",
        intensity: 1
    }).select().single();

    return { question, packId: finalPackId };
}

export async function createRedemptionCode() {
    const code = "TEST-" + Math.random().toString(36).substring(7).toUpperCase();
    const { data, error } = await adminClient.from("redemption_codes").insert({
        code,
        max_uses: 1,
        active: true,
        expires_at: new Date(Date.now() + 3600000).toISOString() // 1 hour
    }).select().single();

    if (error) throw error;
    return data;
}

export async function createCouple(user1Id: string, user2Id: string) {
  // 1. Create a couple
  const { data: couple, error: coupleError } = await adminClient
    .from("couples")
    .insert({
        // invite_code is unique, so generate a random one
        invite_code: Math.random().toString(36).substring(7),
    })
    .select()
    .single();

  if (coupleError) throw coupleError;

  // 2. Link users to couple
  const { error: updateError } = await adminClient
    .from("profiles")
    .update({ couple_id: couple.id })
    .in("id", [user1Id, user2Id]);

  if (updateError) throw updateError;

  return couple;
}

export async function cleanup(userIds: string[], coupleId?: string) {
  // Delete couple (should cascade to matches, responses, etc. if configured, but let's be safe)
  // Based on schema analysis, explicit cleanup is safer.
  
  if (coupleId) {
      await adminClient.from("matches").delete().eq("couple_id", coupleId);
      await adminClient.from("responses").delete().eq("couple_id", coupleId);
      await adminClient.from("couples").delete().eq("id", coupleId);
  }

  // Delete users (cascades to profiles)
  for (const id of userIds) {
    await adminClient.auth.admin.deleteUser(id);
  }
}
