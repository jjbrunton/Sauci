import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0?target=deno";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

type DiscordEmbedField = {
    name: string;
    value: string;
    inline?: boolean;
};

type DiscordEmbed = {
    title?: string;
    description?: string;
    color?: number;
    fields?: DiscordEmbedField[];
    timestamp?: string;
};

type DiscordMessage = {
    content?: string;
    embeds?: DiscordEmbed[];
    username?: string;
};

type NotificationPayload = Record<string, unknown>;

interface NotificationRequest {
    event: string;
    payload?: NotificationPayload;
}

const EVENT_COLORS: Record<string, number> = {
    new_user: 0x2ecc71,
    couple_paired: 0x3498db,
    feedback_submitted: 0xf39c12,
};

function asString(value: unknown, fallback = "Unknown"): string {
    if (typeof value === "string") {
        const trimmed = value.trim();
        return trimmed.length > 0 ? trimmed : fallback;
    }

    if (value === null || value === undefined) {
        return fallback;
    }

    return String(value);
}

function asRecord(value: unknown): Record<string, unknown> {
    if (value && typeof value === "object" && !Array.isArray(value)) {
        return value as Record<string, unknown>;
    }

    return {};
}

function truncate(value: string, maxLength: number): string {
    if (value.length <= maxLength) return value;
    if (maxLength <= 3) return value.slice(0, maxLength);
    return `${value.slice(0, maxLength - 3)}...`;
}

function formatUserSummary(user: Record<string, unknown> | null | undefined): string {
    if (!user) return "Unknown";
    const name = asString(user.name, "Unknown");
    const email = asString(user.email, "Unknown");
    const id = asString(user.id, "Unknown");
    return `Name: ${name}\nEmail: ${email}\nID: ${id}`;
}

function buildDiscordMessage(event: string, payload: NotificationPayload): DiscordMessage | null {
    const timestamp = asString(payload.created_at, new Date().toISOString());

    if (event === "new_user") {
        const fields: DiscordEmbedField[] = [
            { name: "User ID", value: asString(payload.user_id), inline: false },
            { name: "Name", value: asString(payload.name), inline: true },
            { name: "Email", value: asString(payload.email), inline: true },
        ];

        return {
            content: "New user signup",
            username: "Sauci Notifications",
            embeds: [
                {
                    title: "New user signup",
                    color: EVENT_COLORS.new_user,
                    fields,
                    timestamp,
                },
            ],
        };
    }

    if (event === "couple_paired") {
        const profiles = Array.isArray(payload.profiles) ? payload.profiles : [];
        const partnerFields = profiles.slice(0, 2).map((profile, index) => ({
            name: `Partner ${index + 1}`,
            value: formatUserSummary(asRecord(profile)),
            inline: false,
        }));

        const fields: DiscordEmbedField[] = [
            { name: "Couple ID", value: asString(payload.couple_id), inline: false },
            ...partnerFields,
        ];

        return {
            content: "Couple paired",
            username: "Sauci Notifications",
            embeds: [
                {
                    title: "Couple paired",
                    color: EVENT_COLORS.couple_paired,
                    fields,
                    timestamp: asString(payload.paired_at, timestamp),
                },
            ],
        };
    }

    if (event === "feedback_submitted") {
        const user = asRecord(payload.user);
        const description = truncate(asString(payload.description, "No description provided."), 900);
        const fields: DiscordEmbedField[] = [
            { name: "Feedback ID", value: asString(payload.feedback_id), inline: false },
            { name: "Type", value: asString(payload.type), inline: true },
            { name: "Status", value: asString(payload.status, "new"), inline: true },
            { name: "Title", value: asString(payload.title), inline: false },
            { name: "User", value: formatUserSummary(user), inline: false },
        ];

        const questionId = asString(payload.question_id, "");
        if (questionId) {
            fields.push({ name: "Question ID", value: questionId, inline: false });
        }

        const screenshotUrl = asString(payload.screenshot_url, "");
        if (screenshotUrl) {
            fields.push({ name: "Screenshot", value: screenshotUrl, inline: false });
        }

        return {
            content: "Feedback submitted",
            username: "Sauci Notifications",
            embeds: [
                {
                    title: "Feedback submitted",
                    description,
                    color: EVENT_COLORS.feedback_submitted,
                    fields,
                    timestamp,
                },
            ],
        };
    }

    return null;
}

async function enrichPayload(
    supabase: ReturnType<typeof createClient>,
    event: string,
    payload: NotificationPayload
): Promise<NotificationPayload> {
    const coupleId = asString(payload.couple_id, "");
    if (event === "couple_paired" && coupleId && !Array.isArray(payload.profiles)) {
        const { data: profiles } = await supabase
            .from("profiles")
            .select("id, name, email, created_at")
            .eq("couple_id", coupleId)
            .order("created_at", { ascending: true });

        if (profiles) {
            return { ...payload, profiles };
        }
    }

    const userId = asString(payload.user_id, "");
    if (event === "feedback_submitted" && userId && !payload.user) {
        const { data: profile } = await supabase
            .from("profiles")
            .select("id, name, email")
            .eq("id", userId)
            .maybeSingle();

        if (profile) {
            return { ...payload, user: profile };
        }
    }

    return payload;
}

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    if (req.method !== "POST") {
        return new Response(JSON.stringify({ error: "Method not allowed" }), {
            status: 405,
            headers: jsonHeaders,
        });
    }

    const webhookUrl = Deno.env.get("DISCORD_WEBHOOK_URL");
    if (!webhookUrl) {
        console.warn("DISCORD_WEBHOOK_URL is not configured");
        return new Response(JSON.stringify({ success: false, message: "Discord webhook not configured" }), {
            status: 200,
            headers: jsonHeaders,
        });
    }

    let body: NotificationRequest;
    try {
        body = await req.json();
    } catch {
        return new Response(JSON.stringify({ error: "Invalid JSON payload" }), {
            status: 400,
            headers: jsonHeaders,
        });
    }

    const event = asString(body.event, "");
    if (!event) {
        return new Response(JSON.stringify({ error: "Missing event" }), {
            status: 400,
            headers: jsonHeaders,
        });
    }

    const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const payload = await enrichPayload(supabase, event, asRecord(body.payload));
    const message = buildDiscordMessage(event, payload);

    if (!message) {
        return new Response(JSON.stringify({ error: "Unsupported event" }), {
            status: 400,
            headers: jsonHeaders,
        });
    }

    try {
        const response = await fetch(webhookUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(message),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("Discord webhook error:", errorText);
            return new Response(JSON.stringify({ error: "Failed to send Discord notification" }), {
                status: 502,
                headers: jsonHeaders,
            });
        }

        return new Response(JSON.stringify({ success: true }), {
            headers: jsonHeaders,
        });
    } catch (error) {
        console.error("Error sending Discord notification:", error);
        return new Response(JSON.stringify({ error: "Internal server error" }), {
            status: 500,
            headers: jsonHeaders,
        });
    }
});
