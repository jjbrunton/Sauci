// @ts-nocheck
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { unwrapWithAdminKey, base64ToUint8Array, arrayBufferToBase64, KeysMetadata } from "../_shared/encryption.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const DEFAULT_WHITELIST = [
  "ok",
  "okay",
  "yes",
  "no",
  "maybe",
  "thanks",
  "thank you",
  "lol",
  "lmao",
  "good night",
  "goodnight",
  "good morning",
  "love you",
];

const DEFAULT_KEYWORD_TRIGGERS = [
  "suicide",
  "kill myself",
  "self harm",
  "kill you",
  "hurt you",
  "rape",
  "porn",
  "nude",
  "explicit",
  "stab",
  "shoot",
];

function parseBoolean(value, defaultValue = false) {
  if (value === null || value === undefined) return defaultValue;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "y", "on"].includes(normalized)) return true;
    if (["false", "0", "no", "n", "off"].includes(normalized)) return false;
  }
  return defaultValue;
}

function parseNumber(value, defaultValue) {
  if (value === null || value === undefined) return defaultValue;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number(String(value).trim());
  return Number.isFinite(parsed) ? parsed : defaultValue;
}

function parseStringArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .filter((item) => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed
            .filter((item) => typeof item === "string")
            .map((item) => item.trim())
            .filter(Boolean);
        }
      } catch {
        // Fall through to delimiter parsing
      }
    }
    return trimmed
      .split(/[\n,]+/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function normalizeList(values) {
  return Array.from(
    new Set(
      values
        .map((value) => value.trim().toLowerCase())
        .filter(Boolean)
    )
  );
}

function getHeuristicConfig(config) {
  const enabled = parseBoolean(config?.heuristics_enabled, false);
  const minTextLength = parseNumber(config?.heuristic_min_text_length, 12);
  const whitelistMaxLength = parseNumber(config?.heuristic_whitelist_max_length, 30);
  const skipIfNoAlnum = parseBoolean(config?.heuristic_skip_if_no_alnum, true);
  const skipMediaWithoutText = parseBoolean(config?.heuristic_skip_media_without_text, false);
  const recordReason = parseBoolean(config?.heuristic_record_reason, false);
  const useDefaultWhitelist = parseBoolean(config?.heuristic_use_default_whitelist, true);
  const useDefaultKeywords = parseBoolean(config?.heuristic_use_default_keywords, true);

  const whitelist = parseStringArray(config?.heuristic_whitelist);
  const keywordTriggers = parseStringArray(config?.heuristic_keyword_triggers);

  const normalizedWhitelist = normalizeList(
    useDefaultWhitelist ? DEFAULT_WHITELIST.concat(whitelist) : whitelist
  );
  const normalizedKeywordTriggers = normalizeList(
    useDefaultKeywords ? DEFAULT_KEYWORD_TRIGGERS.concat(keywordTriggers) : keywordTriggers
  );

  return {
    enabled,
    minTextLength,
    whitelistMaxLength,
    skipIfNoAlnum,
    skipMediaWithoutText,
    recordReason,
    whitelist: normalizedWhitelist,
    keywordTriggers: normalizedKeywordTriggers,
  };
}

function evaluateHeuristics(text, hasMedia, config) {
  if (!config.enabled) {
    return { shouldCallAi: true, reason: "disabled" };
  }

  const normalized = (text || "").trim();
  const lower = normalized.toLowerCase();
  const hasText = normalized.length > 0;
  const hasAlnum = /[a-z0-9]/i.test(normalized);

  if (config.keywordTriggers.length > 0) {
    const keywordHit = config.keywordTriggers.some((keyword) => lower.includes(keyword));
    if (keywordHit) {
      return { shouldCallAi: true, reason: "keyword_trigger" };
    }
  }

  if (!hasMedia && !hasText) {
    return { shouldCallAi: false, reason: "no_content" };
  }

  if (!hasMedia) {
    if (config.skipIfNoAlnum && !hasAlnum) {
      return { shouldCallAi: false, reason: "low_signal" };
    }

    if (normalized.length <= config.whitelistMaxLength) {
      const isWhitelisted = config.whitelist.includes(lower);
      if (isWhitelisted) {
        return { shouldCallAi: false, reason: "whitelist" };
      }
    }

    if (normalized.length < config.minTextLength) {
      return { shouldCallAi: false, reason: "short_text" };
    }
  }

  if (hasMedia && config.skipMediaWithoutText && !hasText) {
    return { shouldCallAi: false, reason: "media_without_text" };
  }

  return { shouldCallAi: true, reason: "default" };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json().catch(() => ({}));
    const messageId = body.messageId || body.message_id; // Support both cases

    if (!messageId) {
      return new Response(JSON.stringify({ error: "Missing message_id" }), { status: 400, headers: corsHeaders });
    }

    // 1. Fetch AI Config
    const { data: config, error: configError } = await supabaseAdmin
      .from("ai_config")
      .select("*")
      .single();

    if (configError || !config) {
      console.error("Failed to fetch AI config:", configError);
      return new Response(JSON.stringify({ error: "Configuration missing" }), { status: 500, headers: corsHeaders });
    }

    if (!config.classifier_enabled) {
      return new Response(JSON.stringify({ message: "Classifier disabled" }), { status: 200, headers: corsHeaders });
    }

    const heuristicConfig = getHeuristicConfig(config);

    const apiKey = config.openrouter_api_key || Deno.env.get("OPENROUTER_API_KEY");
    if (!apiKey) {
      console.error("OpenRouter API Key missing");
      return new Response(JSON.stringify({ error: "API Key missing" }), { status: 500, headers: corsHeaders });
    }

    // 2. Fetch Message
    const { data: message, error: messageError } = await supabaseAdmin
      .from("messages")
      .select("id, version, content, encrypted_content, encryption_iv, keys_metadata, media_path, media_type")
      .eq("id", messageId)
      .single();

    if (messageError || !message) {
      return new Response(JSON.stringify({ error: "Message not found" }), { status: 404, headers: corsHeaders });
    }

    // 3. Decrypt Content
    const version = message.version ?? 1;
    let decryptedText = message.content;
    let mediaBase64: string | null = null;
    let mediaMimeType: string | null = null;
    const hasMedia = !!message.media_path && message.media_type === "image";
    const keysMetadata = message.keys_metadata as KeysMetadata | null;
    const encryptionIv = message.encryption_iv as string | null;
    let aesKey: CryptoKey | null = null;

    if (version === 2 && (message.encrypted_content || hasMedia)) {
      if (!keysMetadata || !encryptionIv) {
        return new Response(JSON.stringify({ error: "Missing encryption metadata" }), { status: 400, headers: corsHeaders });
      }
    }

    const getAesKey = async () => {
      if (aesKey) return aesKey;
      if (!keysMetadata || !encryptionIv) {
        throw new Error("Missing encryption metadata");
      }
      const adminPrivateKeyJwkStr = Deno.env.get("ADMIN_PRIVATE_KEY_JWK");
      if (!adminPrivateKeyJwkStr) {
        throw new Error("ADMIN_PRIVATE_KEY_JWK not set");
      }

      const adminPrivateKey = JSON.parse(adminPrivateKeyJwkStr);
      const rawAesKey = await unwrapWithAdminKey(keysMetadata.admin_wrapped_key, adminPrivateKey);

      aesKey = await crypto.subtle.importKey(
        "raw",
        rawAesKey,
        { name: "AES-GCM" },
        false,
        ["decrypt"]
      );

      return aesKey;
    };

    if (version === 2 && message.encrypted_content) {
      const key = await getAesKey();
      const plaintext = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: base64ToUint8Array(encryptionIv as string) },
        key,
        base64ToUint8Array(message.encrypted_content)
      );
      decryptedText = new TextDecoder().decode(plaintext);
    }

    const heuristicDecision = evaluateHeuristics(decryptedText, hasMedia, heuristicConfig);
    if (heuristicConfig.enabled && !heuristicDecision.shouldCallAi) {
      console.log(`Heuristic skip for message ${messageId}: ${heuristicDecision.reason}`);
      await updateStatus(
        supabaseAdmin,
        messageId,
        "safe",
        heuristicConfig.recordReason ? heuristicDecision.reason : null,
        "Neutral"
      );
      return new Response(JSON.stringify({ status: "safe" }), { headers: corsHeaders });
    }

    if (hasMedia) {
      if (version === 2) {
        const key = await getAesKey();
        const { data: mediaBlob, error: downloadError } = await supabaseAdmin.storage
          .from("chat-media")
          .download(normalizeChatMediaPath(message.media_path));

        if (!downloadError && mediaBlob) {
          const encryptedBytes = await mediaBlob.arrayBuffer();
          const decryptedBytes = await crypto.subtle.decrypt(
            { name: "AES-GCM", iv: base64ToUint8Array(encryptionIv as string) },
            key,
            encryptedBytes
          );
          mediaBase64 = arrayBufferToBase64(decryptedBytes);
          mediaMimeType = "image/jpeg";
        }
      } else {
        const { data: mediaBlob } = await supabaseAdmin.storage
          .from("chat-media")
          .download(normalizeChatMediaPath(message.media_path));

        if (mediaBlob) {
          const buffer = await mediaBlob.arrayBuffer();
          mediaBase64 = arrayBufferToBase64(buffer);
          mediaMimeType = "image/jpeg";
        }
      }
    }

    // 4. Construct LLM Payload
    const messages = [
      { role: "system", content: config.classifier_prompt },
      {
        role: "user",
        content: [
            decryptedText ? { type: "text", text: decryptedText } : null,
            mediaBase64 ? { 
                type: "image_url", 
                image_url: { url: `data:${mediaMimeType};base64,${mediaBase64}` } 
            } : null
        ].filter(Boolean)
      }
    ];
    
    // If no content to classify, mark safe
    if (messages[1].content.length === 0) {
        await updateStatus(supabaseAdmin, messageId, "safe", "No content");
        return new Response(JSON.stringify({ status: "safe" }), { headers: corsHeaders });
    }

    // 5. Call OpenRouter
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://sauci.app",
        "X-Title": "Sauci"
      },
      body: JSON.stringify({
        model: config.classifier_model || "openai/gpt-4o",
        messages: messages,
        response_format: { type: "json_object" }
      })
    });

    if (!response.ok) {
        const errText = await response.text();
        console.error("OpenRouter Error:", errText);
        throw new Error(`OpenRouter API Error: ${response.status}`);
    }

    const aiResult = await response.json();
    const contentStr = aiResult.choices?.[0]?.message?.content;
    
    if (!contentStr) {
        throw new Error("Empty response from AI");
    }

    let classification;
    try {
        classification = JSON.parse(contentStr);
    } catch (e) {
        console.error("Failed to parse JSON:", contentStr);
        // Fallback: simple text check
        const lower = contentStr.toLowerCase();
        if (lower.includes("flagged") || lower.includes("unsafe")) {
            classification = { status: "flagged", reason: "AI output parsing failed, but keyword detected." };
        } else {
            classification = { status: "safe" };
        }
    }

    // 6. Update Message
    const status = classification.status === "flagged" ? "flagged" : "safe";
    const reason = classification.reason || null;
    const category = classification.category || "Neutral"; // Default to Neutral if missing
    
    await updateStatus(supabaseAdmin, messageId, status, reason, category);

    return new Response(JSON.stringify({ success: true, classification }), { headers: corsHeaders });

  } catch (error) {
    console.error("Classify Error:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
});

async function updateStatus(supabase, id, status, reason, category) {
    await supabase.from("messages").update({
        moderation_status: status,
        flag_reason: reason,
        category: category
    }).eq("id", id);
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
