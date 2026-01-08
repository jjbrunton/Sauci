# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Important: Design Guidelines

**Always read `apps/mobile/DESIGN.md` before making UI/UX changes to the mobile app.** This file contains the design system, visual language, and styling patterns that must be followed for consistency. Agents and subagents should read this file when:
- Creating new screens or components
- Modifying existing UI elements
- Adding animations or visual effects
- Working with colors, typography, or spacing

## Project Overview

Sauci is a couples intimacy app featuring swipeable question packs with partner matching. Users swipe on questions (yes/no/maybe), and when both partners answer positively, a "match" is created that unlocks a chat thread for that question.

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
- **Always verify which environment you're targeting before running migrations or destructive operations**

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

### Database Best Practices
- **Always use `.maybeSingle()` instead of `.single()`** when the row might not exist. `.single()` throws an error if 0 or >1 rows are returned.
- **Profile creation trigger**: The `on_auth_user_created` trigger automatically creates a profile when a user signs up. Never assume a profile exists without checking.
- **Check for null profiles** in edge functions before performing operations.

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
