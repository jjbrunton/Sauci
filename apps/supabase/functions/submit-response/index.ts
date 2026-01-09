import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Answer = "yes" | "no" | "maybe";
type MatchType = "yes_yes" | "yes_maybe" | "maybe_maybe";

interface SubmitResponseBody {
    question_id: string;
    answer: Answer;
}

function calculateMatch(a1: Answer, a2: Answer): MatchType | null {
    if (a1 === "no" || a2 === "no") return null;
    if (a1 === "yes" && a2 === "yes") return "yes_yes";
    if (a1 === "maybe" && a2 === "maybe") return "maybe_maybe";
    return "yes_maybe";
}

Deno.serve(async (req) => {
    // Handle CORS preflight
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const supabase = createClient(
            Deno.env.get("SUPABASE_URL")!,
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        );

        // Get user from JWT
        const authHeader = req.headers.get("Authorization");
        if (!authHeader) {
            return new Response(
                JSON.stringify({ error: "Missing authorization header" }),
                { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const { data: { user }, error: authError } = await supabase.auth.getUser(
            authHeader.replace("Bearer ", "")
        );

        if (authError || !user) {
            return new Response(
                JSON.stringify({ error: "Invalid token" }),
                { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Parse request body
        const { question_id, answer }: SubmitResponseBody = await req.json();

        if (!question_id || !answer) {
            return new Response(
                JSON.stringify({ error: "Missing question_id or answer" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Get user's profile and couple
        const { data: profile, error: profileError } = await supabase
            .from("profiles")
            .select("couple_id")
            .eq("id", user.id)
            .single();

        if (profileError || !profile?.couple_id) {
            return new Response(
                JSON.stringify({ error: "User is not in a couple" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Check if this is a new response or an edit (edits bypass daily limit)
        const { data: existingResponse } = await supabase
            .from("responses")
            .select("id")
            .eq("user_id", user.id)
            .eq("question_id", question_id)
            .maybeSingle();

        const isNewResponse = !existingResponse;

        // Enforce daily response limit for new responses only
        if (isNewResponse) {
            // Check if user has premium access
            const { data: hasPremiumData } = await supabase.rpc("has_premium_access", {
                check_user_id: user.id,
            });

            const hasPremium = hasPremiumData === true;

            // If non-premium, check daily limit
            if (!hasPremium) {
                // Get daily limit from app_config
                const { data: configData } = await supabase
                    .from("app_config")
                    .select("daily_response_limit")
                    .limit(1)
                    .maybeSingle();

                const dailyLimit = configData?.daily_response_limit || 0;

                // If daily limit is enabled (> 0), check if user has reached it
                if (dailyLimit > 0) {
                    // Calculate UTC day boundaries
                    const now = new Date();
                    const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
                    const tomorrowStart = new Date(todayStart);
                    tomorrowStart.setUTCDate(tomorrowStart.getUTCDate() + 1);

                    // Count responses created today (UTC)
                    const { count: dailyCount } = await supabase
                        .from("responses")
                        .select("*", { count: "exact", head: true })
                        .eq("user_id", user.id)
                        .gte("created_at", todayStart.toISOString())
                        .lt("created_at", tomorrowStart.toISOString());

                    // If over limit, reject
                    if ((dailyCount || 0) >= dailyLimit) {
                        return new Response(
                            JSON.stringify({
                                error: "Daily response limit reached",
                                daily_limit: dailyLimit,
                                reset_at: tomorrowStart.toISOString(),
                            }),
                            { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                        );
                    }
                }
            }
        }

        // Save or update response
        const { data: response, error: responseError } = await supabase
            .from("responses")
            .upsert(
                {
                    user_id: user.id,
                    question_id,
                    couple_id: profile.couple_id,
                    answer,
                },
                { onConflict: "user_id,question_id" }
            )
            .select()
            .single();

        if (responseError) {
            return new Response(
                JSON.stringify({ error: "Failed to save response", details: responseError }),
                { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Check for partner's response
        const { data: partnerResponse } = await supabase
            .from("responses")
            .select("answer")
            .eq("couple_id", profile.couple_id)
            .eq("question_id", question_id)
            .neq("user_id", user.id)
            .single();

        let match = null;

        if (partnerResponse) {
            const matchType = calculateMatch(answer, partnerResponse.answer as Answer);

            if (matchType) {
                // Create or update match
                const { data: newMatch, error: matchError } = await supabase
                    .from("matches")
                    .upsert(
                        {
                            couple_id: profile.couple_id,
                            question_id,
                            match_type: matchType,
                            is_new: true,
                        },
                        { onConflict: "couple_id,question_id" }
                    )
                    .select(`
            *,
            question:questions(*)
          `)
                    .single();

                if (!matchError) {
                    match = newMatch;

                    // Trigger push notification
                    try {
                        await supabase.functions.invoke("send-notification", {
                            body: { couple_id: profile.couple_id, match_id: newMatch.id },
                        });
                    } catch (notifyError) {
                        console.error("Failed to send notification:", notifyError);
                    }
                }
            }
        }

        return new Response(
            JSON.stringify({ response, match }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    } catch (error) {
        console.error("Error:", error);
        return new Response(
            JSON.stringify({ error: "Internal server error" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
