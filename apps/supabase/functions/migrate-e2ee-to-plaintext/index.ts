import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  unwrapWithAdminKey,
  base64ToUint8Array,
  KeysMetadata,
} from "../_shared/encryption.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/**
 * Migration function to decrypt all E2EE v2 messages and convert to v1 plaintext.
 *
 * This is a one-time migration function that:
 * 1. Fetches all messages with version = 2
 * 2. Decrypts text content using admin key
 * 3. Downloads, decrypts, and re-uploads encrypted media files
 * 4. Updates messages to version = 1 with plaintext content
 * 5. Clears E2EE metadata fields
 *
 * Requires super_admin authentication.
 */
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

    // Authenticate and verify super_admin
    const user = await getUserFromRequest(supabaseAdmin, req);
    await assertSuperAdmin(supabaseAdmin, user.id);

    // Parse options
    const body = await req.json().catch(() => ({}));
    const dryRun = body?.dryRun === true;
    const batchSize = Math.min(body?.batchSize || 50, 100);

    console.log(
      `Starting E2EE migration (dryRun=${dryRun}, batchSize=${batchSize})`
    );

    // Fetch all v2 messages
    const { data: messages, error: fetchError } = await supabaseAdmin
      .from("messages")
      .select(
        "id, user_id, match_id, content, media_path, media_type, encrypted_content, encryption_iv, keys_metadata, created_at"
      )
      .eq("version", 2)
      .order("created_at", { ascending: true })
      .limit(batchSize);

    if (fetchError) {
      console.error("Failed to fetch messages:", fetchError);
      return json({ error: "Failed to fetch messages" }, 500);
    }

    if (!messages || messages.length === 0) {
      return json({
        success: true,
        message: "No v2 messages to migrate",
        stats: { total: 0, text: 0, media: 0, errors: 0 },
      });
    }

    // Get total count for progress tracking
    const { count: totalRemaining } = await supabaseAdmin
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("version", 2);

    const stats = {
      total: messages.length,
      text: 0,
      media: 0,
      errors: 0,
      remaining: (totalRemaining ?? 0) - messages.length,
    };
    const errors: Array<{ id: string; error: string }> = [];

    for (const message of messages) {
      try {
        const keysMetadata = message.keys_metadata as KeysMetadata | null;
        const hasEncryptedContent = !!message.encrypted_content;
        const hasEncryptedMedia =
          message.media_path?.endsWith(".enc") ?? false;

        // Get admin private key
        const adminPrivateKeyJwk = getAdminPrivateKey(keysMetadata?.admin_key_id);
        if (!adminPrivateKeyJwk && (hasEncryptedContent || hasEncryptedMedia)) {
          throw new Error(
            `Admin key ${keysMetadata?.admin_key_id} not configured`
          );
        }

        let decryptedContent: string | null = null;
        let newMediaPath: string | null = message.media_path;

        // Decrypt text content
        if (hasEncryptedContent && keysMetadata && adminPrivateKeyJwk) {
          const encryptionIv = message.encryption_iv as string;
          if (!encryptionIv) {
            throw new Error("Missing encryption_iv for encrypted content");
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
            base64ToUint8Array(message.encrypted_content as string)
          );

          decryptedContent = new TextDecoder().decode(plaintext);
          stats.text++;
        }

        // Decrypt and re-upload media
        if (hasEncryptedMedia && keysMetadata && adminPrivateKeyJwk) {
          const encryptionIv = message.encryption_iv as string;
          if (!encryptionIv) {
            throw new Error("Missing encryption_iv for encrypted media");
          }

          // Download encrypted file from storage
          const { data: encryptedData, error: downloadError } =
            await supabaseAdmin.storage
              .from("chat-media")
              .download(message.media_path);

          if (downloadError || !encryptedData) {
            throw new Error(`Failed to download encrypted media: ${downloadError?.message}`);
          }

          // Decrypt the media
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

          const encryptedBytes = await encryptedData.arrayBuffer();
          const decryptedBytes = await crypto.subtle.decrypt(
            { name: "AES-GCM", iv: base64ToUint8Array(encryptionIv) },
            aesKey,
            encryptedBytes
          );

          // New path without .enc extension
          newMediaPath = message.media_path.replace(/\.enc$/, "");

          if (!dryRun) {
            // Upload decrypted file
            const { error: uploadError } = await supabaseAdmin.storage
              .from("chat-media")
              .upload(newMediaPath, decryptedBytes, {
                contentType: getContentType(message.media_type),
                upsert: true,
              });

            if (uploadError) {
              throw new Error(`Failed to upload decrypted media: ${uploadError.message}`);
            }

            // Delete old encrypted file
            await supabaseAdmin.storage
              .from("chat-media")
              .remove([message.media_path]);
          }

          stats.media++;
        }

        // Update message to v1
        if (!dryRun) {
          const updateData: Record<string, unknown> = {
            version: 1,
            content: decryptedContent ?? message.content,
            media_path: newMediaPath,
            encrypted_content: null,
            encryption_iv: null,
            keys_metadata: null,
          };

          const { error: updateError } = await supabaseAdmin
            .from("messages")
            .update(updateData)
            .eq("id", message.id);

          if (updateError) {
            throw new Error(`Failed to update message: ${updateError.message}`);
          }
        }

        console.log(
          `${dryRun ? "[DRY RUN] " : ""}Migrated message ${message.id} (text=${hasEncryptedContent}, media=${hasEncryptedMedia})`
        );
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.error(`Failed to migrate message ${message.id}:`, errorMessage);
        errors.push({ id: message.id, error: errorMessage });
        stats.errors++;
      }
    }

    return json({
      success: true,
      dryRun,
      stats,
      errors: errors.length > 0 ? errors : undefined,
      message:
        stats.remaining > 0
          ? `Migrated ${stats.total - stats.errors}/${stats.total} messages. ${stats.remaining} remaining - run again to continue.`
          : `Migration complete. ${stats.total - stats.errors}/${stats.total} messages migrated.`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";

    if (
      message.includes("authorization header") ||
      message.startsWith("Invalid token")
    ) {
      return json({ error: "Unauthorized" }, 401);
    }

    if (message === "Access denied") {
      return json({ error: "Forbidden" }, 403);
    }

    console.error("migrate-e2ee-to-plaintext error:", error);
    return json({ error: "Internal server error" }, 500);
  }
});

function json(
  body: unknown,
  status = 200,
  extraHeaders: Record<string, string> = {}
) {
  return new Response(JSON.stringify(body, null, 2), {
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

function getContentType(mediaType: string | null): string {
  switch (mediaType) {
    case "video":
      return "video/mp4";
    case "image":
      return "image/jpeg";
    default:
      return "application/octet-stream";
  }
}
