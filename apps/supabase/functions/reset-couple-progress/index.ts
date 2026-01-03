import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
    }

    return response.json();
}

Deno.serve(async (req) => {
    // Handle CORS preflight
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    if (req.method !== "DELETE") {
        return new Response(
            JSON.stringify({ error: "Method not allowed" }),
            { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
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
            console.error("Auth Error:", authError);
            return new Response(
                JSON.stringify({ error: `Invalid token: ${authError?.message || 'No user found'}` }),
                { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Get user's profile and couple_id
        const { data: profile, error: profileError } = await supabase
            .from("profiles")
            .select("couple_id")
            .eq("id", user.id)
            .single();

        if (profileError || !profile?.couple_id) {
            return new Response(
                JSON.stringify({ error: "You are not in a relationship" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const coupleId = profile.couple_id;

        // Get partner's push token BEFORE clearing data
        const { data: partnerProfile } = await supabase
            .from("profiles")
            .select("push_token")
            .eq("couple_id", coupleId)
            .neq("id", user.id)
            .maybeSingle();

        // Get all match IDs for this couple (needed for storage cleanup)
        const { data: matches } = await supabase
            .from("matches")
            .select("id")
            .eq("couple_id", coupleId);

        const matchIds = matches?.map(m => m.id) || [];

        // Delete all chat media from storage for each match
        for (const matchId of matchIds) {
            const { data: files } = await supabase.storage
                .from("chat-media")
                .list(matchId);

            if (files && files.length > 0) {
                const filePaths = files.map(f => `${matchId}/${f.name}`);
                await supabase.storage
                    .from("chat-media")
                    .remove(filePaths);
            }
        }

        // Delete all matches for this couple (cascades to messages)
        const { error: matchesError } = await supabase
            .from("matches")
            .delete()
            .eq("couple_id", coupleId);

        if (matchesError) {
            console.error("Failed to delete matches:", matchesError);
            return new Response(
                JSON.stringify({ error: "Failed to delete matches" }),
                { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Delete all responses for this couple
        const { error: responsesError } = await supabase
            .from("responses")
            .delete()
            .eq("couple_id", coupleId);

        if (responsesError) {
            console.error("Failed to delete responses:", responsesError);
            return new Response(
                JSON.stringify({ error: "Failed to delete responses" }),
                { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Notify partner about the progress reset
        if (partnerProfile?.push_token) {
            await sendExpoPushNotifications([{
                to: partnerProfile.push_token,
                title: "Progress Reset",
                body: "Your partner has reset all progress. Your matches and chats have been cleared to start fresh.",
                sound: "default",
                data: { type: "progress_reset" },
            }]);
        }

        return new Response(
            JSON.stringify({ success: true, message: "Progress reset successfully" }),
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
