import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0?target=deno";

/**
 * Send push notification reminders to unpaired users.
 * Called by pg_cron daily at 18:00 UTC.
 *
 * Targets users where:
 * - couple_id IS NULL (no partner yet)
 * - push_token IS NOT NULL (can receive notifications)
 * - last_unpaired_reminder_at IS NULL or older than 3 days
 * - unpaired_reminders_enabled is not false in notification_preferences
 */

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const REMINDER_COOLDOWN_DAYS = 3;

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
        const supabase = createClient(
            Deno.env.get("SUPABASE_URL")!,
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        );

        const now = new Date();
        const cutoff = new Date(now.getTime() - REMINDER_COOLDOWN_DAYS * 24 * 60 * 60 * 1000);

        // Get unpaired users with push tokens who haven't been reminded recently
        const { data: users, error: usersError } = await supabase
            .from("profiles")
            .select("id, push_token, couple_id, last_unpaired_reminder_at")
            .is("couple_id", null)
            .not("push_token", "is", null)
            .or(`last_unpaired_reminder_at.is.null,last_unpaired_reminder_at.lt.${cutoff.toISOString()}`);

        if (usersError) {
            console.error("Error fetching unpaired users:", usersError);
            return new Response(
                JSON.stringify({ error: "Failed to fetch users" }),
                { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        if (!users || users.length === 0) {
            return new Response(
                JSON.stringify({ success: true, sent: 0, message: "No eligible users" }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Get notification preferences for these users to check opt-out
        const userIds = users.map((u) => u.id);
        const { data: prefs } = await supabase
            .from("notification_preferences")
            .select("user_id, unpaired_reminders_enabled")
            .in("user_id", userIds);

        const disabledUsers = new Set(
            (prefs || [])
                .filter((p) => p.unpaired_reminders_enabled === false)
                .map((p) => p.user_id)
        );

        // Check which users have a couple (invite code created but no partner yet)
        const { data: couples } = await supabase
            .from("couples")
            .select("id, user1_id")
            .in("user1_id", userIds);

        const usersWithCouple = new Set(
            (couples || []).map((c) => c.user1_id)
        );

        let sent = 0;
        let skipped = 0;

        for (const user of users) {
            // Skip if user opted out
            if (disabledUsers.has(user.id)) {
                skipped++;
                continue;
            }

            const hasCouple = usersWithCouple.has(user.id);
            const title = "Sauci";
            const body = hasCouple
                ? "Your invite code is waiting! Share it with your partner to start discovering what you have in common."
                : "Ready to get started? Create an invite code and share it with your partner!";

            try {
                await sendExpoPushNotification({
                    to: user.push_token,
                    title,
                    body,
                    sound: "default",
                    data: { type: "unpaired_reminder" },
                });

                // Update last_unpaired_reminder_at
                await supabase
                    .from("profiles")
                    .update({ last_unpaired_reminder_at: now.toISOString() })
                    .eq("id", user.id);

                sent++;
            } catch (error) {
                console.error(`Failed to send reminder to ${user.id}:`, error);
            }
        }

        console.log(`Unpaired reminders: sent=${sent}, skipped=${skipped}, total=${users.length}`);

        return new Response(
            JSON.stringify({ success: true, sent, skipped, total: users.length }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    } catch (error) {
        console.error("Unpaired reminder error:", error);
        return new Response(
            JSON.stringify({ error: "Internal server error" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
