import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Check for streak milestones and send celebration notifications.
 * Called by pg_cron at 00:05 UTC daily.
 *
 * Milestones: 7, 14, 30, 60, 100 days
 *
 * Key principle: Celebrate achievements, never guilt-trip about breaks.
 */

const MILESTONE_DAYS = [7, 14, 30, 60, 100];

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
        }
    }
}

function getStreakMessage(days: number): { title: string; body: string } {
    switch (days) {
        case 7:
            return {
                title: "1 week streak!",
                body: "You and your partner have been connecting for 7 days straight. Keep it up!",
            };
        case 14:
            return {
                title: "2 week streak!",
                body: "Two weeks of daily connection. You two are on fire!",
            };
        case 30:
            return {
                title: "1 month streak!",
                body: "A whole month of daily connection! You're building something special.",
            };
        case 60:
            return {
                title: "2 month streak!",
                body: "60 days of daily connection. Your commitment is inspiring!",
            };
        case 100:
            return {
                title: "100 day streak!",
                body: "100 days! You've made connection a habit. Incredible!",
            };
        default:
            return {
                title: `${days} day streak!`,
                body: `${days} days of connecting with your partner. Amazing!`,
            };
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
        // Get all streaks that hit a milestone and haven't been celebrated yet
        const { data: streaks, error: fetchError } = await supabase
            .from("couple_streaks")
            .select("couple_id, current_streak, streak_celebrated_at")
            .in("current_streak", MILESTONE_DAYS)
            .filter("current_streak", "gt", supabase.rpc("coalesce_int", { val: "streak_celebrated_at", fallback: 0 }));

        // Actually, we need a different approach since we can't use coalesce in filters
        // Let's fetch all and filter in code
        const { data: allStreaks, error: allStreaksError } = await supabase
            .from("couple_streaks")
            .select("couple_id, current_streak, streak_celebrated_at");

        if (allStreaksError) {
            console.error("Error fetching streaks:", allStreaksError);
            return new Response(
                JSON.stringify({ error: allStreaksError.message }),
                { status: 500, headers: { "Content-Type": "application/json" } }
            );
        }

        // Filter for uncelebrated milestones
        const uncelebratedMilestones = (allStreaks || []).filter(streak =>
            MILESTONE_DAYS.includes(streak.current_streak) &&
            streak.current_streak > (streak.streak_celebrated_at || 0)
        );

        if (uncelebratedMilestones.length === 0) {
            return new Response(
                JSON.stringify({ celebrated: 0, message: "No milestones to celebrate" }),
                { headers: { "Content-Type": "application/json" } }
            );
        }

        const messages: ExpoPushMessage[] = [];
        const celebratedCouples: string[] = [];

        for (const streak of uncelebratedMilestones) {
            // Get both partners' profiles
            const { data: profiles, error: profilesError } = await supabase
                .from("profiles")
                .select(`
                    id,
                    push_token,
                    notification_preferences:notification_preferences(streak_milestones_enabled)
                `)
                .eq("couple_id", streak.couple_id);

            if (profilesError) {
                console.error(`Error fetching profiles for couple ${streak.couple_id}:`, profilesError);
                continue;
            }

            const { title, body } = getStreakMessage(streak.current_streak);

            for (const profile of profiles || []) {
                // Check notification preferences
                const prefs = Array.isArray(profile.notification_preferences)
                    ? profile.notification_preferences[0]
                    : profile.notification_preferences;

                // Skip if user has explicitly disabled streak milestone notifications
                if (prefs && prefs.streak_milestones_enabled === false) {
                    continue;
                }

                if (profile.push_token) {
                    messages.push({
                        to: profile.push_token,
                        title,
                        body,
                        sound: "default",
                        data: {
                            type: "streak_milestone",
                            streak: streak.current_streak,
                        },
                    });
                }
            }

            celebratedCouples.push(streak.couple_id);

            // Mark milestone as celebrated
            await supabase
                .from("couple_streaks")
                .update({ streak_celebrated_at: streak.current_streak })
                .eq("couple_id", streak.couple_id);
        }

        // Send all notifications
        if (messages.length > 0) {
            await sendExpoPushNotifications(messages);
        }

        console.log(`Celebrated ${celebratedCouples.length} milestones, sent ${messages.length} notifications`);

        return new Response(
            JSON.stringify({
                celebrated: celebratedCouples.length,
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
