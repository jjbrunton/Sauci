import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotificationBody {
    couple_id: string;
    match_id: string;
}

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

        const { couple_id, match_id }: NotificationBody = await req.json();

        if (!couple_id || !match_id) {
            return new Response(
                JSON.stringify({ error: "Missing couple_id or match_id" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Get push tokens for both partners
        const { data: profiles, error: profilesError } = await supabase
            .from("profiles")
            .select("push_token, name")
            .eq("couple_id", couple_id)
            .not("push_token", "is", null);

        if (profilesError) {
            console.error("Error fetching profiles:", profilesError);
            return new Response(
                JSON.stringify({ error: "Failed to fetch profiles" }),
                { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        if (!profiles || profiles.length === 0) {
            return new Response(
                JSON.stringify({ success: false, message: "No push tokens found" }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Get match details for the notification
        const { data: match } = await supabase
            .from("matches")
            .select(`
        *,
        question:questions(text)
      `)
            .eq("id", match_id)
            .single();

        // Build push messages (privacy-friendly - no content in notification)
        const messages: ExpoPushMessage[] = profiles
            .filter((p) => p.push_token)
            .map((profile) => ({
                to: profile.push_token!,
                title: "It's a match! 💕",
                body: "You and your partner matched on something new!",
                sound: "default",
                data: { match_id, type: "match" },
            }));

        // Send notifications
        await sendExpoPushNotifications(messages);

        return new Response(
            JSON.stringify({ success: true, sent: messages.length }),
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
