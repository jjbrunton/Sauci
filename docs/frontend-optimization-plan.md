# Frontend-Backend Communication Optimization Plan

This document outlines identified chattiness issues in the Sauci mobile app and provides a prioritized implementation plan for optimizations.

## Executive Summary

**Estimated Extra Traffic:** ~40-50% of current API calls are redundant or suboptimal

**Key Problem Areas:**
- Partner profile refreshed on every message send
- Match details fetched from DB instead of using cached store data
- Redundant polling alongside real-time subscriptions
- N+1 query patterns in match/response fetching
- Missing caching strategies across stores

---

## High Priority Tasks

### Task 1: Cache Partner Public Key with TTL

**Impact:** Eliminates 1 database query per message sent

**Current Behavior:**
- `useEncryptedSend.ts:84-85` calls `refreshPartner()` on every text message
- `useMediaUpload.ts:80-81` calls `refreshPartner()` on every media upload
- No caching - always hits database

**Files to Modify:**
- `apps/mobile/src/store/authStore.ts`
- `apps/mobile/src/hooks/useEncryptedSend.ts`
- `apps/mobile/src/features/chat/hooks/useMediaUpload.ts`

**Implementation:**
```typescript
// In authStore.ts - add to state
partnerLastFetched: number | null;

// In refreshPartner action
refreshPartner: async () => {
  const now = Date.now();
  const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  const { partner, partnerLastFetched } = get();

  // Return early if cache is fresh and partner has public key
  if (partner?.public_key_jwk &&
      partnerLastFetched &&
      now - partnerLastFetched < CACHE_TTL) {
    return;
  }

  // ... existing fetch logic
  set({ partner: data, partnerLastFetched: now });
}
```

**In hooks - add force refresh option:**
```typescript
// Only force refresh if encryption fails due to key mismatch
const sendEncrypted = async (content: string, forceKeyRefresh = false) => {
  if (forceKeyRefresh) {
    await refreshPartner();
  }
  // ... rest of logic
}
```

**Acceptance Criteria:**
- [ ] Partner profile cached for 5 minutes
- [ ] Cache bypassed if `public_key_jwk` is null
- [ ] Force refresh available for encryption failures
- [ ] No regression in E2EE functionality

---

### Task 2: Use Store Data for Message Notifications

**Impact:** Eliminates 1 database query per incoming message

**Current Behavior:**
- `_layout.tsx:462-466` fetches match details from DB for every incoming message
- Match data already exists in `matchStore`

**Files to Modify:**
- `apps/mobile/app/(app)/_layout.tsx`

**Implementation:**
```typescript
// Replace DB query with store lookup
const handleNewMessage = async (newMessage: Message) => {
  // Try to get match from store first
  const { matches } = useMatchStore.getState();
  const existingMatch = matches.find(m => m.id === newMessage.match_id);

  if (existingMatch) {
    // Use cached data
    showNotificationToast(existingMatch.question.text, newMessage);
  } else {
    // Fallback: fetch from DB only if not in store (rare edge case)
    const { data: match } = await supabase
      .from("matches")
      .select("id, question:questions(text)")
      .eq("id", newMessage.match_id)
      .single();

    if (match) {
      showNotificationToast(match.question.text, newMessage);
      // Also refresh matches store since we're missing data
      fetchMatches();
    }
  }
};
```

**Acceptance Criteria:**
- [ ] Message notifications use store data when available
- [ ] Fallback to DB query only when match not in store
- [ ] Store refreshed if match is missing (data consistency)

---

### Task 3: Remove Redundant Polling in Pairing Screen

**Impact:** Eliminates polling every 5 seconds when waiting for partner

**Current Behavior:**
- `pairing.tsx:39-45` polls `fetchCouple()` every 5 seconds
- `pairing.tsx:47-71` also subscribes to real-time profile updates
- Both doing the same job - redundant

**Files to Modify:**
- `apps/mobile/app/(app)/pairing.tsx`

**Implementation:**
```typescript
// DELETE the polling interval (lines 39-45)
// KEEP only the real-time subscription

useEffect(() => {
  if (!couple || partner) return;

  // Real-time subscription handles partner joining
  const subscription = supabase
    .channel(`couple-${couple.id}`)
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "profiles",
        filter: `couple_id=eq.${couple.id}`,
      },
      (payload) => {
        if (payload.new.id !== user?.id) {
          fetchCouple(); // Partner joined
        }
      }
    )
    .subscribe();

  return () => {
    subscription.unsubscribe();
  };
}, [couple, partner, user?.id, fetchCouple]);
```

**Acceptance Criteria:**
- [ ] Polling removed
- [ ] Real-time subscription still detects partner joining
- [ ] No increase in time to detect partner

---

## Medium Priority Tasks

### Task 4: Optimize Match Responses Query (N+1 Fix)

**Impact:** Reduces 2 queries to 1, eliminates client-side filtering

**Current Behavior:**
- `matchStore.ts:23-29` fetches all matches
- `matchStore.ts:35-38` fetches ALL responses separately
- Client-side filtering to match responses to questions

**Files to Modify:**
- `apps/mobile/src/store/matchStore.ts`

**Implementation:**
```typescript
// Option A: Join responses in single query
const fetchMatches = async () => {
  const { data: matches } = await supabase
    .from("matches")
    .select(`
      *,
      question:questions(*),
      user_response:responses!inner(
        id, answer, user_id
      )
    `)
    .eq("couple_id", coupleId)
    .in("responses.user_id", [userId, partnerId])
    .order("created_at", { ascending: false });

  // Process matches with embedded responses
  const processedMatches = matches?.map(match => ({
    ...match,
    userAnswer: match.user_response.find(r => r.user_id === userId)?.answer,
    partnerAnswer: match.user_response.find(r => r.user_id === partnerId)?.answer,
  }));

  set({ matches: processedMatches });
};
```

**Alternative - Database View:**
```sql
-- Create view that joins match with responses
CREATE VIEW match_with_responses AS
SELECT
  m.*,
  q.text as question_text,
  q.intensity,
  ur.answer as user_answer,
  pr.answer as partner_answer
FROM matches m
JOIN questions q ON m.question_id = q.id
LEFT JOIN responses ur ON m.question_id = ur.question_id AND ur.user_id = m.user1_id
LEFT JOIN responses pr ON m.question_id = pr.question_id AND pr.user_id = m.user2_id;
```

**Acceptance Criteria:**
- [ ] Single query fetches matches with responses
- [ ] No client-side filtering of responses
- [ ] Match list still displays correctly

---

### Task 5: Fix Mark All As Seen Trigger

**Impact:** Eliminates unnecessary DB updates on every render

**Current Behavior:**
- `matches.tsx:66-69` calls `markAllAsSeen()` whenever `matches.length` changes
- Triggers even when navigating back to screen with same matches

**Files to Modify:**
- `apps/mobile/app/(app)/matches.tsx`

**Implementation:**
```typescript
// Move markAllAsSeen to useFocusEffect, run once per focus
useFocusEffect(
  useCallback(() => {
    fetchMatches();

    // Mark as seen after fetch completes
    return () => {
      // Optionally mark as seen on blur instead
    };
  }, [])
);

// Separate effect for marking seen - runs once after initial fetch
const [hasMarkedSeen, setHasMarkedSeen] = useState(false);

useEffect(() => {
  if (matches.length > 0 && !hasMarkedSeen) {
    markAllAsSeen();
    setHasMarkedSeen(true);
  }
}, [matches.length, hasMarkedSeen]);

// Reset on screen blur
useFocusEffect(
  useCallback(() => {
    return () => setHasMarkedSeen(false);
  }, [])
);
```

**Acceptance Criteria:**
- [ ] `markAllAsSeen()` only called once per screen visit
- [ ] New matches still get marked as seen
- [ ] No regression in notification badge behavior

---

### Task 6: Batch Message Status Updates

**Impact:** Reduces 2 queries to 1 when opening chat

**Current Behavior:**
- `useMessageSubscription.ts:125-143` makes separate updates for:
  1. Messages to mark as read
  2. Messages to mark as delivered

**Files to Modify:**
- `apps/mobile/src/hooks/useMessageSubscription.ts`

**Implementation:**
```typescript
// Combine into single update operation
const markMessagesAsReadAndDelivered = async (messages: Message[]) => {
  const now = new Date().toISOString();
  const userId = useAuthStore.getState().user?.id;

  // Find messages that need updating
  const messagesToUpdate = messages.filter(
    m => m.user_id !== userId && (!m.read_at || !m.delivered_at)
  );

  if (messagesToUpdate.length === 0) return;

  const messageIds = messagesToUpdate.map(m => m.id);

  // Single update query
  await supabase
    .from("messages")
    .update({
      delivered_at: now,
      read_at: now
    })
    .in("id", messageIds)
    .is("read_at", null); // Only update unread
};
```

**Acceptance Criteria:**
- [ ] Single query updates both delivered_at and read_at
- [ ] Read receipts still work correctly
- [ ] No regression in message status display

---

### Task 7: Debounce Answer Gap Check

**Impact:** Reduces RPC calls during rapid swiping

**Current Behavior:**
- `swipe.tsx:171` checks answer gap on mount
- `swipe.tsx:228` checks again after EVERY swipe response

**Files to Modify:**
- `apps/mobile/app/(app)/swipe.tsx`

**Implementation:**
```typescript
// Add debounced version
const debouncedCheckAnswerGap = useMemo(
  () => debounce(checkAnswerGap, 2000), // 2 second debounce
  [checkAnswerGap]
);

// On response submit
const handleResponse = async (answer: Answer) => {
  await submitResponse(questionId, answer);

  // Debounced check - won't fire if user swipes again within 2s
  debouncedCheckAnswerGap();
};

// Cleanup on unmount
useEffect(() => {
  return () => debouncedCheckAnswerGap.cancel();
}, []);
```

**Acceptance Criteria:**
- [ ] Answer gap only checked after swiping pauses
- [ ] Still checks on initial mount
- [ ] Gap modal still appears when threshold exceeded

---

## Low Priority Tasks

### Task 8: Add Stale Time to Packs Store

**Impact:** Prevents unnecessary refetches of static data

**Files to Modify:**
- `apps/mobile/src/store/packsStore.ts`

**Implementation:**
```typescript
// Add to store state
packsLastFetched: number | null;

// In fetchPacks
fetchPacks: async () => {
  const STALE_TIME = 10 * 60 * 1000; // 10 minutes
  const { packsLastFetched, packs } = get();

  if (packs.length > 0 &&
      packsLastFetched &&
      Date.now() - packsLastFetched < STALE_TIME) {
    return; // Use cached data
  }

  // ... existing fetch logic
  set({ packs: data, packsLastFetched: Date.now() });
};

// Add force refresh for when user explicitly requests
fetchPacksForce: async () => {
  set({ packsLastFetched: null });
  return get().fetchPacks();
};
```

---

### Task 9: Persist Matches to AsyncStorage

**Impact:** Faster initial load, offline capability

**Files to Modify:**
- `apps/mobile/src/store/matchStore.ts`

**Implementation:**
```typescript
import AsyncStorage from "@react-native-async-storage/async-storage";
import { persist } from "zustand/middleware";

export const useMatchStore = create<MatchStore>()(
  persist(
    (set, get) => ({
      // ... existing store
    }),
    {
      name: "match-storage",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        matches: state.matches,
        // Don't persist loading states
      }),
    }
  )
);
```

---

### Task 10: Combine Couple + Partner Fetch

**Impact:** Reduces 2 queries to 1 in fetchCouple

**Current Behavior:**
- `authStore.ts:137-149` fetches couple, then partner separately

**Files to Modify:**
- `apps/mobile/src/store/authStore.ts`

**Implementation:**
```typescript
// Single query with join
const { data: coupleData } = await supabase
  .from("couples")
  .select(`
    *,
    profiles!inner(*)
  `)
  .eq("id", user.couple_id)
  .single();

const partner = coupleData.profiles.find(p => p.id !== user.id);
set({ couple: coupleData, partner });
```

---

## Implementation Order

| Priority | Task | Effort | Impact |
|----------|------|--------|--------|
| 1 | Task 1: Cache partner key | Low | High |
| 2 | Task 2: Store-based notifications | Low | High |
| 3 | Task 3: Remove polling | Low | Medium |
| 4 | Task 5: Fix mark as seen | Low | Medium |
| 5 | Task 6: Batch message updates | Low | Low |
| 6 | Task 7: Debounce gap check | Low | Low |
| 7 | Task 4: N+1 fix | Medium | Medium |
| 8 | Task 8: Packs stale time | Low | Low |
| 9 | Task 10: Combine couple fetch | Low | Low |
| 10 | Task 9: Persist matches | Medium | Low |

---

## Testing Checklist

After implementing optimizations:

- [ ] E2EE messaging still works (send/receive encrypted messages)
- [ ] Partner joining couple is detected in real-time
- [ ] Match notifications display correctly
- [ ] New matches appear and are marked as seen
- [ ] Message read receipts work
- [ ] Answer gap modal appears when appropriate
- [ ] Packs load and display correctly
- [ ] No increase in error rates (monitor logs)

---

## Metrics to Track

Before/after comparison:

1. **API calls per session** - Target: 40% reduction
2. **Time to interactive on home screen** - Target: <500ms
3. **Message send latency** - Target: No increase
4. **Battery usage** - Target: 20% reduction in background activity

---

## Notes

- All caching should have invalidation strategies
- Consider adding React Query or TanStack Query for more sophisticated caching
- Real-time subscriptions are preferred over polling
- Database views can simplify complex queries but add maintenance overhead
