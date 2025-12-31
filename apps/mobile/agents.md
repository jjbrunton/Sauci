# Mobile App - Agent Guidelines

**STRICT RULES - DO NOT VIOLATE**

## Architecture

This is an Expo React Native app using:
- **Routing**: expo-router with file-based routing in `app/` directory
- **State**: Zustand stores in `src/store/index.ts`
- **Backend**: Supabase client in `src/lib/supabase.ts`
- **UI**: Glass-morphism themed components in `src/components/ui/`
- **Theme**: Centralized theme in `src/theme/index.ts`

## Directory Structure

```
app/                    # Expo Router routes
  (auth)/               # Authentication screens
  (app)/                # Protected app screens (tabs)
src/
  components/           # Reusable components
    ui/                 # Base UI components (GlassCard, GlassButton, etc.)
  lib/                  # Utilities (supabase, analytics, revenuecat)
  store/                # Zustand stores (index.ts)
  theme/                # Theme constants (colors, gradients, spacing, etc.)
  types/                # TypeScript types
```

## Critical Rules

### Tab Bar - NEVER CHANGE

**NEVER set `backgroundColor: 'transparent'` on the tab bar.**

Always use:
```typescript
backgroundColor: 'rgba(18, 18, 18, 0.85)',
```

The BlurView in `tabBarBackground` is unreliable. The solid rgba background acts as a fallback.

Location: `app/(app)/_layout.tsx` - `tabBarStyle`

### State Management

- Use existing Zustand stores: `useAuthStore`, `useMatchStore`, `usePacksStore`, `useMessageStore`, `useSubscriptionStore`
- Access cross-store state via `getState()` (e.g., `useAuthStore.getState().user`)
- Clear related stores on sign out (see `signOut` in `useAuthStore`)

### Supabase Queries

- **Always use `.maybeSingle()` instead of `.single()`** when the row might not exist
- `.single()` throws an error if 0 or >1 rows are returned
- Check for null before performing operations

### UI Components

Use existing UI primitives from `src/components/ui/`:
- `GlassCard` - Glass-morphism card container
- `GlassButton` - Glass-styled button
- `GlassInput` - Glass-styled input field
- `GradientBackground` - Screen background gradient
- `ShimmerEffect` - Loading shimmer animation

### Theme Usage

Import from `src/theme/index.ts`:
```typescript
import { colors, gradients, spacing, radius, typography, shadows } from '@/theme';
```

**DO NOT hardcode colors**. Always use theme values.

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

1. **DO NOT** change tab bar background to transparent
2. **DO NOT** use `.single()` for queries that might return 0 rows
3. **DO NOT** hardcode colors - use theme values
4. **DO NOT** create new stores without integrating with auth sign-out cleanup
5. **DO NOT** bypass RevenueCat availability checks
6. **DO NOT** add navigation logic outside of expo-router
