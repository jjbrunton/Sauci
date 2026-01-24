// @ts-nocheck
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0?target=deno";
import { decode } from "https://deno.land/std@0.208.0/encoding/base64.ts";
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
        "id, version, media_path, media_type, encryption_iv, keys_metadata"
      )
      .eq("id", messageId)
      .single();

    if (messageError || !message) {
      return json({ error: "Message not found" }, 404);
    }

    const mediaPath = message.media_path as string | null;
    const mediaType = message.media_type as ("image" | "video" | null);
    const version = message.version ?? 1;

    if (!mediaPath) {
      return json({ error: "Message has no media" }, 400);
    }

    const normalizedPath = normalizeChatMediaPath(mediaPath);

    const { data: mediaBlob, error: downloadError } = await supabaseAdmin.storage
      .from("chat-media")
      .download(normalizedPath);

    if (downloadError || !mediaBlob) {
      return json({ error: `Failed to download media: ${downloadError.message}` }, 500);
    }

    const encryptedBytes = await mediaBlob.arrayBuffer();

    let outputBytes = encryptedBytes;

    if (version === 2) {
      const encryptionIv = message.encryption_iv as string | null;
      const keysMetadata = message.keys_metadata as KeysMetadata | null;

      if (!encryptionIv || !keysMetadata) {
        return json({ error: "Missing encryption metadata" }, 400);
      }

      const adminPrivateKeyJwkStr = Deno.env.get("ADMIN_PRIVATE_KEY_JWK");
      if (!adminPrivateKeyJwkStr) {
        return json({ error: "Admin decryption key not configured" }, 500);
      }

      const rawAesKey = await unwrapWithAdminKey(
        keysMetadata.admin_wrapped_key,
        JSON.parse(adminPrivateKeyJwkStr)
      );

      const aesKey = await crypto.subtle.importKey(
        "raw",
        rawAesKey,
        { name: "AES-GCM" },
        false,
        ["decrypt"]
      );

      outputBytes = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: base64ToUint8Array(encryptionIv) },
        aesKey,
        encryptedBytes
      );
    }

    const contentType =
      mediaType === "video" ? "video/mp4" : mediaType === "image" ? "image/jpeg" : "application/octet-stream";

    return new Response(outputBytes, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": contentType,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";

    if (message.includes("authorization header") || message.startsWith("Invalid token")) {
      return json({ error: "Unauthorized" }, 401);
    }

    if (message === "Access denied") {
      return json({ error: "Forbidden" }, 403);
    }

    console.error("admin-decrypt-media error:", error);
    return json({ error: "Internal server error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
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

function normalizeChatMediaPath(mediaPath: string): string {
  if (mediaPath.startsWith("http")) {
    const parts = mediaPath.split("/chat-media/");
    if (parts.length > 1) {
      return decodeURIComponent(parts[1]);
    }
  }

  return mediaPath;
}
