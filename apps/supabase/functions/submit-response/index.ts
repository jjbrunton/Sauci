import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0?target=deno";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Answer = "yes" | "no" | "maybe";
type MatchType = "yes_yes" | "yes_maybe" | "maybe_maybe" | "both_answered";
type QuestionType = "swipe" | "text_answer" | "audio" | "photo" | "who_likely";

type ResponseData =
    | { type: "text_answer"; text: string }
    | { type: "audio"; media_path: string; duration_seconds: number }
    | { type: "photo"; media_path: string }
    | { type: "who_likely"; chosen_user_id: string };

interface SubmitResponseBody {
    question_id: string;
    answer: Answer;
    response_data?: ResponseData;  // Optional for backwards compatibility
}

interface Question {
    id: string;
    question_type?: QuestionType;
    // ... other fields
}

function calculateMatchType(question: Question, answer1: Answer, answer2: Answer): MatchType | null {
    // For swipe questions (or legacy questions without type), use existing logic
    if (!question.question_type || question.question_type === "swipe") {
        if (answer1 === "no" || answer2 === "no") return null;
        if (answer1 === "yes" && answer2 === "yes") return "yes_yes";
        if (answer1 === "maybe" && answer2 === "maybe") return "maybe_maybe";
        return "yes_maybe";
    }

    // For text/audio/photo questions: match if both answered positively
    if (["text_answer", "audio", "photo"].includes(question.question_type)) {
        if (answer1 === "no" || answer2 === "no") return null;
        return "both_answered";
    }

    // For who_likely: always matches when both answered
    if (question.question_type === "who_likely") {
        return "both_answered";
    }

    return null;
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
        const { question_id, answer, response_data }: SubmitResponseBody = await req.json();

        if (!question_id || !answer) {
            return new Response(
                JSON.stringify({ error: "Missing question_id or answer" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Fetch the question to get its type
        const { data: question, error: questionError } = await supabase
            .from("questions")
            .select("id, question_type")
            .eq("id", question_id)
            .single();

        if (questionError || !question) {
            return new Response(
                JSON.stringify({ error: "Question not found" }),
                { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
                    response_data: response_data ?? null,
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
            .select("answer, response_data, user_id")
            .eq("couple_id", profile.couple_id)
            .eq("question_id", question_id)
            .neq("user_id", user.id)
            .single();

        let match = null;

        if (partnerResponse) {
            const matchType = calculateMatchType(question as Question, answer, partnerResponse.answer as Answer);

            if (matchType) {
                // Build response_summary for 'both_answered' matches
                const responseSummary = (matchType === "both_answered") ? {
                    [user.id]: response_data ?? null,
                    [partnerResponse.user_id]: partnerResponse.response_data ?? null,
                } : null;

                // Create or update match
                const { data: newMatch, error: matchError } = await supabase
                    .from("matches")
                    .upsert(
                        {
                            couple_id: profile.couple_id,
                            question_id,
                            match_type: matchType,
                            is_new: true,
                            response_summary: responseSummary,
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

                    // Match push notifications are queued via a Postgres trigger
                    // (pending_match_notifications) to allow short digesting.

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
