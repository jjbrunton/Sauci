import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Repairs a message encrypted with a stale recipient key.
 *
 * When a message was encrypted while offline and the recipient's key changed
 * before sync, the recipient can't decrypt. This function uses the admin key
 * to re-wrap the AES key for the recipient's current public key.
 */
Deno.serve(async (req) => {
    // Handle CORS preflight
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const supabaseAdmin = createClient(
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

        const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(
            authHeader.replace("Bearer ", "")
        );

        if (authError || !user) {
            return new Response(
                JSON.stringify({ error: `Invalid token: ${authError?.message || 'No user found'}` }),
                { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Parse request body
        const { message_id } = await req.json();

        if (!message_id) {
            return new Response(
                JSON.stringify({ error: "Missing message_id" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Get user's current public key
        const { data: profile, error: profileError } = await supabaseAdmin
            .from("profiles")
            .select("id, couple_id, public_key_jwk")
            .eq("id", user.id)
            .maybeSingle();

        if (profileError || !profile) {
            return new Response(
                JSON.stringify({ error: "Profile not found" }),
                { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        if (!profile.public_key_jwk) {
            return new Response(
                JSON.stringify({ error: "User has no public key" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Get the message
        const { data: message, error: messageError } = await supabaseAdmin
            .from("messages")
            .select("id, user_id, match_id, version, keys_metadata")
            .eq("id", message_id)
            .maybeSingle();

        if (messageError || !message) {
            return new Response(
                JSON.stringify({ error: "Message not found" }),
                { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Verify this is a v2 message
        if (message.version !== 2) {
            return new Response(
                JSON.stringify({ error: "Message is not encrypted (v1)" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Verify user has access to this message (via match -> couple)
        const { data: match } = await supabaseAdmin
            .from("matches")
            .select("couple_id")
            .eq("id", message.match_id)
            .maybeSingle();

        if (!match || match.couple_id !== profile.couple_id) {
            return new Response(
                JSON.stringify({ error: "Access denied" }),
                { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Determine if user is sender or recipient
        const isSender = message.user_id === user.id;

        const metadata = message.keys_metadata as {
            sender_wrapped_key: string;
            recipient_wrapped_key?: string;
            admin_wrapped_key: string;
            admin_key_id: string;
            algorithm: string;
            key_wrap_algorithm: string;
            pending_recipient?: boolean;
        };

        // Get admin private key - supports multi-key lookup
        const adminPrivateKeyJwk = getAdminPrivateKey(metadata.admin_key_id);
        if (!adminPrivateKeyJwk) {
            return new Response(
                JSON.stringify({ error: "Admin key not found for this message" }),
                { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Unwrap AES key using admin key
        const rawAesKey = await unwrapWithAdminKey(
            metadata.admin_wrapped_key,
            adminPrivateKeyJwk
        );

        // Re-wrap with user's current public key
        const newWrappedKey = await wrapForRecipient(
            rawAesKey,
            profile.public_key_jwk
        );

        // Update the appropriate field
        const updatedMetadata = { ...metadata };
        if (isSender) {
            updatedMetadata.sender_wrapped_key = newWrappedKey;
        } else {
            updatedMetadata.recipient_wrapped_key = newWrappedKey;
            updatedMetadata.pending_recipient = false;
        }

        const { error: updateError } = await supabaseAdmin
            .from("messages")
            .update({ keys_metadata: updatedMetadata })
            .eq("id", message.id);

        if (updateError) {
            console.error(`Failed to update message ${message.id}:`, updateError);
            return new Response(
                JSON.stringify({ error: "Failed to update message" }),
                { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        console.log(`Repaired stale key for message ${message.id}, user ${user.id} (${isSender ? 'sender' : 'recipient'})`);

        return new Response(
            JSON.stringify({ success: true, message_id: message.id }),
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

/**
 * Get admin private key by ID.
 * Supports multi-key format: ADMIN_KEYS_JSON = { "uuid1": {...}, "uuid2": {...} }
 * Falls back to single-key format: ADMIN_PRIVATE_KEY_JWK = {...}
 */
function getAdminPrivateKey(keyId: string): JsonWebKey | null {
    // Try multi-key format first
    const keysJson = Deno.env.get("ADMIN_KEYS_JSON");
    if (keysJson) {
        try {
            const keys = JSON.parse(keysJson);
            if (keys[keyId]) {
                return keys[keyId];
            }
        } catch {
            console.error("Failed to parse ADMIN_KEYS_JSON");
        }
    }

    // Fall back to single-key format
    const singleKeyJson = Deno.env.get("ADMIN_PRIVATE_KEY_JWK");
    if (singleKeyJson) {
        try {
            return JSON.parse(singleKeyJson);
        } catch {
            console.error("Failed to parse ADMIN_PRIVATE_KEY_JWK");
        }
    }

    return null;
}

// Crypto helper functions
async function unwrapWithAdminKey(
    wrappedKeyBase64: string,
    adminPrivateKeyJwk: JsonWebKey
): Promise<ArrayBuffer> {
    const privateKey = await crypto.subtle.importKey(
        "jwk",
        adminPrivateKeyJwk,
        { name: "RSA-OAEP", hash: "SHA-256" },
        false,
        ["decrypt"]
    );

    const wrappedKey = base64ToArrayBuffer(wrappedKeyBase64);
    return await crypto.subtle.decrypt(
        { name: "RSA-OAEP" },
        privateKey,
        wrappedKey
    );
}

async function wrapForRecipient(
    rawAesKey: ArrayBuffer,
    recipientPublicKeyJwk: JsonWebKey
): Promise<string> {
    // Sanitize JWK to ensure Base64URL encoding for n and e
    const sanitizedJwk = { ...recipientPublicKeyJwk };
    if (sanitizedJwk.n) {
        sanitizedJwk.n = toBase64Url(sanitizedJwk.n);
    }
    if (sanitizedJwk.e) {
        sanitizedJwk.e = toBase64Url(sanitizedJwk.e);
    }

    const publicKey = await crypto.subtle.importKey(
        "jwk",
        sanitizedJwk,
        { name: "RSA-OAEP", hash: "SHA-256" },
        false,
        ["encrypt"]
    );

    const wrappedKey = await crypto.subtle.encrypt(
        { name: "RSA-OAEP" },
        publicKey,
        rawAesKey
    );

    return arrayBufferToBase64(wrappedKey);
}

function toBase64Url(base64: string): string {
    return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}
