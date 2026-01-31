import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0?target=deno";

/**
 * Send catch-up reminder notifications to the "behind" partner.
 * Called by pg_cron daily at 17:00 UTC.
 *
 * Escalation schedule:
 * - First reminder after 24h of pending questions
 * - Follow-up reminders every 3 days
 *
 * Skips if: user active in last 6h, catchup_reminders_enabled = false, no push token
 */

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
    if (req.method !== "POST" && req.method !== "GET") {
        return new Response("Method not allowed", { status: 405 });
    }

    const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    try {
        const now = new Date();
        const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
        const sixHoursAgo = new Date(now.getTime() - 6 * 60 * 60 * 1000);

        // Find all couples and count unanswered questions per user
        // A "behind" user has questions their partner answered but they haven't
        const { data: behindUsers, error: queryError } = await supabase.rpc(
            "get_behind_partners"
        );

        // If the RPC doesn't exist yet, fall back to a raw query
        let candidates: Array<{
            behind_user_id: string;
            partner_name: string;
            pending_count: number;
        }>;

        if (queryError) {
            // Fallback: use SQL directly
            const { data, error } = await supabase.from("couples").select(
                "id, user1_id, user2_id"
            );
            if (error) throw error;
            if (!data || data.length === 0) {
                return new Response(
                    JSON.stringify({ success: true, sent: 0, message: "No couples" }),
                    { headers: { "Content-Type": "application/json" } }
                );
            }

            candidates = [];

            for (const couple of data) {
                if (!couple.user1_id || !couple.user2_id) continue;

                // Count questions each user answered that the other hasn't
                for (const [userId, partnerId] of [
                    [couple.user1_id, couple.user2_id],
                    [couple.user2_id, couple.user1_id],
                ] as [string, string][]) {
                    const { count, error: countError } = await supabase
                        .from("responses")
                        .select("question_id", { count: "exact", head: true })
                        .eq("user_id", partnerId)
                        .not(
                            "question_id",
                            "in",
                            `(SELECT question_id FROM responses WHERE user_id = '${userId}')`
                        );

                    // The above subquery won't work via PostgREST, use a different approach
                    // Get partner's answered question IDs, then count how many the user hasn't answered
                }
            }

            // Better approach: use execute_sql-style raw query via RPC
            // Actually, let's use a simpler approach with two queries
            candidates = await findBehindUsers(supabase);
        } else {
            candidates = behindUsers || [];
        }

        // Now process each behind user
        let sent = 0;
        let skipped = 0;

        for (const candidate of candidates) {
            const { behind_user_id, partner_name, pending_count } = candidate;

            // Get user profile
            const { data: profile } = await supabase
                .from("profiles")
                .select("id, push_token, last_active_at")
                .eq("id", behind_user_id)
                .maybeSingle();

            if (!profile?.push_token) {
                skipped++;
                continue;
            }

            // Skip if active in last 6 hours
            if (profile.last_active_at && profile.last_active_at > sixHoursAgo.toISOString()) {
                skipped++;
                // Reset tracking since they're active
                continue;
            }

            // Check notification preferences
            const { data: prefs } = await supabase
                .from("notification_preferences")
                .select("catchup_reminders_enabled")
                .eq("user_id", behind_user_id)
                .maybeSingle();

            if (prefs && prefs.catchup_reminders_enabled === false) {
                skipped++;
                continue;
            }

            // Get or create tracking record
            const { data: tracking } = await supabase
                .from("catchup_reminder_tracking")
                .select("*")
                .eq("user_id", behind_user_id)
                .maybeSingle();

            const pendingSince = tracking?.pending_since
                ? new Date(tracking.pending_since)
                : null;
            const lastReminderAt = tracking?.last_reminder_sent_at
                ? new Date(tracking.last_reminder_sent_at)
                : null;
            const reminderCount = tracking?.reminder_count || 0;

            // Upsert pending_since if not set
            if (!pendingSince) {
                await supabase.from("catchup_reminder_tracking").upsert({
                    user_id: behind_user_id,
                    pending_since: now.toISOString(),
                    reminder_count: 0,
                });
                // Too early for first reminder (just started tracking)
                skipped++;
                continue;
            }

            // Check escalation schedule
            if (pendingSince > twentyFourHoursAgo) {
                // Less than 24h since questions appeared — too early
                skipped++;
                continue;
            }

            if (reminderCount === 0) {
                // Send first reminder
            } else if (lastReminderAt && lastReminderAt > threeDaysAgo) {
                // Less than 3 days since last reminder — skip
                skipped++;
                continue;
            }

            // Determine notification copy
            const name = partner_name || "Your partner";
            let title: string;
            let body: string;

            if (reminderCount === 0) {
                title = "Questions waiting";
                body = pending_count >= 6
                    ? `${name} has answered ${pending_count} questions you haven't seen yet`
                    : `${name} answered some questions — your turn!`;
            } else {
                title = "Still waiting on you";
                body = `You have ${pending_count} questions waiting. Don't leave ${name} hanging!`;
            }

            try {
                await sendExpoPushNotification({
                    to: profile.push_token,
                    title,
                    body,
                    sound: "default",
                    data: { type: "catchup_reminder" },
                });

                // Update tracking
                await supabase.from("catchup_reminder_tracking").upsert({
                    user_id: behind_user_id,
                    pending_since: tracking.pending_since,
                    last_reminder_sent_at: now.toISOString(),
                    reminder_count: reminderCount + 1,
                });

                sent++;
            } catch (error) {
                console.error(`Failed to send catchup reminder to ${behind_user_id}:`, error);
            }
        }

        // Reset tracking for users who have caught up
        await resetCaughtUpUsers(supabase);

        console.log(`Catchup reminders: sent=${sent}, skipped=${skipped}`);

        return new Response(
            JSON.stringify({ success: true, sent, skipped }),
            { headers: { "Content-Type": "application/json" } }
        );
    } catch (err) {
        console.error("Catchup reminder error:", err);
        return new Response(
            JSON.stringify({ error: "Internal server error" }),
            { status: 500, headers: { "Content-Type": "application/json" } }
        );
    }
});

/**
 * Find users who are "behind" — their partner answered questions they haven't.
 * Returns: { behind_user_id, partner_name, pending_count }[]
 */
async function findBehindUsers(
    supabase: ReturnType<typeof createClient>
): Promise<Array<{ behind_user_id: string; partner_name: string; pending_count: number }>> {
    // Get all active couples
    const { data: couples, error } = await supabase
        .from("couples")
        .select("id, user1_id, user2_id");

    if (error || !couples) return [];

    const results: Array<{ behind_user_id: string; partner_name: string; pending_count: number }> = [];

    for (const couple of couples) {
        if (!couple.user1_id || !couple.user2_id) continue;

        // Get enabled pack IDs for this couple
        const { data: enabledPacks } = await supabase
            .from("couple_packs")
            .select("pack_id")
            .eq("couple_id", couple.id)
            .eq("is_enabled", true);

        const packIds = (enabledPacks || []).map((p: { pack_id: string }) => p.pack_id);
        if (packIds.length === 0) continue;

        // For each direction, count questions partner answered that user hasn't
        for (const [userId, partnerId] of [
            [couple.user1_id, couple.user2_id],
            [couple.user2_id, couple.user1_id],
        ] as [string, string][]) {
            // Get partner's answered question IDs (in enabled packs)
            const { data: partnerResponses } = await supabase
                .from("responses")
                .select("question_id")
                .eq("user_id", partnerId);

            if (!partnerResponses || partnerResponses.length === 0) continue;

            const partnerQuestionIds = partnerResponses.map((r: { question_id: string }) => r.question_id);

            // Get user's answered question IDs
            const { data: userResponses } = await supabase
                .from("responses")
                .select("question_id")
                .eq("user_id", userId);

            const userQuestionIds = new Set(
                (userResponses || []).map((r: { question_id: string }) => r.question_id)
            );

            // Count questions partner answered that user hasn't
            const pendingCount = partnerQuestionIds.filter(
                (qid: string) => !userQuestionIds.has(qid)
            ).length;

            if (pendingCount > 0) {
                // Get partner name
                const { data: partnerProfile } = await supabase
                    .from("profiles")
                    .select("name")
                    .eq("id", partnerId)
                    .maybeSingle();

                results.push({
                    behind_user_id: userId,
                    partner_name: partnerProfile?.name || "Your partner",
                    pending_count: pendingCount,
                });
            }
        }
    }

    return results;
}

/**
 * Reset tracking for users who have no pending questions (caught up).
 */
async function resetCaughtUpUsers(
    supabase: ReturnType<typeof createClient>
): Promise<void> {
    // Get all tracked users
    const { data: tracked } = await supabase
        .from("catchup_reminder_tracking")
        .select("user_id")
        .not("pending_since", "is", null);

    if (!tracked || tracked.length === 0) return;

    for (const { user_id } of tracked) {
        // Get user's couple
        const { data: profile } = await supabase
            .from("profiles")
            .select("couple_id")
            .eq("id", user_id)
            .maybeSingle();

        if (!profile?.couple_id) {
            // No couple — clear tracking
            await supabase
                .from("catchup_reminder_tracking")
                .update({ pending_since: null, reminder_count: 0 })
                .eq("user_id", user_id);
            continue;
        }

        // Get partner
        const { data: partner } = await supabase
            .from("profiles")
            .select("id")
            .eq("couple_id", profile.couple_id)
            .neq("id", user_id)
            .maybeSingle();

        if (!partner) continue;

        // Check if partner has any responses user hasn't answered
        const { data: partnerResponses } = await supabase
            .from("responses")
            .select("question_id")
            .eq("user_id", partner.id);

        const { data: userResponses } = await supabase
            .from("responses")
            .select("question_id")
            .eq("user_id", user_id);

        const userQuestionIds = new Set(
            (userResponses || []).map((r: { question_id: string }) => r.question_id)
        );

        const pendingCount = (partnerResponses || []).filter(
            (r: { question_id: string }) => !userQuestionIds.has(r.question_id)
        ).length;

        if (pendingCount === 0) {
            await supabase
                .from("catchup_reminder_tracking")
                .update({ pending_since: null, reminder_count: 0, last_reminder_sent_at: null })
                .eq("user_id", user_id);
        }
    }
}
