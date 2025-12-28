import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// RevenueCat API key (secret key, not public)
const REVENUECAT_API_KEY = Deno.env.get("REVENUECAT_API_KEY");
const ENTITLEMENT_ID = Deno.env.get("REVENUECAT_ENTITLEMENT_ID") || "Sauci Pro";

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        // Get user from JWT
        const authHeader = req.headers.get("Authorization");
        if (!authHeader) {
            return new Response(
                JSON.stringify({ error: "Missing authorization" }),
                { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const supabase = createClient(
            Deno.env.get("SUPABASE_URL")!,
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        );

        // Verify the JWT and get user
        const token = authHeader.replace("Bearer ", "");
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);

        if (authError || !user) {
            return new Response(
                JSON.stringify({ error: "Invalid token" }),
                { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        console.log(`Checking subscription for user: ${user.id}`);
        console.log(`Using entitlement ID: ${ENTITLEMENT_ID}`);
        console.log(`API key present: ${!!REVENUECAT_API_KEY}`);

        // Fetch subscription status from RevenueCat API (server-side verification)
        const rcResponse = await fetch(
            `https://api.revenuecat.com/v1/subscribers/${user.id}`,
            {
                headers: {
                    "Authorization": `Bearer ${REVENUECAT_API_KEY}`,
                    "Content-Type": "application/json",
                },
            }
        );

        console.log(`RevenueCat API response status: ${rcResponse.status}`);

        if (!rcResponse.ok) {
            const errorText = await rcResponse.text();
            console.error("RevenueCat API error:", errorText);
            return new Response(
                JSON.stringify({ error: "Failed to verify subscription", details: errorText }),
                { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const rcData = await rcResponse.json();
        console.log("RevenueCat subscriber data:", JSON.stringify(rcData.subscriber?.entitlements || {}));

        const entitlements = rcData.subscriber?.entitlements || {};
        const entitlement = entitlements[ENTITLEMENT_ID];

        console.log(`Found entitlement "${ENTITLEMENT_ID}":`, entitlement ? "yes" : "no");
        if (entitlement) {
            console.log(`Expires: ${entitlement.expires_date}`);
        }

        // Check if entitlement is active
        const isActive = entitlement &&
            new Date(entitlement.expires_date) > new Date();

        console.log(`User ${user.id} subscription status: ${isActive ? "active" : "inactive"}`);

        // Update the database
        const { error: updateError } = await supabase
            .from("profiles")
            .update({ is_premium: isActive })
            .eq("id", user.id);

        if (updateError) {
            console.error("Database update error:", updateError);
            return new Response(
                JSON.stringify({ error: "Failed to update status" }),
                { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        return new Response(
            JSON.stringify({ success: true, is_premium: isActive }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    } catch (error) {
        console.error("Sync error:", error);
        return new Response(
            JSON.stringify({ error: "Internal server error" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
