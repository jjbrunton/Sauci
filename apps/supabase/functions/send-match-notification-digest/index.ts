import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Send coalesced match notifications.
 * Called by pg_cron every minute and processes any pending notifications
 * whose notify_at has passed.
 */

interface PendingMatchNotification {
    id: string;
    couple_id: string;
    match_count: number;
    latest_match_id: string | null;
    notify_at: string;
}

interface ExpoPushMessage {
    to: string;
    title: string;
    body: string;
    sound?: string;
    data?: Record<string, unknown>;
}

async function sendExpoPushNotifications(messages: ExpoPushMessage[]) {
    if (messages.length === 0) return;

    // Expo accepts max 100 messages per request
    const chunks: ExpoPushMessage[][] = [];
    for (let i = 0; i < messages.length; i += 100) {
        chunks.push(messages.slice(i, i + 100));
    }

    for (const chunk of chunks) {
        const response = await fetch("https://exp.host/--/api/v2/push/send", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
            },
            body: JSON.stringify(chunk),
        });

        if (!response.ok) {
            const error = await response.text();
            console.error("Expo push error:", error);
            // Continue with other chunks even if one fails
        }
    }
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
        const nowIso = new Date().toISOString();

        // Get all pending notifications where notify_at has passed
        const { data: pendingNotifications, error: fetchError } = await supabase
            .from("pending_match_notifications")
            .select("id, couple_id, match_count, latest_match_id, notify_at")
            .lte("notify_at", nowIso);

        if (fetchError) {
            console.error("Error fetching pending match notifications:", fetchError);
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

        const coupleIds = Array.from(new Set(pendingNotifications.map((n) => n.couple_id)));

        // Fetch all push tokens + match notification preference for couples
        const { data: profiles, error: profilesError } = await supabase
            .from("profiles")
            .select(
                `
                id,
                couple_id,
                push_token,
                notification_preferences:notification_preferences(matches_enabled)
            `
            )
            .in("couple_id", coupleIds)
            .not("push_token", "is", null);

        if (profilesError) {
            console.error("Error fetching profiles:", profilesError);
            return new Response(
                JSON.stringify({ error: profilesError.message }),
                { status: 500, headers: { "Content-Type": "application/json" } }
            );
        }

        const profilesByCouple = new Map<string, any[]>();
        for (const profile of profiles || []) {
            const list = profilesByCouple.get(profile.couple_id) ?? [];
            list.push(profile);
            profilesByCouple.set(profile.couple_id, list);
        }

        const messages: ExpoPushMessage[] = [];
        const processedIds: string[] = [];

        for (const notification of pendingNotifications as PendingMatchNotification[]) {
            const coupleProfiles = profilesByCouple.get(notification.couple_id) ?? [];

            for (const profile of coupleProfiles) {
                const prefs = Array.isArray(profile.notification_preferences)
                    ? profile.notification_preferences[0]
                    : profile.notification_preferences;

                // Skip if user has explicitly disabled match notifications
                if (prefs && prefs.matches_enabled === false) {
                    continue;
                }

                const count = Math.max(1, Number(notification.match_count) || 1);
                const latestMatchId = notification.latest_match_id;

                // If the match was deleted before the digest fired, don't notify.
                if (!latestMatchId) {
                    continue;
                }

                if (count === 1) {
                    messages.push({
                        to: profile.push_token,
                        title: "It's a match! 💕",
                        body: "You and your partner matched on something new!",
                        sound: "default",
                        data: { type: "match", match_id: latestMatchId },
                    });
                } else {
                    messages.push({
                        to: profile.push_token,
                        title: "New matches 💕",
                        body: `You have ${count} new matches`,
                        sound: "default",
                        // Include latest_match_id for backwards compatibility
                        data: { type: "match_digest", count, match_id: latestMatchId },
                    });
                }
            }

            processedIds.push(notification.id);
        }

        if (messages.length > 0) {
            await sendExpoPushNotifications(messages);
        }

        // Delete processed notifications (even if skipped due to no token/prefs)
        if (processedIds.length > 0) {
            const { error: deleteError } = await supabase
                .from("pending_match_notifications")
                .delete()
                .in("id", processedIds);

            if (deleteError) {
                console.error("Error deleting processed match notifications:", deleteError);
            }
        }

        console.log(
            `Sent ${messages.length} match notifications from ${pendingNotifications.length} pending rows`
        );

        return new Response(
            JSON.stringify({ sent: messages.length, processed: processedIds.length }),
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
