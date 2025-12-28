import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// RevenueCat webhook secret (set in dashboard)
const REVENUECAT_WEBHOOK_SECRET = Deno.env.get("REVENUECAT_WEBHOOK_SECRET");

interface RevenueCatEvent {
    api_version: string;
    event: {
        type: string;
        id: string;
        app_user_id: string;
        original_app_user_id: string;
        product_id: string;
        entitlement_ids: string[];
        purchased_at_ms: number;
        expiration_at_ms?: number;
        original_transaction_id: string;
        store: string;
        environment: string;
        cancel_reason?: string;
        grace_period_expiration_at_ms?: number;
    };
}

type SubscriptionStatus = "active" | "cancelled" | "expired" | "billing_issue" | "paused";

Deno.serve(async (req) => {
    // Handle CORS preflight
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    if (req.method !== "POST") {
        return new Response(
            JSON.stringify({ error: "Method not allowed" }),
            { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    try {
        // Verify webhook authorization
        const authHeader = req.headers.get("Authorization");
        if (REVENUECAT_WEBHOOK_SECRET && authHeader !== `Bearer ${REVENUECAT_WEBHOOK_SECRET}`) {
            console.error("Invalid webhook authorization");
            return new Response(
                JSON.stringify({ error: "Unauthorized" }),
                { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const supabase = createClient(
            Deno.env.get("SUPABASE_URL")!,
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        );

        const payload: RevenueCatEvent = await req.json();
        const event = payload.event;

        console.log(`Processing RevenueCat event: ${event.type} for user: ${event.app_user_id}`);

        // Check for duplicate event (idempotency)
        const { data: existingEvent } = await supabase
            .from("revenuecat_webhook_events")
            .select("id")
            .eq("event_id", event.id)
            .maybeSingle();

        if (existingEvent) {
            console.log(`Duplicate event ${event.id}, skipping`);
            return new Response(
                JSON.stringify({ success: true, message: "Duplicate event" }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Record the event
        await supabase.from("revenuecat_webhook_events").insert({
            event_id: event.id,
            event_type: event.type,
            app_user_id: event.app_user_id,
            payload: payload,
        });

        // The app_user_id should be the Supabase user UUID
        const userId = event.app_user_id;

        // Map event type to subscription status
        let status: SubscriptionStatus;
        switch (event.type) {
            case "INITIAL_PURCHASE":
            case "RENEWAL":
            case "UNCANCELLATION":
            case "PRODUCT_CHANGE":
                status = "active";
                break;
            case "CANCELLATION":
                status = "cancelled";
                break;
            case "EXPIRATION":
                status = "expired";
                break;
            case "BILLING_ISSUE":
                status = "billing_issue";
                break;
            case "SUBSCRIPTION_PAUSED":
                status = "paused";
                break;
            case "TEST":
                // Test event - just acknowledge
                console.log("Test event received");
                return new Response(
                    JSON.stringify({ success: true, message: "Test event received" }),
                    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
            default:
                console.log(`Unhandled event type: ${event.type}`);
                return new Response(
                    JSON.stringify({ success: true, message: "Event type not handled" }),
                    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
        }

        // Verify the user exists
        const { data: profile, error: profileError } = await supabase
            .from("profiles")
            .select("id")
            .eq("id", userId)
            .maybeSingle();

        if (profileError || !profile) {
            console.error(`User not found: ${userId}`);
            return new Response(
                JSON.stringify({ error: "User not found", userId }),
                { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Upsert subscription record
        const subscriptionData = {
            user_id: userId,
            revenuecat_app_user_id: event.app_user_id,
            product_id: event.product_id,
            status: status,
            entitlement_ids: event.entitlement_ids || [],
            purchased_at: new Date(event.purchased_at_ms).toISOString(),
            expires_at: event.expiration_at_ms
                ? new Date(event.expiration_at_ms).toISOString()
                : null,
            original_transaction_id: event.original_transaction_id,
            store: event.store,
            is_sandbox: event.environment !== "PRODUCTION",
            cancel_reason: event.cancel_reason || null,
            grace_period_expires_at: event.grace_period_expiration_at_ms
                ? new Date(event.grace_period_expiration_at_ms).toISOString()
                : null,
        };

        const { error: upsertError } = await supabase
            .from("subscriptions")
            .upsert(subscriptionData, {
                onConflict: "user_id,original_transaction_id",
            });

        if (upsertError) {
            console.error("Error upserting subscription:", upsertError);
            // Don't return error - the trigger will still sync premium status
        }

        // The sync_premium_status trigger will automatically update profiles.is_premium

        console.log(`Successfully processed ${event.type} for user ${userId}, status: ${status}`);

        return new Response(
            JSON.stringify({ success: true }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    } catch (error) {
        console.error("Webhook error:", error);
        return new Response(
            JSON.stringify({ error: "Internal server error" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
