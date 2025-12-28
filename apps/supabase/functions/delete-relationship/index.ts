import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

        // Clear couple_id from both partners' profiles first
        const { error: updateError } = await supabase
            .from("profiles")
            .update({ couple_id: null })
            .eq("couple_id", coupleId);

        if (updateError) {
            console.error("Failed to clear couple_id from profiles:", updateError);
            return new Response(
                JSON.stringify({ error: "Failed to clear relationship from profiles" }),
                { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Delete the couple record (cascades to responses, matches, messages, couple_packs)
        const { error: deleteError } = await supabase
            .from("couples")
            .delete()
            .eq("id", coupleId);

        if (deleteError) {
            console.error("Failed to delete couple:", deleteError);
            return new Response(
                JSON.stringify({ error: "Failed to delete relationship data" }),
                { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        return new Response(
            JSON.stringify({ success: true, message: "Relationship data deleted successfully" }),
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
