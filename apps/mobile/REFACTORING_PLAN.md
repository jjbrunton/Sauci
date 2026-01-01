# Mobile App Refactoring Plan

A systematic plan to improve code maintainability, reduce duplication, and establish patterns for long-term scalability.

---

## Executive Summary

| Metric | Current | Target |
|--------|---------|--------|
| Largest file (chat) | 2,213 lines | <400 lines per file |
| Store file | 666 lines (5 stores) | ~150 lines per store |
| Animation duplication | 3+ files | 1 shared hook |
| UI component duplication | 6+ instances | Shared components |

---

## Phase 1: Extract Shared Hooks (Low Risk, High Impact)

**Goal:** Eliminate animation and logic duplication across the app.

### 1.1 Create `useAmbientOrbAnimation` Hook

**Files affected:**
- `app/(app)/swipe.tsx` (lines 41-85)
- `app/(app)/chat/[id].tsx` (lines 70-122)
- `src/components/SwipeCard.native.tsx` (lines 60-70)

**New file:** `src/hooks/useAmbientOrbAnimation.ts`

```typescript
import { useEffect } from 'react';
import { useSharedValue, withRepeat, withSequence, withTiming, useAnimatedStyle } from 'react-native-reanimated';

interface AmbientOrbConfig {
  color1?: string;
  color2?: string;
  size?: number;
  opacity?: number;
}

export const useAmbientOrbAnimation = (config?: AmbientOrbConfig) => {
  const orbBreathing1 = useSharedValue(0);
  const orbBreathing2 = useSharedValue(0);
  const orbDrift1X = useSharedValue(0);
  const orbDrift1Y = useSharedValue(0);
  const orbDrift2X = useSharedValue(0);
  const orbDrift2Y = useSharedValue(0);

  useEffect(() => {
    // Breathing animations
    orbBreathing1.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 3000 }),
        withTiming(0, { duration: 3000 })
      ),
      -1,
      true
    );
    // ... rest of animation setup
  }, []);

  const orbStyle1 = useAnimatedStyle(() => ({
    // ... transform and opacity logic
  }));

  const orbStyle2 = useAnimatedStyle(() => ({
    // ... transform and opacity logic
  }));

  return { orbStyle1, orbStyle2 };
};
```

### 1.2 Create `useMediaPicker` Hook

**Extract from:** `app/(app)/chat/[id].tsx` (lines 296-380)

**New file:** `src/hooks/useMediaPicker.ts`

```typescript
interface MediaPickerOptions {
  allowsVideo?: boolean;
  maxDuration?: number;
  quality?: number;
  onSelect: (uri: string, type: 'image' | 'video') => void;
  onError?: (error: Error) => void;
}

export const useMediaPicker = (options: MediaPickerOptions) => {
  const pickImage = async () => { /* ... */ };
  const takePhoto = async () => { /* ... */ };
  const pickVideo = async () => { /* ... */ };
  const recordVideo = async () => { /* ... */ };

  return { pickImage, takePhoto, pickVideo, recordVideo };
};
```

### 1.3 Create `useTypingIndicator` Hook

**Extract from:** `app/(app)/chat/[id].tsx` (lines 200-260)

**New file:** `src/hooks/useTypingIndicator.ts`

```typescript
export const useTypingIndicator = (matchId: string, userId: string) => {
  const [isPartnerTyping, setIsPartnerTyping] = useState(false);

  const sendTypingStatus = useCallback((isTyping: boolean) => { /* ... */ }, []);

  // Subscribe to typing channel
  useEffect(() => { /* ... */ }, [matchId]);

  return { isPartnerTyping, sendTypingStatus };
};
```

### 1.4 Create `useMessageSubscription` Hook

**Extract from:** `app/(app)/chat/[id].tsx` (lines 450-550)

**New file:** `src/hooks/useMessageSubscription.ts`

```typescript
export const useMessageSubscription = (matchId: string, userId: string) => {
  const [messages, setMessages] = useState<Message[]>([]);

  // Real-time subscription
  // Message status updates
  // Optimistic updates

  return { messages, sendMessage, markAsRead };
};
```

---

## Phase 2: Create Shared UI Components (Low Risk, Medium Impact)

**Goal:** Extract repeated UI patterns into reusable components.

### 2.1 Create `DecorativeSeparator` Component

**Duplicate instances found in:**
- `app/(app)/swipe.tsx` (6+ instances)
- `app/(app)/chat/[id].tsx` (lines 648-652)
- `src/components/SwipeTutorial.tsx`

**New file:** `src/components/ui/DecorativeSeparator.tsx`

```typescript
interface DecorativeSeparatorProps {
  variant?: 'diamond' | 'dot' | 'line';
  color?: string;
  width?: number | string;
}

export const DecorativeSeparator: React.FC<DecorativeSeparatorProps> = ({
  variant = 'diamond',
  color = theme.colors.glass.border,
  width = '60%',
}) => (
  <View style={[styles.container, { width }]}>
    <View style={[styles.line, { backgroundColor: color }]} />
    {variant === 'diamond' && <View style={[styles.diamond, { backgroundColor: color }]} />}
    {variant === 'dot' && <View style={[styles.dot, { backgroundColor: color }]} />}
    <View style={[styles.line, { backgroundColor: color }]} />
  </View>
);
```

### 2.2 Create `LoadingOverlay` Component

**Similar patterns in:**
- `app/(app)/chat/[id].tsx` (UploadingSkeleton)
- `src/components/Paywall.tsx`
- Various loading states

**New file:** `src/components/ui/LoadingOverlay.tsx`

```typescript
interface LoadingOverlayProps {
  visible: boolean;
  message?: string;
  progress?: number;
  variant?: 'spinner' | 'shimmer' | 'progress';
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ ... });
```

### 2.3 Create `ReadReceipt` Component

**Extract from:** `app/(app)/chat/[id].tsx` (lines 1354-1365)

**New file:** `src/components/ui/ReadReceipt.tsx`

```typescript
type ReceiptStatus = 'sent' | 'delivered' | 'read';

interface ReadReceiptProps {
  status: ReceiptStatus;
  size?: number;
}

export const ReadReceipt: React.FC<ReadReceiptProps> = ({ status, size = 14 }) => {
  const icon = status === 'read' ? 'checkmark-done' : status === 'delivered' ? 'checkmark-done' : 'checkmark';
  const color = status === 'read' ? theme.colors.primary : theme.colors.text.secondary;

  return <Ionicons name={icon} size={size} color={color} />;
};
```

### 2.4 Create `AmbientOrbs` Component

**New file:** `src/components/ui/AmbientOrbs.tsx`

```typescript
interface AmbientOrbsProps {
  variant?: 'default' | 'chat' | 'premium';
}

export const AmbientOrbs: React.FC<AmbientOrbsProps> = ({ variant = 'default' }) => {
  const { orbStyle1, orbStyle2 } = useAmbientOrbAnimation();

  return (
    <>
      <Animated.View style={[styles.orb1, orbStyle1]} />
      <Animated.View style={[styles.orb2, orbStyle2]} />
    </>
  );
};
```

---

## Phase 3: Split the Zustand Store (Medium Risk, High Impact)

**Goal:** Improve maintainability by splitting the monolithic store into domain-specific modules.

### Current Structure (666 lines, 1 file)
```
src/store/index.ts
├── useAuthStore
├── useMatchStore
├── usePacksStore
├── useMessageStore
└── useSubscriptionStore
```

### Target Structure (5 files, ~100-150 lines each)
```
src/store/
├── index.ts              # Re-exports all stores
├── authStore.ts          # Auth, user, couple, partner
├── matchStore.ts         # Matches, sorting, filtering
├── packsStore.ts         # Question packs, enabled packs
├── messageStore.ts       # Messages, unread counts
└── subscriptionStore.ts  # RevenueCat, offerings, purchases
```

### Implementation Steps

1. **Create store directory structure**
2. **Move `useAuthStore` to `authStore.ts`**
   - Keep auth refresh logic isolated
   - Export type definitions
3. **Move `useMatchStore` to `matchStore.ts`**
4. **Move `usePacksStore` to `packsStore.ts`**
5. **Move `useMessageStore` to `messageStore.ts`**
6. **Move `useSubscriptionStore` to `subscriptionStore.ts`**
7. **Update `index.ts` to re-export all stores**

```typescript
// src/store/index.ts
export { useAuthStore } from './authStore';
export { useMatchStore } from './matchStore';
export { usePacksStore } from './packsStore';
export { useMessageStore } from './messageStore';
export { useSubscriptionStore } from './subscriptionStore';
```

**Import changes:** None required - all imports from `@/store` will continue to work.

---

## Phase 4: Decompose Chat Screen (Medium Risk, Highest Impact)

**Goal:** Break the 2,213-line chat screen into maintainable, testable components.

### Current Structure
```
app/(app)/chat/[id].tsx (2,213 lines)
├── Animations (lines 70-122)
├── State management (lines 130-200)
├── Typing indicator logic (lines 200-260)
├── Media handling (lines 296-450)
├── Message subscription (lines 450-550)
├── UI Components (inline)
│   ├── MessageContent
│   ├── ChatVideoPlayer
│   ├── MessageMeta
│   ├── InputBar
│   └── UploadingSkeleton
└── Main render (lines 600-2213)
```

### Target Structure
```
src/features/chat/
├── index.ts                    # Public exports
├── ChatScreen.tsx              # Main screen (orchestration only, <400 lines)
├── components/
│   ├── ChatHeader.tsx          # Header with match info
│   ├── ChatMessages.tsx        # Message list + scroll logic
│   ├── MessageBubble.tsx       # Single message rendering
│   ├── MessageContent.tsx      # Text/image/video content
│   ├── ChatVideoPlayer.tsx     # Video player with controls
│   ├── InputBar.tsx            # Text input + media buttons
│   ├── MediaMenu.tsx           # Expandable media picker
│   ├── TypingIndicator.tsx     # Animated typing dots
│   └── UploadProgress.tsx      # Upload skeleton/progress
├── hooks/
│   ├── useChatMessages.ts      # Message fetching & subscription
│   ├── useTypingIndicator.ts   # Typing broadcast channel
│   ├── useMediaUpload.ts       # Image/video compression & upload
│   └── useVideoCache.ts        # Video download & caching
└── types.ts                    # Chat-specific types
```

### Implementation Steps

#### Step 1: Create Feature Directory
```bash
mkdir -p src/features/chat/components
mkdir -p src/features/chat/hooks
```

#### Step 2: Extract Components (in order of dependency)

**2a. Extract `MessageContent.tsx`**
- Lines 680-800 from current file
- Handles text, image, video rendering
- Props: `{ message, onImagePress, onVideoPress }`

**2b. Extract `ChatVideoPlayer.tsx`**
- Lines 740-800 from current file
- Custom video player with controls
- Props: `{ uri, onClose, visible }`

**2c. Extract `MessageBubble.tsx`**
- Lines 640-900 from current file
- Single message with content + meta
- Props: `{ message, isOwn, onMediaPress }`

**2d. Extract `TypingIndicator.tsx`**
- Lines 870-910 from current file
- Animated typing dots
- Props: `{ visible }`

**2e. Extract `InputBar.tsx`**
- Lines 1380-1510 from current file
- Text input + send button + media toggle
- Props: `{ onSend, onMediaSelect, disabled }`

**2f. Extract `MediaMenu.tsx`**
- Lines 1510-1600 from current file
- Expandable media picker buttons
- Props: `{ visible, onSelect, onClose }`

**2g. Extract `ChatHeader.tsx`**
- Lines 600-640 from current file
- Match card + question display
- Props: `{ match, onBack }`

**2h. Extract `ChatMessages.tsx`**
- Lines 1600-1800 from current file
- FlatList with message rendering
- Props: `{ messages, userId, onMediaPress }`

#### Step 3: Extract Hooks

**3a. Create `useChatMessages.ts`**
```typescript
export const useChatMessages = (matchId: string) => {
  // Fetch initial messages
  // Subscribe to new messages
  // Handle optimistic updates
  // Mark messages as read
  return { messages, sendMessage, loading, error };
};
```

**3b. Create `useMediaUpload.ts`**
```typescript
export const useMediaUpload = (matchId: string) => {
  // Compress image/video
  // Upload to storage
  // Track progress
  return { upload, progress, uploading };
};
```

#### Step 4: Create Main Screen
```typescript
// src/features/chat/ChatScreen.tsx (~300-400 lines)
export const ChatScreen: React.FC = () => {
  const { id } = useLocalSearchParams();
  const { messages, sendMessage } = useChatMessages(id);
  const { isPartnerTyping, sendTypingStatus } = useTypingIndicator(id);
  const { upload, progress } = useMediaUpload(id);

  return (
    <View style={styles.container}>
      <AmbientOrbs variant="chat" />
      <ChatHeader match={match} onBack={router.back} />
      <ChatMessages messages={messages} userId={userId} />
      {isPartnerTyping && <TypingIndicator />}
      <InputBar onSend={sendMessage} onMediaSelect={upload} />
    </View>
  );
};
```

#### Step 5: Update Route File
```typescript
// app/(app)/chat/[id].tsx
export { ChatScreen as default } from '@/features/chat';
```

---

## Phase 5: Decompose Profile Screen (Medium Risk, High Impact)

**Goal:** Break the 1,703-line profile screen into manageable sections.

### Target Structure
```
src/features/profile/
├── index.ts
├── ProfileScreen.tsx           # Main orchestration (<400 lines)
├── components/
│   ├── ProfileHeader.tsx       # Avatar, name, edit
│   ├── CoupleStatus.tsx        # Partner info, invite code
│   ├── SettingsSection.tsx     # Generic settings group
│   ├── NotificationSettings.tsx
│   ├── PrivacySettings.tsx
│   ├── AppearanceSettings.tsx
│   └── DangerZone.tsx          # Delete account, leave couple
└── hooks/
    ├── useProfileSettings.ts
    └── useCoupleManagement.ts
```

---

## Phase 6: Improve Component Organization (Low Risk)

**Goal:** Establish clear component categories and naming conventions.

### Current Structure
```
src/components/
├── ui/                    # Primitive UI components
├── [Feature].tsx          # Mixed feature components
└── [Tutorial].tsx         # Tutorial components
```

### Target Structure
```
src/components/
├── ui/                    # Primitive UI (buttons, cards, inputs)
│   ├── GlassButton.tsx
│   ├── GlassCard.tsx
│   ├── GlassInput.tsx
│   ├── DecorativeSeparator.tsx
│   ├── LoadingOverlay.tsx
│   ├── ReadReceipt.tsx
│   ├── AmbientOrbs.tsx
│   └── ShimmerEffect.tsx
├── feedback/              # User feedback components
│   ├── FeedbackModal.tsx
│   └── QuestionFeedbackModal.tsx
├── tutorials/             # Onboarding tutorials
│   ├── SwipeTutorial.tsx
│   └── MatchesTutorial.tsx
├── paywall/               # Subscription components
│   ├── Paywall.tsx
│   └── PremiumBadge.tsx
└── swipe/                 # Swipe card variants
    ├── SwipeCard.native.tsx
    ├── SwipeCard.web.tsx
    └── SwipeCardPremium.tsx
```

---

## Phase 7: Add Testing Infrastructure (Long-term)

**Goal:** Enable confident refactoring with test coverage.

### Recommended Test Structure
```
src/
├── __tests__/
│   ├── components/
│   ├── hooks/
│   ├── stores/
│   └── utils/
└── features/
    └── chat/
        └── __tests__/
            ├── ChatMessages.test.tsx
            └── useChatMessages.test.ts
```

### Testing Priorities
1. **Hooks** - Pure logic, easy to test
2. **Store actions** - Critical business logic
3. **Utility functions** - Edge cases
4. **Components** - Snapshot + interaction tests

---

## Implementation Order

| Phase | Risk | Impact | Effort | Priority |
|-------|------|--------|--------|----------|
| 1. Shared Hooks | Low | High | 2-3 days | 1 |
| 2. Shared UI Components | Low | Medium | 1-2 days | 2 |
| 3. Split Store | Medium | High | 1 day | 3 |
| 4. Decompose Chat | Medium | Highest | 3-5 days | 4 |
| 5. Decompose Profile | Medium | High | 2-3 days | 5 |
| 6. Component Organization | Low | Low | 1 day | 6 |
| 7. Testing | Low | High | Ongoing | 7 |

---

## Migration Strategy

### For Each Phase:
1. **Create new files** without modifying existing code
2. **Import and use** new components/hooks in the target file
3. **Verify functionality** works identically
4. **Remove old code** from the original file
5. **Update imports** across the codebase if needed

### Rollback Strategy:
- Each phase can be rolled back independently
- Keep original files until phase is complete
- Use feature flags for large changes if needed

---

## Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Max lines per file | 2,213 | <500 |
| Duplicate animation code | 3 files | 1 hook |
| Store files | 1 (666 lines) | 5 (~130 lines each) |
| Test coverage | 0% | >50% for hooks/stores |
| Component reuse | Low | High (shared UI components) |

---

## Notes

- **Do not change** the tab bar background styling (see CLAUDE.md)
- **Follow** DESIGN.md for all UI changes
- **Use** theme imports, never hardcode colors
- **Preserve** all existing functionality during refactoring
