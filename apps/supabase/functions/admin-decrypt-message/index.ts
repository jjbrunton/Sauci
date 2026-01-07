// @ts-nocheck
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { unwrapWithAdminKey, base64ToUint8Array, KeysMetadata } from "../_shared/encryption.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const user = await getUserFromRequest(supabaseAdmin, req);
    await assertSuperAdmin(supabaseAdmin, user.id);

    const body = await req.json().catch(() => ({}));
    const messageId = typeof body?.messageId === "string" ? body.messageId : null;
    if (!messageId) {
      return json({ error: "Missing messageId" }, 400);
    }

    const { data: message, error: messageError } = await supabaseAdmin
      .from("messages")
      .select(
        "id, version, content, encrypted_content, encryption_iv, keys_metadata, media_path, media_type"
      )
      .eq("id", messageId)
      .single();

    if (messageError || !message) {
      return json({ error: "Message not found" }, 404);
    }

    const version = message.version ?? 1;

    if (version !== 2) {
      return json({
        version,
        content: message.content ?? null,
        media_path: message.media_path ?? null,
        media_type: message.media_type ?? null,
      });
    }

    const encryptedContent = message.encrypted_content as string | null;
    const encryptionIv = message.encryption_iv as string | null;
    const keysMetadata = message.keys_metadata as KeysMetadata | null;

    let decryptedContent: string | null = null;

    if (encryptedContent) {
      if (!encryptionIv || !keysMetadata) {
        return json({ error: "Missing encryption metadata" }, 400);
      }

      const adminPrivateKeyJwk = getAdminPrivateKey(keysMetadata.admin_key_id);
      if (!adminPrivateKeyJwk) {
        return json({ error: "Admin decryption key not configured" }, 500);
      }

      const rawAesKey = await unwrapWithAdminKey(
        keysMetadata.admin_wrapped_key,
        adminPrivateKeyJwk
      );

      const aesKey = await crypto.subtle.importKey(
        "raw",
        rawAesKey,
        { name: "AES-GCM" },
        false,
        ["decrypt"]
      );

      const plaintext = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: base64ToUint8Array(encryptionIv) },
        aesKey,
        base64ToUint8Array(encryptedContent)
      );

      decryptedContent = new TextDecoder().decode(plaintext);
    }

    return json({
      version,
      content: decryptedContent,
      media_path: message.media_path ?? null,
      media_type: message.media_type ?? null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";

    if (message.includes("authorization header") || message.startsWith("Invalid token")) {
      return json({ error: "Unauthorized" }, 401);
    }

    if (message === "Access denied") {
      return json({ error: "Forbidden" }, 403);
    }

    console.error("admin-decrypt-message error:", error);
    return json({ error: "Internal server error" }, 500);
  }
});

function json(body: unknown, status = 200, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      ...extraHeaders,
    },
  });
}

async function getUserFromRequest(
  supabaseAdmin: ReturnType<typeof createClient>,
  req: Request
) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    throw new Error("Missing authorization header");
  }

  const { data, error } = await supabaseAdmin.auth.getUser(
    authHeader.replace("Bearer ", "")
  );

  if (error || !data.user) {
    throw new Error(`Invalid token: ${error?.message || "No user"}`);
  }

  return data.user;
}

async function assertSuperAdmin(
  supabaseAdmin: ReturnType<typeof createClient>,
  userId: string
) {
  const { data, error } = await supabaseAdmin
    .from("admin_users")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) {
    throw new Error("Access denied");
  }

  if (data.role !== "super_admin") {
    throw new Error("Access denied");
  }
}

function getAdminPrivateKey(keyId?: string | null): JsonWebKey | null {
  const keysJson = Deno.env.get("ADMIN_KEYS_JSON");
  if (keysJson && keyId) {
    try {
      const keys = JSON.parse(keysJson);
      if (keys[keyId]) {
        return keys[keyId];
      }
    } catch {
      console.error("Failed to parse ADMIN_KEYS_JSON");
    }
  }

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
