# Mobile data retrieval review: task list

This task list targets the **Home**, **Swipe**, and **Matches** flows in `apps/mobile`, focusing on correctness, performance, and realtime consistency.

## Overview (current state)

- Data fetching is split between Zustand stores (`useMatchStore`, `usePacksStore`) and screen-local Supabase RPC calls (notably `SwipeScreen`).
- Realtime updates are centralized in `apps/mobile/app/(app)/_layout.tsx` (matches/messages/profile/pack-settings subscriptions).
- Main risks today: missing query filters & error/loading states, redundant fetches, state races on param changes, and unread-count drift between realtime and the matches list.

## Scope

- Screens
  - Home: `apps/mobile/app/(app)/index.tsx`
  - Swipe: `apps/mobile/app/(app)/swipe.tsx`
  - Matches: `apps/mobile/app/(app)/matches.tsx`
- Stores
  - Matches: `apps/mobile/src/store/matchStore.ts`
  - Packs: `apps/mobile/src/store/packsStore.ts`
  - Messages: `apps/mobile/src/store/messageStore.ts`
- Realtime orchestration
  - `apps/mobile/app/(app)/_layout.tsx`

## Priority 0 — correctness (must fix)

- [ ] **Home: fix packs count source-of-truth**
  - Current: `enabledPacksCount = packs.length` (counts available packs).
  - Decide + implement:
    - If label means *enabled*: use `enabledPackIds.length`.
    - If label means *available*: rename the variable + label.
  - Acceptance: packs number matches user expectations and store state.

- [ ] **Swipe: normalize `packId` and reset state on param changes**
  - Normalize `packId` from `useLocalSearchParams()` (`string | string[]`) before sending to RPC.
  - Reset `currentIndex`, `isLoading`, and any derived UI state when `packId` changes.
  - Acceptance: switching packs never shows stale index/loading/UI.

- [ ] **Swipe: add race protection for overlapping async fetches**
  - Use a request-id guard (or abort pattern) so older `fetchQuestions()` results cannot overwrite newer results.
  - Acceptance: rapid navigation/focus changes never clobber newer state.

- [ ] **Swipe: prevent stale “blocked” state on answer-gap errors**
  - Ensure `checkAnswerGap()` clears/updates `isBlocked` + `gapInfo` deterministically even when RPC errors.
  - Acceptance: blocked UI never “sticks” due to transient failures.

## Priority 1 — UX and data freshness

- [ ] **Home: ensure data freshness on revisit**
  - Add `useFocusEffect` or a simple staleness TTL in stores.
  - Acceptance: counts (matches/new/packs) refresh when returning to Home.

- [ ] **Home: align “Recent Matches” semantics**
  - `useMatchStore.fetchMatches()` sorts unread first; Home slices top 3.
  - Decide:
    - True recent by `created_at`, or
    - “Top matches” by unread-first.
  - Acceptance: section name and behavior match.

- [ ] **Matches screen: wire up pull-to-refresh correctly**
  - Add `isLoading`/`isRefreshing` + `error` to `useMatchStore`.
  - Use those flags for `RefreshControl.refreshing`.
  - Acceptance: pull-to-refresh shows spinner and recovers from errors.

## Priority 2 — performance and query efficiency

- [ ] **MatchStore: add explicit filtering and guard empty `in(...)` lists**
  - Filter matches by `couple_id` (in addition to RLS) for clarity/perf.
  - If no matches, avoid calling `.in('question_id', [])`.
  - Acceptance: fewer noisy requests; no empty-list edge behavior.

- [ ] **MatchStore: reduce unread-count work**
  - Current approach fetches one row per unread message and counts on client.
  - Options:
    - Add RPC/view that returns per-match unread counts.
    - Or store a denormalized `unread_count` per match (if acceptable).
  - Acceptance: fetching matches scales with large message histories.

- [ ] **Swipe: remove heavy dependency on `fetchPacks()`**
  - Swipe often only needs `enabledPackIds`.
  - Add lightweight `ensureEnabledPacksLoaded()` or call `fetchEnabledPacks()` directly.
  - Acceptance: less data fetched when entering Swipe.

- [ ] **Swipe: replace random comparator sort**
  - Replace `Array.sort()` comparator using `Math.random()` with a stable score/shuffle pass.
  - Acceptance: consistent ordering logic; avoids comparator contract violations.

## Priority 3 — realtime correctness and consistency

- [ ] **Realtime messages: tighten subscription filter**
  - Current `messages` subscription listens without a `filter`.
  - Improve by filtering to the user’s couple scope (schema permitting) or alternative channel strategy.
  - Acceptance: avoids noise; reduces risk of unintended cross-couple events.

- [ ] **Sync per-match unread counts with realtime events**
  - Currently global unread count updates live; per-match counts update only on `fetchMatches()`.
  - Options:
    - Update `useMatchStore` unreadCount per match when realtime message arrives.
    - Or trigger a targeted refresh when new partner message arrives.
  - Acceptance: Matches list ordering/badges update as messages arrive.

## Optional: structural improvements (bigger refactors)

- [ ] Consolidate fetching into a query layer (e.g., TanStack Query) with caching, invalidation, retries, and focus refetch.
- [ ] Create a single “matches list” RPC that returns:
  - match + question
  - who-answered-first info (for two-part display)
  - per-match unread counts
  - new match flag
- [ ] Add lightweight integration tests around:
  - `packId` parsing
  - request race guards
  - unread count updates

## Suggested implementation order

1. P0 correctness (Home packs count, Swipe param/reset/races, gap-state)
2. Matches loading/refresh UX
3. Query efficiency (couple filters, unread-count optimization)
4. Realtime tightening + unread sync
5. Optional refactors
