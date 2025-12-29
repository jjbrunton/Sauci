# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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
- `send-notification` - Push notifications for matches
- `revenuecat-webhook` - Subscription webhook handler
- `sync-subscription` - Syncs RevenueCat subscription status

### Key Patterns
- Responses use UPSERT with `onConflict: "user_id,question_id"`
- Match detection happens in `submit-response` edge function after each response
- Real-time subscriptions used for chat messages
- RevenueCat handles in-app purchases and subscription management
- RLS policies enforce couple-level data isolation
