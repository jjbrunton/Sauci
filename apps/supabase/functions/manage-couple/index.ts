import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface JoinCoupleBody {
    invite_code: string;
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
            console.error("Auth Error:", authError);
            return new Response(
                JSON.stringify({ error: `Invalid token: ${authError?.message || 'No user found'}` }),
                { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const method = req.method;

        if (method === "POST") {
            // Check if user is already in a couple
            const { data: existingProfile, error: profileError } = await supabase
                .from("profiles")
                .select("couple_id")
                .eq("id", user.id)
                .maybeSingle();

            if (profileError) {
                console.error("Profile lookup error:", profileError);
                return new Response(
                    JSON.stringify({ error: "Failed to check profile" }),
                    { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
            }

            if (!existingProfile) {
                return new Response(
                    JSON.stringify({ error: "Profile not found. Please complete signup first." }),
                    { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
            }

            if (existingProfile.couple_id) {
                return new Response(
                    JSON.stringify({ error: "You are already in a couple" }),
                    { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
            }

            const body = await req.json();

            if (body.invite_code) {
                // Join existing couple
                const { invite_code }: JoinCoupleBody = body;

                // Validate invite code format (alphanumeric, 8 chars)
                const sanitizedCode = invite_code.trim().toLowerCase();
                if (!/^[a-z0-9]{8}$/.test(sanitizedCode)) {
                    return new Response(
                        JSON.stringify({ error: "Invalid invite code format" }),
                        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                    );
                }

                // Find couple by invite code (stored as lowercase in DB)
                const { data: couple, error: coupleError } = await supabase
                    .from("couples")
                    .select("id")
                    .eq("invite_code", sanitizedCode)
                    .maybeSingle();

                if (coupleError || !couple) {
                    return new Response(
                        JSON.stringify({ error: "Invalid invite code" }),
                        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                    );
                }

                // Check if couple already has 2 members
                const { count } = await supabase
                    .from("profiles")
                    .select("*", { count: "exact", head: true })
                    .eq("couple_id", couple.id);

                if (count && count >= 2) {
                    return new Response(
                        JSON.stringify({ error: "This couple already has two partners" }),
                        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                    );
                }

                // Update user's profile with couple_id
                const { error: updateError } = await supabase
                    .from("profiles")
                    .update({ couple_id: couple.id })
                    .eq("id", user.id);

                if (updateError) {
                    return new Response(
                        JSON.stringify({ error: "Failed to join couple" }),
                        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                    );
                }

                return new Response(
                    JSON.stringify({ success: true, couple_id: couple.id }),
                    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
            } else {
                // Create new couple
                const { data: couple, error: createError } = await supabase
                    .from("couples")
                    .insert({})
                    .select()
                    .single();

                if (createError || !couple) {
                    return new Response(
                        JSON.stringify({ error: "Failed to create couple" }),
                        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                    );
                }

                // Update user's profile with couple_id
                await supabase
                    .from("profiles")
                    .update({ couple_id: couple.id })
                    .eq("id", user.id);

                return new Response(
                    JSON.stringify({
                        success: true,
                        couple_id: couple.id,
                        invite_code: couple.invite_code
                    }),
                    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
            }
        }

        if (method === "DELETE") {
            // Get user's current couple
            const { data: profile, error: profileFetchError } = await supabase
                .from("profiles")
                .select("couple_id")
                .eq("id", user.id)
                .maybeSingle();

            if (profileFetchError || !profile?.couple_id) {
                return new Response(
                    JSON.stringify({ error: "You are not in a couple" }),
                    { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
            }

            const coupleId = profile.couple_id;

            // Count members in this couple
            const { count, error: countError } = await supabase
                .from("profiles")
                .select("*", { count: "exact", head: true })
                .eq("couple_id", coupleId);

            if (countError) {
                return new Response(
                    JSON.stringify({ error: "Failed to check couple members" }),
                    { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
            }

            // Remove ALL members from couple (both partners get unlinked)
            // This ensures the remaining partner isn't left in a "waiting" state
            const { error: updateError } = await supabase
                .from("profiles")
                .update({ couple_id: null })
                .eq("couple_id", coupleId);

            if (updateError) {
                return new Response(
                    JSON.stringify({ error: "Failed to leave couple" }),
                    { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
            }

            // Delete the couple entirely (cascades to all related data)
            const { error: deleteError } = await supabase
                .from("couples")
                .delete()
                .eq("id", coupleId);

            if (deleteError) {
                console.error("Failed to delete couple:", deleteError);
                // Don't fail the request, users already unlinked
            }

            return new Response(
                JSON.stringify({ success: true, couple_deleted: true }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        return new Response(
            JSON.stringify({ error: "Method not allowed" }),
            { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    } catch (error) {
        console.error("Error:", error);
        return new Response(
            JSON.stringify({ error: "Internal server error" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
