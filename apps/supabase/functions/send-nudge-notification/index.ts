import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0?target=deno";

/**
 * Send a nudge notification to partner.
 * Rate limited to once per 12 hours.
 *
 * Called directly from the client when user taps "Nudge partner" button.
 * Requires authentication via JWT.
 */

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Rate limit: 12 hours in milliseconds
const NUDGE_COOLDOWN_MS = 12 * 60 * 60 * 1000;

interface ExpoPushMessage {
    to: string;
    title: string;
    body: string;
    sound?: string;
    data?: Record<string, unknown>;
}

async function sendExpoPushNotification(message: ExpoPushMessage) {
    const response = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
        },
        body: JSON.stringify(message),
    });

    if (!response.ok) {
        const error = await response.text();
        console.error("Expo push error:", error);
        throw new Error(`Failed to send push notification: ${error}`);
    }

    return response.json();
}

Deno.serve(async (req) => {
    // Handle CORS preflight
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    if (req.method !== "POST") {
        return new Response("Method not allowed", { status: 405, headers: corsHeaders });
    }

    try {
        // Get user from JWT (manual validation as per CLAUDE.md)
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

        // Get the user's profile with couple info
        const { data: profile, error: profileError } = await supabase
            .from("profiles")
            .select("id, name, couple_id, last_nudge_sent_at")
            .eq("id", user.id)
            .maybeSingle();

        if (profileError || !profile) {
            console.error("Error fetching profile:", profileError);
            return new Response(
                JSON.stringify({ error: "Profile not found" }),
                { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        if (!profile.couple_id) {
            return new Response(
                JSON.stringify({ error: "Not in a couple" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Check rate limiting
        const now = new Date();
        if (profile.last_nudge_sent_at) {
            const lastNudge = new Date(profile.last_nudge_sent_at);
            const timeSinceLastNudge = now.getTime() - lastNudge.getTime();

            if (timeSinceLastNudge < NUDGE_COOLDOWN_MS) {
                const cooldownRemaining = NUDGE_COOLDOWN_MS - timeSinceLastNudge;
                const nextNudgeAvailable = new Date(lastNudge.getTime() + NUDGE_COOLDOWN_MS);

                return new Response(
                    JSON.stringify({
                        error: "Rate limited",
                        cooldown_remaining_seconds: Math.ceil(cooldownRemaining / 1000),
                        next_nudge_available_at: nextNudgeAvailable.toISOString(),
                    }),
                    { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
            }
        }

        // Get the partner
        const { data: partner, error: partnerError } = await supabase
            .from("profiles")
            .select("id, name, push_token")
            .eq("couple_id", profile.couple_id)
            .neq("id", user.id)
            .maybeSingle();

        if (partnerError) {
            console.error("Error fetching partner:", partnerError);
            return new Response(
                JSON.stringify({ error: "Failed to find partner" }),
                { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        if (!partner) {
            return new Response(
                JSON.stringify({ error: "Partner not found" }),
                { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Update last_nudge_sent_at FIRST (prevents gaming by quickly re-sending)
        const { error: updateError } = await supabase
            .from("profiles")
            .update({ last_nudge_sent_at: now.toISOString() })
            .eq("id", user.id);

        if (updateError) {
            console.error("Error updating last_nudge_sent_at:", updateError);
            return new Response(
                JSON.stringify({ error: "Failed to update nudge timestamp" }),
                { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Check partner's notification preferences
        const { data: prefs } = await supabase
            .from("notification_preferences")
            .select("nudges_enabled")
            .eq("user_id", partner.id)
            .maybeSingle();

        // If prefs don't exist or nudges_enabled is not explicitly false, send notification
        const nudgesEnabled = prefs?.nudges_enabled !== false;

        // Check if partner has a push token
        if (!partner.push_token) {
            console.log(`Partner ${partner.id} has no push token`);
            return new Response(
                JSON.stringify({
                    success: true,
                    notification_sent: false,
                    reason: "no_push_token",
                    next_nudge_available_at: new Date(now.getTime() + NUDGE_COOLDOWN_MS).toISOString(),
                }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Skip sending if partner has disabled nudge notifications
        if (!nudgesEnabled) {
            console.log(`Partner ${partner.id} has disabled nudge notifications`);
            return new Response(
                JSON.stringify({
                    success: true,
                    notification_sent: false,
                    reason: "nudges_disabled",
                    next_nudge_available_at: new Date(now.getTime() + NUDGE_COOLDOWN_MS).toISOString(),
                }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Send the push notification
        const userName = profile.name || "Your partner";

        await sendExpoPushNotification({
            to: partner.push_token,
            title: "Partner nudge",
            body: `${userName} wants you to catch up!`,
            sound: "default",
            data: { type: "nudge" },
        });

        console.log(`Nudge notification sent from ${user.id} to ${partner.id}`);

        return new Response(
            JSON.stringify({
                success: true,
                notification_sent: true,
                next_nudge_available_at: new Date(now.getTime() + NUDGE_COOLDOWN_MS).toISOString(),
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    } catch (error) {
        console.error("Nudge notification error:", error);
        return new Response(
            JSON.stringify({ error: "Internal server error" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
