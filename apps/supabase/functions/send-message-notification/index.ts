import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotificationBody {
    match_id: string;
    sender_id: string;
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

        const { match_id, sender_id }: NotificationBody = await req.json();

        if (!match_id || !sender_id) {
            return new Response(
                JSON.stringify({ error: "Missing match_id or sender_id" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Get the match to find the couple_id
        const { data: match, error: matchError } = await supabase
            .from("matches")
            .select("couple_id")
            .eq("id", match_id)
            .single();

        if (matchError || !match) {
            return new Response(
                JSON.stringify({ error: "Match not found" }),
                { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Get the recipient's push token (partner, not sender)
        const { data: recipient, error: recipientError } = await supabase
            .from("profiles")
            .select("push_token, name")
            .eq("couple_id", match.couple_id)
            .neq("id", sender_id)
            .single();

        if (recipientError || !recipient?.push_token) {
            return new Response(
                JSON.stringify({ success: false, message: "Recipient has no push token" }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Get the most recent message ID for navigation
        const { data: message } = await supabase
            .from("messages")
            .select("id")
            .eq("match_id", match_id)
            .eq("user_id", sender_id)
            .order("created_at", { ascending: false })
            .limit(1)
            .single();

        // Build push message (privacy-friendly - no content in notification)
        const pushMessage: ExpoPushMessage = {
            to: recipient.push_token,
            title: "New message",
            body: "Your partner sent you a message",
            sound: "default",
            data: {
                type: "message",
                match_id,
                message_id: message?.id,
            },
        };

        await sendExpoPushNotifications([pushMessage]);

        return new Response(
            JSON.stringify({ success: true }),
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
