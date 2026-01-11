import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Send delayed pack change notifications.
 * Called by pg_cron every 5 minutes to check for pending notifications
 * where notify_at has passed.
 *
 * Notifications are sent when a user enables new question packs. The notification
 * is delayed by 30 minutes, with the timer resetting on each new pack enable.
 * This prevents spam when a user enables multiple packs in quick succession.
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
            .from("pending_pack_notifications")
            .select("id, couple_id, changed_by_user_id, notify_at")
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

        for (const notification of pendingNotifications) {
            // Get the partner's push token (not the user who made changes)
            const { data: partner, error: partnerError } = await supabase
                .from("profiles")
                .select("push_token")
                .eq("couple_id", notification.couple_id)
                .neq("id", notification.changed_by_user_id)
                .maybeSingle();

            if (partnerError) {
                console.error(
                    `Error fetching partner for couple ${notification.couple_id}:`,
                    partnerError
                );
                continue;
            }

            if (partner?.push_token) {
                messages.push({
                    to: partner.push_token,
                    title: "Question packs updated",
                    body: "Your partner updated the question packs",
                    sound: "default",
                    data: { type: "pack_change" },
                });
            }

            processedIds.push(notification.id);
        }

        // Send all notifications
        if (messages.length > 0) {
            await sendExpoPushNotifications(messages);
        }

        // Delete processed notifications
        if (processedIds.length > 0) {
            const { error: deleteError } = await supabase
                .from("pending_pack_notifications")
                .delete()
                .in("id", processedIds);

            if (deleteError) {
                console.error("Error deleting processed notifications:", deleteError);
            }
        }

        console.log(`Sent ${messages.length} pack change notifications`);

        return new Response(
            JSON.stringify({
                sent: messages.length,
                processed: processedIds.length,
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
