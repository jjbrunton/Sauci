import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Re-encrypts pending messages when a partner generates their encryption keys.
 * 
 * Called when a user uploads their public key and their partner already
 * sent messages with pending_recipient = true.
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

        // Get user's couple_id and public key
        const { data: profile, error: profileError } = await supabaseAdmin
            .from("profiles")
            .select("couple_id, public_key_jwk")
            .eq("id", user.id)
            .maybeSingle();

        if (profileError || !profile) {
            return new Response(
                JSON.stringify({ error: "Profile not found" }),
                { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        if (!profile.couple_id) {
            return new Response(
                JSON.stringify({ success: true, updated: 0, reason: "No couple" }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        if (!profile.public_key_jwk) {
            return new Response(
                JSON.stringify({ error: "User has no public key" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Find matches for this couple
        const { data: matches } = await supabaseAdmin
            .from("matches")
            .select("id")
            .eq("couple_id", profile.couple_id);

        const matchIds = matches?.map(m => m.id) || [];
        
        if (matchIds.length === 0) {
            return new Response(
                JSON.stringify({ success: true, updated: 0, reason: "No matches found" }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Find v2 messages where this user is the recipient but doesn't have their wrapped key yet
        const { data: messages, error: messagesError } = await supabaseAdmin
            .from("messages")
            .select("id, user_id, keys_metadata")
            .eq("version", 2)
            .in("match_id", matchIds)
            .neq("user_id", user.id); // Messages sent TO this user (they are recipient)

        if (messagesError) {
            console.error("Error fetching messages:", messagesError);
            return new Response(
                JSON.stringify({ error: "Failed to fetch messages" }),
                { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        let updatedCount = 0;

        for (const message of messages || []) {
            const metadata = message.keys_metadata as {
                sender_wrapped_key: string;
                recipient_wrapped_key?: string;
                admin_wrapped_key: string;
                admin_key_id: string;
                algorithm: string;
                key_wrap_algorithm: string;
                pending_recipient?: boolean;
            };

            // Only process if pending_recipient OR missing recipient key
            if (!metadata.pending_recipient && metadata.recipient_wrapped_key) {
                continue;
            }

            try {
                // Get admin private key - supports multi-key lookup
                const adminPrivateKeyJwk = getAdminPrivateKey(metadata.admin_key_id);
                if (!adminPrivateKeyJwk) {
                    console.error(`Admin key ${metadata.admin_key_id} not found for message ${message.id}`);
                    continue;
                }

                // Unwrap AES key using admin key
                const rawAesKey = await unwrapWithAdminKey(
                    metadata.admin_wrapped_key,
                    adminPrivateKeyJwk
                );

                // Re-wrap for recipient
                const recipientWrappedKey = await wrapForRecipient(
                    rawAesKey,
                    profile.public_key_jwk
                );

                // Update message
                const { error: updateError } = await supabaseAdmin
                    .from("messages")
                    .update({
                        keys_metadata: {
                            ...metadata,
                            recipient_wrapped_key: recipientWrappedKey,
                            pending_recipient: false,
                        }
                    })
                    .eq("id", message.id);

                if (updateError) {
                    console.error(`Failed to update message ${message.id}:`, updateError);
                } else {
                    updatedCount++;
                }
            } catch (err) {
                console.error(`Failed to re-encrypt message ${message.id}:`, err);
            }
        }

        return new Response(
            JSON.stringify({ success: true, updated: updatedCount }),
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
