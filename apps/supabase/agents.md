# Supabase - Agent Guidelines

**STRICT RULES - DO NOT VIOLATE**

## Architecture

This contains Supabase configuration:
- **Migrations**: SQL migrations in `migrations/`
- **Edge Functions**: Deno functions in `functions/`
- **Email Templates**: Auth email templates in `email-templates/`
- **Config**: Local development config in `config.toml`

## Directory Structure

```
functions/
  delete-relationship/    # Delete couple relationship
  manage-couple/          # Join/leave couple
  revenuecat-webhook/     # Subscription webhook handler
  send-message-notification/ # Push notification for messages
  send-notification/      # Push notification for matches
  submit-response/        # Save response, check matches
  sync-subscription/      # Sync RevenueCat status
migrations/               # SQL migrations
email-templates/          # Auth email templates
config.toml               # Local dev configuration
```

## Critical Rules

### Edge Function Deployment

**ALWAYS use `verify_jwt: false`** when deploying via MCP tools.

Supabase's built-in JWT verification causes 401 errors. Handle auth manually:

```typescript
const { data: { user }, error: authError } = await supabase.auth.getUser(
    authHeader.replace("Bearer ", "")
);
```

### Edge Function Pattern

All edge functions MUST follow this structure:

```typescript
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

        // Manual auth verification
        const authHeader = req.headers.get("Authorization");
        if (!authHeader) {
            return new Response(
                JSON.stringify({ error: "Missing authorization header" }),
                { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const { data: { user }, error: authError } = await supabase.auth.getUser(
            authHeader.replace("Bearer ", "")
        );

        // ... function logic
    } catch (error) {
        return new Response(
            JSON.stringify({ error: "Internal server error" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
```

### Function Auth Methods

| Function | Auth Method |
|----------|-------------|
| `manage-couple` | Manual via getUser() |
| `submit-response` | Manual via getUser() |
| `sync-subscription` | Manual via getUser() |
| `delete-relationship` | Manual via getUser() |
| `revenuecat-webhook` | Webhook signature validation |
| `send-notification` | Internal trigger (no auth) |
| `send-message-notification` | Internal trigger (no auth) |

### Migration Rules

- Use `apply_migration` MCP tool for DDL operations
- Never hardcode generated IDs in data migrations
- Always verify target environment (prod vs non-prod) before running

### Database Patterns

- Use UPSERT with `onConflict` for responses: `onConflict: "user_id,question_id"`
- Use UPSERT for matches: `onConflict: "couple_id,question_id"`
- RLS policies enforce couple-level data isolation

### Profile Creation

The `on_auth_user_created` trigger automatically creates a profile. Never assume a profile exists without checking - check for null before operations.

## MCP Environments

| Environment | MCP Server |
|-------------|------------|
| Production | `mcp__sauci-prod__*` |
| Non-Production | `mcp__sauci-non-prod__*` |

**ALWAYS verify environment before destructive operations.**

## Forbidden Actions

1. **DO NOT** use `verify_jwt: true` when deploying functions via MCP
2. **DO NOT** skip CORS headers in responses
3. **DO NOT** use service role key on client-side
4. **DO NOT** hardcode IDs in migrations
5. **DO NOT** assume profiles exist - always check for null
6. **DO NOT** run migrations on production without explicit confirmation
7. **DO NOT** expose internal error details in responses
