import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0?target=deno";

/**
 * Send batched partner activity notifications.
 * Called by pg_cron every 5 minutes to check for pending notifications
 * where notify_at has passed.
 *
 * Notifications are sent when a user answers questions. The notification
 * is delayed by 1 hour, with the timer resetting on each new response.
 * This prevents spam when a user answers multiple questions in quick succession.
 *
 * Skips sending if the partner was active in the last 15 minutes (they're already in app).
 */

interface ExpoPushMessage {
    to: string;
    title: string;
    body: string;
    sound?: string;
    data?: Record<string, unknown>;
}

async function sendExpoPushNotifications(messages: ExpoPushMessage[]) {
    if (messages.length === 0) return;

    const response = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
        },
        body: JSON.stringify(messages),
    });

    if (!response.ok) {
        const error = await response.text();
        console.error("Expo push error:", error);
        throw new Error(`Failed to send push notification: ${error}`);
    }

    return response.json();
}

Deno.serve(async (req) => {
    // Only allow POST (from cron) or GET (for manual testing)
    if (req.method !== "POST" && req.method !== "GET") {
        return new Response("Method not allowed", { status: 405 });
    }

    const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    try {
        // Get all pending notifications where notify_at has passed
        const { data: pendingNotifications, error: fetchError } = await supabase
            .from("pending_activity_notifications")
            .select("id, couple_id, active_user_id, response_count, notify_at")
            .lte("notify_at", new Date().toISOString());

        if (fetchError) {
            console.error("Error fetching pending notifications:", fetchError);
            return new Response(
                JSON.stringify({ error: fetchError.message }),
                { status: 500, headers: { "Content-Type": "application/json" } }
            );
        }

        if (!pendingNotifications || pendingNotifications.length === 0) {
            return new Response(
                JSON.stringify({ sent: 0, message: "No pending notifications" }),
                { headers: { "Content-Type": "application/json" } }
            );
        }

        const messages: ExpoPushMessage[] = [];
        const processedIds: string[] = [];
        const skippedPartnerActive: string[] = [];
        const skippedNoToken: string[] = [];
        const skippedPrefsDisabled: string[] = [];

        // Time threshold for "partner is active" check (15 minutes ago)
        const activeThreshold = new Date(Date.now() - 15 * 60 * 1000).toISOString();

        for (const notification of pendingNotifications) {
            // Get the partner (not the user who made changes)
            const { data: partner, error: partnerError } = await supabase
                .from("profiles")
                .select("id, push_token, name, last_active_at")
                .eq("couple_id", notification.couple_id)
                .neq("id", notification.active_user_id)
                .maybeSingle();

            if (partnerError) {
                console.error(
                    `Error fetching partner for couple ${notification.couple_id}:`,
                    partnerError
                );
                continue;
            }

            // Skip if partner was active recently (they're already in the app)
            if (partner?.last_active_at && partner.last_active_at > activeThreshold) {
                console.log(
                    `Skipping notification for couple ${notification.couple_id}: partner was active recently`
                );
                skippedPartnerActive.push(notification.id);
                processedIds.push(notification.id); // Still delete the pending notification
                continue;
            }

            // Skip if no push token
            if (!partner?.push_token) {
                skippedNoToken.push(notification.id);
                processedIds.push(notification.id);
                continue;
            }

            // Check notification preferences
            const { data: prefs } = await supabase
                .from("notification_preferences")
                .select("partner_activity_enabled")
                .eq("user_id", partner.id)
                .maybeSingle();

            // Skip if partner has disabled partner_activity notifications
            if (prefs && prefs.partner_activity_enabled === false) {
                skippedPrefsDisabled.push(notification.id);
                processedIds.push(notification.id);
                continue;
            }

            // Get the active user's name for the notification
            const { data: activeUser } = await supabase
                .from("profiles")
                .select("name")
                .eq("id", notification.active_user_id)
                .maybeSingle();

            const userName = activeUser?.name || "Your partner";
            const responseCount = notification.response_count;

            // Craft the notification message
            const body = responseCount === 1
                ? `${userName} answered a question`
                : `${userName} answered ${responseCount} questions`;

            messages.push({
                to: partner.push_token,
                title: "Partner activity",
                body,
                sound: "default",
                data: { type: "partner_activity" },
            });

            processedIds.push(notification.id);
        }

        // Send all notifications
        if (messages.length > 0) {
            await sendExpoPushNotifications(messages);
        }

        // Delete processed notifications
        if (processedIds.length > 0) {
            const { error: deleteError } = await supabase
                .from("pending_activity_notifications")
                .delete()
                .in("id", processedIds);

            if (deleteError) {
                console.error("Error deleting processed notifications:", deleteError);
            }
        }

        console.log(`Sent ${messages.length} partner activity notifications, skipped: partner active=${skippedPartnerActive.length}, no token=${skippedNoToken.length}, prefs disabled=${skippedPrefsDisabled.length}`);

        return new Response(
            JSON.stringify({
                sent: messages.length,
                processed: processedIds.length,
                skipped: {
                    partnerActive: skippedPartnerActive.length,
                    noToken: skippedNoToken.length,
                    prefsDisabled: skippedPrefsDisabled.length,
                },
            }),
            { headers: { "Content-Type": "application/json" } }
        );
    } catch (err) {
        console.error("Unexpected error:", err);
        return new Response(
            JSON.stringify({ error: "Internal server error" }),
            { status: 500, headers: { "Content-Type": "application/json" } }
        );
    }
});
