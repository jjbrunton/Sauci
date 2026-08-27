// @ts-nocheck
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0?target=deno";
import { canViewResponseMedia, getResponseMediaDescriptor } from "./helpers.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
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
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const userId = await getUserIdFromRequest(supabaseAdmin, req);
    await assertResponseAccess(supabaseAdmin, userId);

    const body = await req.json().catch(() => ({}));
    const responseId = typeof body?.responseId === "string"
      ? body.responseId
      : null;
    if (!responseId) {
      return json({ error: "Missing responseId" }, 400);
    }

    const { data: response, error: responseError } = await supabaseAdmin
      .from("responses")
      .select("id, response_data")
      .eq("id", responseId)
      .maybeSingle();

    if (responseError || !response) {
      return json({ error: "Response not found" }, 404);
    }

    const media = getResponseMediaDescriptor(response.response_data);
    if (!media) {
      return json({ error: "Response has no supported media" }, 400);
    }

    const { data: mediaBlob, error: downloadError } = await supabaseAdmin
      .storage
      .from("response-media")
      .download(media.path);

    if (downloadError || !mediaBlob) {
      console.error(
        "admin-response-media download failed",
        downloadError?.message,
      );
      return json({ error: "Failed to load response media" }, 500);
    }

    const fallbackType = media.type === "photo" ? "image/jpeg" : "audio/mp4";
    return new Response(mediaBlob, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": mediaBlob.type || fallbackType,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
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

    console.error("admin-response-media error", error);
    return json({ error: "Internal server error" }, 500);
  }
});

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

async function getUserIdFromRequest(
  supabaseAdmin: ReturnType<typeof createClient>,
  req: Request,
) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    throw new Error("Missing authorization header");
  }

  const { data, error } = await supabaseAdmin.auth.getUser(
    authHeader.replace("Bearer ", ""),
  );

  if (error || !data.user) {
    throw new Error(`Invalid token: ${error?.message || "No user"}`);
  }

  return data.user.id;
}

async function assertResponseAccess(
  supabaseAdmin: ReturnType<typeof createClient>,
  userId: string,
) {
  const { data, error } = await supabaseAdmin
    .from("admin_users")
    .select("role, permissions")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) {
    throw new Error("Access denied");
  }

  if (!canViewResponseMedia(data.role, data.permissions)) {
    throw new Error("Access denied");
  }
}
