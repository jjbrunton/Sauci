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

        // Get user's profile
        const { data: profile, error: profileError } = await supabase
            .from("profiles")
            .select("couple_id")
            .eq("id", user.id)
            .maybeSingle();

        if (profileError) {
            console.error("Profile fetch error:", profileError);
            return new Response(
                JSON.stringify({ error: "Failed to fetch profile" }),
                { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // If user is in a relationship, handle couple data deletion
        if (profile?.couple_id) {
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

            // Clear couple_id from partner's profile (don't clear our own yet, will be deleted)
            await supabase
                .from("profiles")
                .update({ couple_id: null })
                .eq("couple_id", coupleId)
                .neq("id", user.id);

            // Delete the couple record (cascades to responses, matches, messages, couple_packs)
            const { error: deleteError } = await supabase
                .from("couples")
                .delete()
                .eq("id", coupleId);

            if (deleteError) {
                console.error("Failed to delete couple:", deleteError);
                // Continue anyway - we still want to delete the account
            }

            // Notify partner about the account deletion
            if (partnerProfile?.push_token) {
                await sendExpoPushNotifications([{
                    to: partnerProfile.push_token,
                    title: "Partner Left",
                    body: "Your partner has deleted their account. You can start fresh with a new partner anytime.",
                    sound: "default",
                    data: { type: "partner_account_deleted" },
                }]);
            }
        }

        // Delete any avatar from storage
        const { data: avatarFiles } = await supabase.storage
            .from("avatars")
            .list(user.id);

        if (avatarFiles && avatarFiles.length > 0) {
            const avatarPaths = avatarFiles.map(f => `${user.id}/${f.name}`);
            await supabase.storage
                .from("avatars")
                .remove(avatarPaths);
        }

        // Delete the user's profile (this will cascade delete any orphaned responses)
        const { error: profileDeleteError } = await supabase
            .from("profiles")
            .delete()
            .eq("id", user.id);

        if (profileDeleteError) {
            console.error("Failed to delete profile:", profileDeleteError);
            return new Response(
                JSON.stringify({ error: "Failed to delete profile" }),
                { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Delete the user from auth.users using admin API
        const { error: authDeleteError } = await supabase.auth.admin.deleteUser(user.id);

        if (authDeleteError) {
            console.error("Failed to delete auth user:", authDeleteError);
            return new Response(
                JSON.stringify({ error: "Failed to delete authentication record" }),
                { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        return new Response(
            JSON.stringify({ success: true, message: "Account deleted successfully" }),
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
