import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0?target=deno";

/**
 * Process scheduled pack releases.
 * Called by pg_cron every 5 minutes to check for packs with scheduled_release_at in the past.
 *
 * When a pack's release time arrives:
 * 1. Set is_public = true to make the pack available
 * 2. Send notification to all users who have new_packs_enabled
 * 3. Set release_notified = true to prevent duplicate notifications
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
        // Get all packs due for release
        const { data: duePacks, error: fetchError } = await supabase
            .from("question_packs")
            .select("id, name, description")
            .eq("is_public", false)
            .eq("release_notified", false)
            .not("scheduled_release_at", "is", null)
            .lte("scheduled_release_at", new Date().toISOString());

        if (fetchError) {
            console.error("Error fetching due packs:", fetchError);
            return new Response(
                JSON.stringify({ error: fetchError.message }),
                { status: 500, headers: { "Content-Type": "application/json" } }
            );
        }

        if (!duePacks || duePacks.length === 0) {
            return new Response(
                JSON.stringify({ released: 0, message: "No packs due for release" }),
                { headers: { "Content-Type": "application/json" } }
            );
        }

        const packIds = duePacks.map(p => p.id);

        // Make packs public
        const { error: updateError } = await supabase
            .from("question_packs")
            .update({
                is_public: true,
                release_notified: true,
            })
            .in("id", packIds);

        if (updateError) {
            console.error("Error updating packs:", updateError);
            return new Response(
                JSON.stringify({ error: updateError.message }),
                { status: 500, headers: { "Content-Type": "application/json" } }
            );
        }

        // Get all users with push tokens who want new pack notifications
        // We join with notification_preferences and filter for new_packs_enabled = true (or null, which defaults to true)
        const { data: users, error: usersError } = await supabase
            .from("profiles")
            .select(`
                id,
                push_token,
                notification_preferences:notification_preferences(new_packs_enabled)
            `)
            .not("push_token", "is", null);

        if (usersError) {
            console.error("Error fetching users:", usersError);
            // Packs are already released, just log error and continue
        }

        const messages: ExpoPushMessage[] = [];

        if (users && users.length > 0) {
            for (const user of users) {
                // Check notification preferences
                // notification_preferences is an array (due to how Supabase returns joined data)
                const prefs = Array.isArray(user.notification_preferences)
                    ? user.notification_preferences[0]
                    : user.notification_preferences;

                // Skip if user has explicitly disabled new_packs notifications
                if (prefs && prefs.new_packs_enabled === false) {
                    continue;
                }

                // Send notification for each released pack
                for (const pack of duePacks) {
                    messages.push({
                        to: user.push_token!,
                        title: "New pack available",
                        body: `${pack.name} is now available to play!`,
                        sound: "default",
                        data: { type: "new_pack", packId: pack.id },
                    });
                }
            }
        }

        // Send all notifications
        if (messages.length > 0) {
            await sendExpoPushNotifications(messages);
        }

        console.log(`Released ${duePacks.length} packs, sent ${messages.length} notifications`);

        return new Response(
            JSON.stringify({
                released: duePacks.length,
                packNames: duePacks.map(p => p.name),
                notificationsSent: messages.length,
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
