# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Important: Design Guidelines

**Always read `apps/mobile/DESIGN.md` before making UI/UX changes to the mobile app.** This file contains the design system, visual language, and styling patterns that must be followed for consistency. Agents and subagents should read this file when:
- Creating new screens or components
- Modifying existing UI elements
- Adding animations or visual effects
- Working with colors, typography, or spacing

## Project Overview

Sauci is a couples relationship app that helps partners communicate better and grow closer together. Users swipe on thoughtful questions (yes/no/maybe), and when both partners answer positively, a "match" is created that unlocks a chat thread for that topic.

## Commands

```bash
# Install dependencies (from root)
npm install

# Start all apps in development
npm run dev

# Run specific apps
cd apps/mobile && npm run dev      # Expo mobile app
cd apps/admin && npm run dev       # React Admin dashboard

# Type checking
npm run typecheck

# Linting
npm run lint

# Build all
npm run build
```

### Mobile-specific commands
```bash
cd apps/mobile
npm run ios       # Run on iOS simulator
npm run android   # Run on Android emulator
npm run web       # Run in browser
```

### Supabase commands
```bash
supabase start                                    # Start local Supabase
supabase db reset                                 # Reset DB and run all migrations
supabase functions serve                          # Run edge functions locally
supabase migration new <name>                     # Create new migration
```

### Supabase Environments

There are two Supabase projects configured via MCP servers:

| Environment | Project Ref | URL | MCP Server |
|-------------|-------------|-----|------------|
| **Production** | `ckjcrkjpmhqhiucifukx` | https://ckjcrkjpmhqhiucifukx.supabase.co | `sauci-prod` |
| **Non-Production** | `itbzhrvlgvdmzbnhzhyx` | https://itbzhrvlgvdmzbnhzhyx.supabase.co | `sauci-non-prod` |

When using Claude Code with MCP tools:
- Use `mcp__sauci-prod__*` tools for production database operations
- Use `mcp__sauci-non-prod__*` tools for development/staging database operations
- **Always verify which environment you're targeting before running destructive operations**

### Database Migrations - CRITICAL

> **STOP: Read this entire section before making ANY database schema change.**

#### The Golden Rule

**ALL schema changes MUST go through local migration files.** No exceptions.

#### Forbidden Actions

- **NEVER call `apply_migration` via MCP** (either `mcp__sauci-prod__apply_migration` or `mcp__sauci-non-prod__apply_migration`). This creates migration entries in the remote database with NO local file, which breaks `supabase db push` in CI and causes deployment failures that are painful to fix.
- **NEVER run DDL statements (`CREATE`, `ALTER`, `DROP`) via `execute_sql`**. This changes the schema without any migration tracking at all.
- **NEVER manually INSERT into `supabase_migrations.schema_migrations`** unless repairing a broken migration history (and only with explicit user approval).

#### Why This Matters

The CI/CD pipeline runs `supabase db push --include-all` which compares local migration files against the remote `schema_migrations` table. If the remote has migrations that don't exist locally, or local files exist without remote entries, the deployment **will fail** and block all subsequent deployments.

**A single `apply_migration` call can break deployments for the entire project.**

#### Correct Workflow for Schema Changes

```bash
# 1. Create migration file locally
supabase migration new <descriptive_name>

# 2. Edit the migration file in apps/supabase/migrations/

# 3. Make migrations idempotent where possible
#    Use: CREATE OR REPLACE, IF NOT EXISTS, DROP IF EXISTS
#    This prevents failures if re-run

# 4. Test locally
supabase db reset

# 5. Commit the migration file to git

# 6. Deploy happens automatically via CI on push to master
#    OR deploy manually:
supabase link --project-ref <project_ref>
supabase db push
```

#### MCP Tools - What IS Allowed

- **Reading data:** `execute_sql` with SELECT queries only
- **Exploring schema:** `list_tables`, `list_migrations`, `list_extensions`
- **Deploying edge functions:** `deploy_edge_function`
- **Generating types:** `generate_typescript_types`
- **Checking advisors:** `get_advisors`

#### If You Accidentally Used `apply_migration`

If a migration was applied via MCP, you must immediately:
1. Retrieve the migration SQL from `schema_migrations.statements`
2. Create a matching local file: `apps/supabase/migrations/<version>_<name>.sql`
3. Commit and push the file so CI can reconcile

## Architecture

### Monorepo Structure (Turborepo)
- `apps/mobile` - Expo React Native app (expo-router for navigation)
- `apps/admin` - React Admin dashboard for content management
- `apps/supabase` - Database migrations and edge functions
- `packages/shared` - Shared TypeScript types (`@sauci/shared`)

### Mobile App Architecture
- **Routing**: Expo Router with file-based routing (`app/` directory)
  - `(auth)/` - Authentication screens
  - `(app)/` - Main app screens (protected)
- **State Management**: Zustand stores in `src/store/index.ts`
  - `useAuthStore` - User, couple, partner state
  - `useMatchStore` - Matches and notifications
  - `usePacksStore` - Question packs and enabled packs per couple
  - `useMessageStore` - Chat messages and unread counts
  - `useSubscriptionStore` - RevenueCat subscription state
- **Backend**: Supabase client in `src/lib/supabase.ts`
- **UI Components**: Glass-morphism themed components in `src/components/ui/`

### Data Model (Core Entities)
- **Profile** - User profile extending Supabase auth (has `couple_id`)
- **Couple** - Two users linked via invite code
- **QuestionPack** - Collection of questions (can be premium)
- **Question** - Individual question with intensity level (1-5)
- **Response** - User's answer (yes/no/maybe) to a question
- **Match** - Created when both partners answer positively (yes_yes, yes_maybe, maybe_maybe)

### Edge Functions
Edge functions in `apps/supabase/functions/` handle complex operations:
- `submit-response` - Saves response, checks for matches, triggers notifications
- `manage-couple` - Join/leave couple operations
- `delete-relationship` - Deletes couple data (matches, messages, media) while keeping accounts
- `delete-account` - Permanently deletes user account and all associated data (Apple App Store requirement)
- `send-notification` - Push notifications for matches
- `send-nudge-notification` - Partner nudge notifications (rate limited to once per 12 hours)
- `send-unpaired-reminder` - Daily cron reminder for unpaired users to share invite code
- `send-catchup-reminder` - Daily cron reminder for "behind" partners with escalating frequency
- `revenuecat-webhook` - Subscription webhook handler
- `sync-subscription` - Syncs RevenueCat subscription status
- `redeem-code` - Redeems promotional codes for premium access (website only)

#### Edge Function Deployment Guidelines
When deploying edge functions via MCP tools (`mcp__sauci-*__deploy_edge_function`):

**IMPORTANT: Always use `verify_jwt: false`** for all edge functions. Supabase's built-in JWT verification causes 401 errors even with valid tokens. Instead, handle authentication manually in the function code using:
```typescript
const { data: { user }, error: authError } = await supabase.auth.getUser(
    authHeader.replace("Bearer ", "")
);
```

This approach:
- Gives better error messages
- Allows custom auth handling
- Avoids mysterious 401 failures

**Current function settings (all should be verify_jwt: false):**
| Function | verify_jwt | Auth Method |
|----------|------------|-------------|
| `manage-couple` | false | Manual via getUser() |
| `submit-response` | false | Manual via getUser() |
| `sync-subscription` | false | Manual via getUser() |
| `delete-relationship` | false | Manual via getUser() |
| `delete-account` | false | Manual via getUser() |
| `redeem-code` | false | Manual via getUser() |
| `revenuecat-webhook` | false | Webhook signature validation |
| `send-notification` | false | Internal trigger (no auth) |
| `send-message-notification` | false | Internal trigger (no auth) |
| `send-nudge-notification` | false | Manual via getUser() |
| `send-unpaired-reminder` | false | Cron trigger (no auth) |
| `send-catchup-reminder` | false | Cron trigger (no auth) |

### Database Best Practices
- **Always use `.maybeSingle()` instead of `.single()`** when the row might not exist. `.single()` throws an error if 0 or >1 rows are returned.
- **Profile creation trigger**: The `on_auth_user_created` trigger automatically creates a profile when a user signs up. Never assume a profile exists without checking.
- **Check for null profiles** in edge functions before performing operations.

### Cron Jobs (pg_cron) - IMPORTANT

**NEVER hardcode Supabase URLs in cron job migrations.** Migrations run on both prod and non-prod, so a hardcoded production URL will cause non-prod cron jobs to hit production (double-firing notifications, duplicate processing, etc.).

**Correct pattern** — use `get_supabase_edge_function_url()`:
```sql
SELECT cron.schedule(
    'my-cron-job',
    '*/5 * * * *',
    format(
        $cmd$
        SELECT net.http_post(
            url := %L,
            headers := jsonb_build_object('Content-Type', 'application/json'),
            body := '{}'::jsonb
        )
        $cmd$,
        get_supabase_edge_function_url('my-edge-function')
    )
);
```

This resolves the URL from `app_config.supabase_url` at migration-time, so each environment targets its own edge functions.

**If adding a new environment**, you must seed the URL before running migrations:
```sql
UPDATE app_config SET supabase_url = 'https://<project-ref>.supabase.co';
```

### Key Patterns
- Responses use UPSERT with `onConflict: "user_id,question_id"`
- Match detection happens in `submit-response` edge function after each response
- Real-time subscriptions used for chat messages
- RevenueCat handles in-app purchases and subscription management
- RLS policies enforce couple-level data isolation

### Redemption Code System
Promotional codes that grant users premium access. **Codes can only be redeemed on the website, NOT in the mobile app.**

**Database Tables:**
- `redemption_codes` - Stores codes with max_uses, current_uses, expiration, active status
- `code_redemptions` - Tracks which users redeemed which codes

**Components:**
- **Admin UI** (`apps/admin/src/pages/RedemptionCodesPage.tsx`) - Super admins can generate, manage, and view redemption codes
- **Edge Function** (`apps/supabase/functions/redeem-code/`) - Validates and processes code redemption (unauthenticated, accepts email + code)
- **Database Function** (`redeem_code_by_email(p_email, p_code)`) - Atomic redemption with validation (active, not expired, has uses remaining, user hasn't redeemed)
- **Web UI** (`apps/web/app/redeem/page.tsx`) - Public redemption page

**Flow:**
1. Admin generates code in admin dashboard
2. User visits `/redeem` on website and enters email + code
3. `redeem-code` edge function calls `redeem_code_by_email()` database function
4. Database function looks up user by email, validates code, and sets `profiles.is_premium = true`

**Important:** Do NOT add redemption code UI to the mobile app. Apple requires in-app purchases for premium features purchased within iOS apps.

## Mobile UI - DO NOT CHANGE

### Tab Bar Background
**NEVER set `backgroundColor: 'transparent'` on the tab bar.** Always use a semi-transparent solid color:
```typescript
backgroundColor: 'rgba(18, 18, 18, 0.85)',
```

The `BlurView` in `tabBarBackground` is unreliable and can fail during re-renders/transitions, causing a fully transparent tab bar. The solid rgba background acts as a fallback while still allowing the blur effect on top.

**Location:** `apps/mobile/app/(app)/_layout.tsx` - `tabBarStyle`

## Infrastructure as Code (Terraform)

Supabase project configuration is managed via Terraform in the `terraform/` directory. This includes auth settings, OAuth providers, email templates, SMTP config, rate limits, and more.

**Directory structure:**
```
terraform/
├── modules/
│   └── supabase/           # Shared configuration module
│       ├── main.tf
│       ├── variables.tf
│       ├── outputs.tf
│       └── templates/      # Email templates
└── environments/
    ├── prod/               # Production (ckjcrkjpmhqhiucifukx)
    └── non-prod/           # Non-production (itbzhrvlgvdmzbnhzhyx)
```

**When to update Terraform:**
- Changing auth settings (OAuth providers, JWT expiry, MFA settings)
- Modifying email templates or subjects
- Updating rate limits or security settings
- Changing SMTP configuration
- Modifying storage or API settings

**Workflow (always test in non-prod first):**
```bash
# 1. Apply to non-prod first
cd terraform/environments/non-prod
export TF_VAR_supabase_access_token=sbp_xxxxx
terraform plan
terraform apply

# 2. Verify changes work in non-prod

# 3. Apply to prod
cd terraform/environments/prod
terraform plan
terraform apply
```

**Important:** After making Terraform changes, remind the user to:
1. Commit the updated `terraform/` files
2. The GitHub Action will auto-apply on merge to master (non-prod first, then prod)

**Do NOT use Terraform for:**
- Database schema changes (use migrations)
- Edge function deployment (use CLI or MCP)
- Storage bucket creation (use migrations)

## Edge Function Secrets

Edge functions use secrets stored in Supabase. These are synced from GitHub Secrets during CI/CD deployment.

**Current secrets:**
| Secret | Used By | Description |
|--------|---------|-------------|
| `REVENUECAT_WEBHOOK_SECRET` | revenuecat-webhook | Webhook signature validation |
| `REVENUECAT_API_KEY` | sync-subscription | RevenueCat API access |
| `REVENUECAT_ENTITLEMENT_ID` | sync-subscription | Entitlement identifier |
| `OPENROUTER_API_KEY` | classify-message | AI classification API |
| `ADMIN_PRIVATE_KEY_JWK` | admin-decrypt-* | E2EE admin decryption |
| `ADMIN_KEYS_JSON` | admin-decrypt-*, migrate-e2ee | Multiple admin keys |
| `DISCORD_WEBHOOK_URL` | send-discord-notification | Discord notifications |

**Auto-provided by Supabase (don't set):**
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

**When adding a new edge function that needs secrets:**
1. Add the secret to the edge function code: `Deno.env.get("SECRET_NAME")`
2. Update `.github/workflows/deploy-supabase.yml` to include the new secret in the sync step
3. Update `apps/supabase/functions/.secrets.example` with the new secret
4. **Remind the user** to add the secret to GitHub Secrets (Settings → Secrets → Actions)
5. Update this table in CLAUDE.md

**Local development:**
```bash
cp apps/supabase/functions/.secrets.example apps/supabase/functions/.secrets
# Fill in values
supabase functions serve --env-file apps/supabase/functions/.secrets
```
