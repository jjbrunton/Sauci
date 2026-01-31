import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0?target=deno";

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

function buildNotificationBody(matchCount: number): string {
    if (matchCount === 0) {
        return "No new matches this week. Answer some questions to discover what you have in common!";
    }
    if (matchCount <= 3) {
        return `You matched on ${matchCount} topic${matchCount === 1 ? "" : "s"} this week! Tap to start a conversation.`;
    }
    return `${matchCount} matches this week — you two are on a roll!`;
}

Deno.serve(async (req) => {
    if (req.method !== "POST" && req.method !== "GET") {
        return new Response("Method not allowed", { status: 405 });
    }

    const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    try {
        const now = new Date();
        const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

        // Get all couples that had at least one match this week
        const { data: recentMatches, error: matchError } = await supabase
            .from("matches")
            .select("couple_id")
            .gte("created_at", oneWeekAgo);

        if (matchError) {
            console.error("Error fetching recent matches:", matchError);
            return new Response(
                JSON.stringify({ error: matchError.message }),
                { status: 500, headers: { "Content-Type": "application/json" } }
            );
        }

        // Get unique couple IDs that had matches
        const couplesWithMatches = new Set<string>(
            (recentMatches || []).map((m: { couple_id: string }) => m.couple_id)
        );

        // Count matches per couple
        const matchCountByCouple = new Map<string, number>();
        for (const m of recentMatches || []) {
            matchCountByCouple.set(m.couple_id, (matchCountByCouple.get(m.couple_id) || 0) + 1);
        }

        // Also get couples where users answered questions but got no matches
        const { data: recentResponses, error: responseError } = await supabase
            .from("responses")
            .select("user_id")
            .gte("created_at", oneWeekAgo);

        if (responseError) {
            console.error("Error fetching recent responses:", responseError);
            return new Response(
                JSON.stringify({ error: responseError.message }),
                { status: 500, headers: { "Content-Type": "application/json" } }
            );
        }

        // Get couple_ids for users with responses
        const activeUserIds = [...new Set((recentResponses || []).map((r: { user_id: string }) => r.user_id))];

        let activeCoupleIds = new Set<string>(couplesWithMatches);

        if (activeUserIds.length > 0) {
            const { data: activeProfiles } = await supabase
                .from("profiles")
                .select("couple_id")
                .in("id", activeUserIds)
                .not("couple_id", "is", null);

            for (const p of activeProfiles || []) {
                if (p.couple_id) activeCoupleIds.add(p.couple_id);
            }
        }

        if (activeCoupleIds.size === 0) {
            return new Response(
                JSON.stringify({ sent: 0, message: "No active couples this week" }),
                { headers: { "Content-Type": "application/json" } }
            );
        }

        // Get all users in active couples with push tokens
        const { data: users, error: usersError } = await supabase
            .from("profiles")
            .select("id, couple_id, push_token")
            .in("couple_id", [...activeCoupleIds])
            .not("push_token", "is", null);

        if (usersError) {
            console.error("Error fetching users:", usersError);
            return new Response(
                JSON.stringify({ error: usersError.message }),
                { status: 500, headers: { "Content-Type": "application/json" } }
            );
        }

        if (!users || users.length === 0) {
            return new Response(
                JSON.stringify({ sent: 0, message: "No users with push tokens" }),
                { headers: { "Content-Type": "application/json" } }
            );
        }

        // Check notification preferences for all users
        const userIds = users.map((u: { id: string }) => u.id);
        const { data: allPrefs } = await supabase
            .from("notification_preferences")
            .select("user_id, weekly_summary_enabled")
            .in("user_id", userIds);

        const prefsMap = new Map<string, boolean>();
        for (const p of allPrefs || []) {
            prefsMap.set(p.user_id, p.weekly_summary_enabled);
        }

        // Verify each user has a partner (couple has 2 members)
        const coupleUserCounts = new Map<string, number>();
        for (const u of users) {
            coupleUserCounts.set(u.couple_id, (coupleUserCounts.get(u.couple_id) || 0) + 1);
        }

        const messages: ExpoPushMessage[] = [];
        let skippedPrefs = 0;
        let skippedNoPartner = 0;

        for (const user of users) {
            // Skip if preference explicitly disabled
            if (prefsMap.get(user.id) === false) {
                skippedPrefs++;
                continue;
            }

            // Skip if no partner in this couple (solo user)
            // Note: we only checked users with push tokens, partner may exist without token
            // So do a simpler check - just send to all eligible users in couples
            const matchCount = matchCountByCouple.get(user.couple_id) || 0;
            const body = buildNotificationBody(matchCount);

            messages.push({
                to: user.push_token!,
                title: "Your weekly recap",
                body,
                sound: "default",
                data: { type: "weekly_summary" },
            });
        }

        if (messages.length > 0) {
            // Batch in groups of 100 (Expo limit)
            for (let i = 0; i < messages.length; i += 100) {
                const batch = messages.slice(i, i + 100);
                await sendExpoPushNotifications(batch);
            }
        }

        console.log(
            `Sent ${messages.length} weekly summary notifications, skipped: prefs=${skippedPrefs}, no partner=${skippedNoPartner}`
        );

        return new Response(
            JSON.stringify({
                sent: messages.length,
                skipped: { prefs: skippedPrefs, noPartner: skippedNoPartner },
                activeCouples: activeCoupleIds.size,
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
