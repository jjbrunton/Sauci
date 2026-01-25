import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0?target=deno";

/**
 * Send session-based activity notifications.
 * Called by pg_cron every minute and processes any pending notifications
 * whose notify_at has passed (5 minutes of user inactivity).
 *
 * Sends notification to the PARTNER of the active user with copy:
 * "[Partner] has been answering questions!"
 */

interface PendingMatchNotification {
    id: string;
    couple_id: string;
    active_user_id: string | null;
    match_count: number;
    response_count: number;
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
            .select("id, couple_id, active_user_id, match_count, response_count, latest_match_id, notify_at")
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

        // Fetch all profiles for couples (need name, push_token, last_active_at, prefs)
        const { data: profiles, error: profilesError } = await supabase
            .from("profiles")
            .select(
                `
                id,
                name,
                couple_id,
                push_token,
                last_active_at,
                notification_preferences:notification_preferences(partner_activity_enabled)
            `
            )
            .in("couple_id", coupleIds);

        if (profilesError) {
            console.error("Error fetching profiles:", profilesError);
            return new Response(
                JSON.stringify({ error: profilesError.message }),
                { status: 500, headers: { "Content-Type": "application/json" } }
            );
        }

        const profilesByCouple = new Map<string, any[]>();
        const profilesById = new Map<string, any>();
        for (const profile of profiles || []) {
            const list = profilesByCouple.get(profile.couple_id) ?? [];
            list.push(profile);
            profilesByCouple.set(profile.couple_id, list);
            profilesById.set(profile.id, profile);
        }

        // Helper to check if user is currently active (within last 5 minutes)
        const isUserActive = (lastActiveAt: string | null): boolean => {
            if (!lastActiveAt) return false;
            const lastActive = new Date(lastActiveAt).getTime();
            const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
            return lastActive > fiveMinutesAgo;
        };

        const messages: ExpoPushMessage[] = [];
        const processedIds: string[] = [];

        for (const notification of pendingNotifications as PendingMatchNotification[]) {
            const coupleProfiles = profilesByCouple.get(notification.couple_id) ?? [];

            // Find the active user (the one who was answering) and their partner
            const activeUser = notification.active_user_id
                ? profilesById.get(notification.active_user_id)
                : null;

            // Find the partner (the one who should receive the notification)
            const partner = coupleProfiles.find(p => p.id !== notification.active_user_id);

            // Skip if we can't identify the partner or they have no push token
            if (!partner || !partner.push_token) {
                processedIds.push(notification.id);
                continue;
            }

            // Skip if partner is currently active in the app
            if (isUserActive(partner.last_active_at)) {
                console.log(`Skipping notification - partner ${partner.id} is active in app`);
                processedIds.push(notification.id);
                continue;
            }

            // Check notification preferences (partner_activity_enabled)
            const prefs = Array.isArray(partner.notification_preferences)
                ? partner.notification_preferences[0]
                : partner.notification_preferences;

            if (prefs && prefs.partner_activity_enabled === false) {
                processedIds.push(notification.id);
                continue;
            }

            // Get active user's name for personalized notification
            const activeUserName = activeUser?.name || "Your partner";
            const matchCount = Math.max(0, Number(notification.match_count) || 0);

            // Build notification message
            // Primary message: "[Partner] has been answering questions!"
            // Include match count in body if there are matches
            let body = `Tap to see what you both said`;
            if (matchCount > 0) {
                body = matchCount === 1
                    ? `You have a new match! Tap to see what you both said`
                    : `You have ${matchCount} new matches! Tap to see what you both said`;
            }

            messages.push({
                to: partner.push_token,
                title: `${activeUserName} has been answering questions! 💕`,
                body,
                sound: "default",
                data: {
                    type: "match_digest",
                    count: matchCount,
                    match_id: notification.latest_match_id,
                },
            });

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
