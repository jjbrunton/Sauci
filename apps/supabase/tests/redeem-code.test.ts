
import { assertEquals } from "std/testing/asserts.ts";
import { createTestUser, createRedemptionCode, cleanup, adminClient, SUPABASE_URL } from "./utils.ts";

const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/redeem-code`;

Deno.test("redeem-code: successfully redeems code for user", async () => {
    const email = `test_redeem_${Date.now()}@example.com`;
    let userIds: string[] = [];
    let codeId: string | undefined;

    try {
        // 1. Setup User
        const user = await createTestUser(email);
        userIds = [user.id];

        // 2. Setup Code
        const codeData = await createRedemptionCode();
        codeId = codeData.id;

        // 3. Call Function
        const res = await fetch(FUNCTION_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                email,
                code: codeData.code
            })
        });

        const data = await res.json();
        assertEquals(res.status, 200);
        assertEquals(data.success, true);

        // 4. Verify Profile is Premium
        const { data: profile } = await adminClient
            .from("profiles")
            .select("is_premium")
            .eq("id", user.id)
            .single();
        
        assertEquals(profile.is_premium, true);

    } finally {
        await cleanup(userIds);
        if (codeId) await adminClient.from("redemption_codes").delete().eq("id", codeId);
    }
});
