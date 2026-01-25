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

interface UpdateResponseBody {
    question_id: string;
    new_answer: Answer;
    response_data?: ResponseData | null;
    confirm_delete_match?: boolean;
}

interface UpdateResponseResult {
    success: boolean;
    requires_confirmation?: boolean;
    match_id?: string;
    message_count?: number;
    new_match?: Record<string, unknown> | null;
    match_deleted?: boolean;
    match_type_updated?: boolean;
}

interface Question {
    id: string;
    question_type?: QuestionType;
}

function calculateMatchType(question: Question, answer1: Answer, answer2: Answer): MatchType | null {
    if (!question.question_type || question.question_type === "swipe") {
        if (answer1 === "no" || answer2 === "no") return null;
        if (answer1 === "yes" && answer2 === "yes") return "yes_yes";
        if (answer1 === "maybe" && answer2 === "maybe") return "maybe_maybe";
        return "yes_maybe";
    }

    if (["text_answer", "audio", "photo"].includes(question.question_type)) {
        if (answer1 === "no" || answer2 === "no") return null;
        return "both_answered";
    }

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
        const { question_id, new_answer, response_data, confirm_delete_match }: UpdateResponseBody = await req.json();

        if (!question_id || !new_answer) {
            return new Response(
                JSON.stringify({ error: "Missing question_id or new_answer" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Validate answer
        if (!["yes", "no", "maybe"].includes(new_answer)) {
            return new Response(
                JSON.stringify({ error: "Invalid answer. Must be yes, no, or maybe" }),
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

        // Get current response
        const { data: currentResponse, error: currentResponseError } = await supabase
            .from("responses")
            .select("answer, response_data")
            .eq("user_id", user.id)
            .eq("question_id", question_id)
            .maybeSingle();

        if (currentResponseError) {
            return new Response(
                JSON.stringify({ error: "Failed to get current response" }),
                { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        if (!currentResponse) {
            return new Response(
                JSON.stringify({ error: "No existing response found for this question" }),
                { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // If answer hasn't changed and no response_data updates, return early
        if (currentResponse.answer === new_answer && typeof response_data === "undefined") {
            return new Response(
                JSON.stringify({ success: true, message: "Answer unchanged" } as UpdateResponseResult),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Check if a match exists for this question
        const { data: existingMatch } = await supabase
            .from("matches")
            .select("id")
            .eq("couple_id", profile.couple_id)
            .eq("question_id", question_id)
            .maybeSingle();

        // Get partner's response
        const { data: partnerResponse } = await supabase
            .from("responses")
            .select("answer, response_data, user_id")
            .eq("couple_id", profile.couple_id)
            .eq("question_id", question_id)
            .neq("user_id", user.id)
            .maybeSingle();

        const result: UpdateResponseResult = { success: true };
        const isNonSwipe = !!question.question_type && question.question_type !== "swipe";
        const normalizedResponseData = isNonSwipe && new_answer !== "no"
            ? (typeof response_data !== "undefined" ? response_data : currentResponse.response_data ?? null)
            : null;
        const matchType = partnerResponse
            ? calculateMatchType(question as Question, new_answer, partnerResponse.answer as Answer)
            : null;
        const responseSummary = isNonSwipe && matchType === "both_answered" && partnerResponse
            ? {
                [user.id]: normalizedResponseData ?? null,
                [partnerResponse.user_id]: partnerResponse.response_data ?? null,
            }
            : null;

        // Case 1: Changing to "no" AND match exists - requires confirmation
        if (new_answer === "no" && existingMatch) {
            // Get message count for confirmation dialog
            const { count: messageCount } = await supabase
                .from("messages")
                .select("*", { count: "exact", head: true })
                .eq("match_id", existingMatch.id);

            if (!confirm_delete_match) {
                // Return confirmation required
                return new Response(
                    JSON.stringify({
                        success: false,
                        requires_confirmation: true,
                        match_id: existingMatch.id,
                        message_count: messageCount || 0,
                    } as UpdateResponseResult),
                    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
            }

            // User confirmed deletion - delete media from storage
            const { data: files } = await supabase.storage
                .from("chat-media")
                .list(existingMatch.id);

            if (files && files.length > 0) {
                const filePaths = files.map(f => `${existingMatch.id}/${f.name}`);
                await supabase.storage
                    .from("chat-media")
                    .remove(filePaths);
            }

            // Delete the match (messages cascade automatically via FK)
            const { error: deleteMatchError } = await supabase
                .from("matches")
                .delete()
                .eq("id", existingMatch.id);

            if (deleteMatchError) {
                console.error("Failed to delete match:", deleteMatchError);
                return new Response(
                    JSON.stringify({ error: "Failed to delete match" }),
                    { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
            }

            result.match_deleted = true;
        }

        // Case 2: Changing FROM "no" to yes/maybe - may create a new match
        if (currentResponse.answer === "no" && new_answer !== "no" && partnerResponse) {
            if (matchType) {
                // Create new match
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
                    .select(`*, question:questions(*)`)
                    .single();

                if (!matchError && newMatch) {
                    result.new_match = newMatch;

                    // Match push notifications are queued via a Postgres trigger
                    // (pending_match_notifications) to allow short digesting.

                }
            }
        }

        // Case 3: Changing between yes/maybe - may update match type
        if (
            new_answer !== "no" &&
            existingMatch &&
            partnerResponse &&
            matchType
        ) {
            const updatePayload: Record<string, unknown> = { match_type: matchType };
            if (isNonSwipe) {
                updatePayload.response_summary = responseSummary;
            }

            const { error: updateMatchError } = await supabase
                .from("matches")
                .update(updatePayload)
                .eq("id", existingMatch.id);

            if (!updateMatchError) {
                result.match_type_updated = true;
            }
        }

        // Update the response
        const responseUpdate: Record<string, unknown> = { answer: new_answer };
        if (isNonSwipe || new_answer === "no" || typeof response_data !== "undefined") {
            responseUpdate.response_data = normalizedResponseData;
        }

        const { error: updateError } = await supabase
            .from("responses")
            .update(responseUpdate)
            .eq("user_id", user.id)
            .eq("question_id", question_id);

        if (updateError) {
            return new Response(
                JSON.stringify({ error: "Failed to update response", details: updateError }),
                { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        return new Response(
            JSON.stringify(result),
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
