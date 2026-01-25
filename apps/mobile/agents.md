# Mobile App - Agent Guidelines

**STRICT RULES - DO NOT VIOLATE**

## Architecture

This is an Expo React Native app using:
- **Routing**: expo-router with file-based routing in `app/` directory
- **State**: Zustand stores in `src/store/index.ts`
- **Backend**: Supabase client in `src/lib/supabase.ts`

Design guidance lives in `apps/mobile/DESIGN.md`.

## Directory Structure

```
app/                    # Expo Router routes
  (auth)/               # Authentication screens
  (app)/                # Protected app screens (tabs)
src/
  components/           # Reusable components
    ui/
  lib/                  # Utilities (supabase, analytics, revenuecat)
  store/                # Zustand stores (index.ts)
  theme/
  types/                # TypeScript types
```

## Critical Rules

### File Size

- Keep files small: aim for 200-300 lines max per file.

### State Management

- Use existing Zustand stores: `useAuthStore`, `useMatchStore`, `usePacksStore`, `useMessageStore`, `useSubscriptionStore`
- Access cross-store state via `getState()` (e.g., `useAuthStore.getState().user`)
- Clear related stores on sign out (see `signOut` in `useAuthStore`)

### Supabase Queries

- **Always use `.maybeSingle()` instead of `.single()`** when the row might not exist
- `.single()` throws an error if 0 or >1 rows are returned
- Check for null before performing operations

### Response Handling

- Responses use UPSERT with `onConflict: "user_id,question_id"`
- Match detection happens in `submit-response` edge function

### Typing

- Import shared types from `@/types`
- Import Supabase types from `@/types/supabase`

### RevenueCat

- RevenueCat service in `src/lib/revenuecat.ts`
- Does not work in Expo Go - check `revenueCatService.isAvailable()` first
- Initialize with user ID after auth

### Analytics

- Use `Events` from `src/lib/analytics` for tracking
- Track: `packEnabled`, `packDisabled`, `signOut`, etc.

## Forbidden Actions

1. **DO NOT** use `.single()` for queries that might return 0 rows
2. **DO NOT** create new stores without integrating with auth sign-out cleanup
3. **DO NOT** bypass RevenueCat availability checks
4. **DO NOT** add navigation logic outside of expo-router
