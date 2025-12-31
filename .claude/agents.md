# Agents Documentation

This file contains important project-specific context for Claude Code agents working on this repository.

## Redemption Code System

**IMPORTANT: Codes can only be redeemed on the website, NOT in the mobile app.**

Apple's App Store guidelines require that any premium features purchased within an iOS app must go through In-App Purchase. Adding a redemption code feature to the mobile app would violate these guidelines and risk app rejection.

### Overview
Promotional codes that grant users premium access without going through RevenueCat/App Store subscription flow.

### Database Schema

**`redemption_codes` table:**
- `id` (UUID) - Primary key
- `code` (TEXT, UNIQUE) - The redemption code
- `description` (TEXT) - Optional description
- `max_uses` (INTEGER) - Maximum number of redemptions allowed
- `current_uses` (INTEGER) - Current number of redemptions
- `expires_at` (TIMESTAMPTZ) - Optional expiration date
- `is_active` (BOOLEAN) - Whether the code can be redeemed
- `created_by` (UUID) - Admin who created the code
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)

**`code_redemptions` table:**
- `id` (UUID) - Primary key
- `code_id` (UUID) - Reference to redemption_codes
- `user_id` (UUID) - User who redeemed the code
- `redeemed_at` (TIMESTAMPTZ)
- UNIQUE constraint on (code_id, user_id) - Each user can only redeem a code once

### Components

1. **Admin UI** (`apps/admin/src/pages/RedemptionCodesPage.tsx`)
   - Super admins can generate codes
   - View all codes with usage stats
   - Toggle active/inactive
   - View who redeemed each code
   - Delete codes

2. **Edge Function** (`apps/supabase/functions/redeem-code/index.ts`)
   - **Unauthenticated** - accepts email + code in request body
   - Calls the `redeem_code_by_email()` database function
   - Returns success/error response

3. **Database Function** (`redeem_code_by_email(p_email TEXT, p_code TEXT)`)
   - Atomic operation with row locking
   - Looks up user by email (must have signed up in app first)
   - Validates: code exists, is active, not expired, has uses remaining
   - Checks user hasn't already redeemed
   - Records redemption in `code_redemptions`
   - Increments `current_uses`
   - Sets `profiles.is_premium = true`

4. **Web UI** (`apps/web/app/redeem/page.tsx`)
   - Public page at `/redeem`
   - User enters email + redemption code
   - Calls edge function via fetch
   - Shows success or error message

### Environment Variables

The web app requires:
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL for API calls

### DO NOT

- **DO NOT** add redemption code UI to the mobile app
- **DO NOT** create any in-app mechanism to bypass App Store purchases
- **DO NOT** expose the redeem endpoint in mobile app Supabase calls
