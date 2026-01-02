# Mobile App Refactoring Tasks

Track progress by checking off completed items.

---

## Phase 1: Extract Shared Hooks

### 1.1 Ambient Orb Animation Hook
- [x] Create `src/hooks/useAmbientOrbAnimation.ts`
- [x] Extract animation logic from `app/(app)/swipe.tsx`
- [x] Update `app/(app)/swipe.tsx` to use hook
- [x] Update `app/(app)/chat/[id].tsx` to use hook
- [x] Update `app/(app)/matches.tsx` to use hook
- [x] Remove duplicate animation code from all files

### 1.2 Media Picker Hook
- [x] Create `src/hooks/useMediaPicker.ts`
- [x] Extract image picker logic from chat screen
- [x] Extract video picker logic from chat screen
- [x] Extract camera logic from chat screen
- [x] Update chat screen to use hook

### 1.3 Typing Indicator Hook
- [x] Create `src/hooks/useTypingIndicator.ts`
- [x] Extract broadcast channel logic from chat
- [x] Extract typing state management
- [x] Update chat screen to use hook

### 1.4 Message Subscription Hook
- [x] Create `src/hooks/useMessageSubscription.ts`
- [x] Extract real-time subscription logic
- [x] Extract message status update logic
- [x] Extract optimistic update logic
- [x] Update chat screen to use hook

---

## Phase 2: Shared UI Components

### 2.1 Decorative Separator
- [x] Create `src/components/ui/DecorativeSeparator.tsx`
- [x] Support rose, gold, and muted variants
- [x] Update `app/(app)/swipe.tsx` (4 instances)
- [x] Update `app/(app)/chat/[id].tsx` (2 instances)
- [x] Update `app/(app)/matches.tsx` (2 instances)
- [x] Remove duplicate separator styles

### 2.2 Loading Overlay
- [x] Create `src/components/ui/LoadingOverlay.tsx`
- [x] Support spinner, shimmer, and progress variants
- [x] Extract UploadingSkeleton from chat screen
- [x] Update usage across app

### 2.3 Read Receipt
- [x] Create `src/components/ui/ReadReceipt.tsx`
- [x] Support sent, delivered, read states
- [x] Update chat screen MessageMeta
- [x] Remove inline receipt logic

### 2.4 Ambient Orbs Component
- [x] Create `src/components/ui/AmbientOrbs.tsx`
- [x] Use `useAmbientOrbAnimation` hook
- [x] Support default, chat, premium variants
- [x] Update swipe screen to use component
- [x] Update chat screen to use component

---

## Phase 3: Split Zustand Store

### 3.1 Create Store Structure
- [x] Create `src/store/` directory structure
- [x] Create `src/store/authStore.ts`
- [x] Create `src/store/matchStore.ts`
- [x] Create `src/store/packsStore.ts`
- [x] Create `src/store/messageStore.ts`
- [x] Create `src/store/subscriptionStore.ts`

### 3.2 Migrate Stores
- [x] Move `useAuthStore` to `authStore.ts`
- [x] Move `useMatchStore` to `matchStore.ts`
- [x] Move `usePacksStore` to `packsStore.ts`
- [x] Move `useMessageStore` to `messageStore.ts`
- [x] Move `useSubscriptionStore` to `subscriptionStore.ts`

### 3.3 Update Exports
- [x] Update `src/store/index.ts` to re-export all stores
- [x] Verify all imports still work (type check passes)
- [x] Replace monolithic code with re-exports

---

## Phase 4: Decompose Chat Screen

### 4.1 Create Feature Structure
- [x] Create `src/features/chat/` directory
- [x] Create `src/features/chat/components/` directory
- [x] Create `src/features/chat/hooks/` directory
- [x] Create `src/features/chat/types.ts`

### 4.2 Extract Components
- [x] Extract `ChatHeader.tsx`
- [x] Extract `MessageContent.tsx`
- [x] Extract `ChatVideoPlayer.tsx`
- [x] Extract `MessageBubble.tsx`
- [x] Extract `TypingIndicator.tsx`
- [x] Extract `InputBar.tsx`
- [x] Extract `MediaMenu.tsx`
- [x] Extract `ChatMessages.tsx`
- [x] Extract `UploadProgress.tsx`
- [x] Extract `MessageMeta.tsx`

### 4.3 Extract Hooks
- [x] Create `useChatMessages.ts`
- [x] Create `useMediaUpload.ts`
- [x] Create `useVideoCache.ts`

### 4.4 Create Main Screen
- [x] Create `src/features/chat/ChatScreen.tsx`
- [x] Wire up all components and hooks
- [x] Create `src/features/chat/index.ts` exports
- [x] Update `app/(app)/chat/[id].tsx` to use feature

### 4.5 Cleanup
- [x] Remove old code from route file
- [x] Verify all functionality works
- [x] Test real-time messaging
- [x] Test media upload/download
- [x] Test video playback

---

## Phase 5: Decompose Profile Screen

### 5.1 Create Feature Structure
- [x] Create `src/features/profile/` directory
- [x] Create `src/features/profile/components/` directory
- [x] Create `src/features/profile/hooks/` directory

### 5.2 Extract Components
- [x] Extract `ProfileHeader.tsx`
- [x] Extract `CoupleStatus.tsx`
- [x] Extract `SettingsSection.tsx`
- [x] Extract `NotificationSettings.tsx`
- [x] Extract `PrivacySettings.tsx`
- [x] Extract `AppearanceSettings.tsx`

- [x] Extract `DangerZone.tsx`
- [x] Extract `SwitchItem.tsx`
- [x] Extract `MenuItem.tsx`

### 5.3 Extract Hooks
- [x] Create `useProfileSettings.ts`
- [x] Create `useCoupleManagement.ts`

### 5.4 Create Main Screen
- [x] Create `src/features/profile/ProfileScreen.tsx`
- [x] Create `src/features/profile/index.ts` exports
- [x] Update `app/(app)/profile.tsx` to use feature

---

## Phase 6: Component Organization

### 6.1 Reorganize Components
- [x] Create `src/components/feedback/` directory
- [x] Move `FeedbackModal.tsx` to feedback/
- [x] Move `QuestionFeedbackModal.tsx` to feedback/
- [x] Create `src/components/tutorials/` directory
- [x] Move `SwipeTutorial.tsx` to tutorials/
- [x] Move `MatchesTutorial.tsx` to tutorials/
- [x] Create `src/components/paywall/` directory
- [x] Move `Paywall.tsx` to paywall/
- [x] Create `src/components/swipe/` directory
- [x] Move `SwipeCard.native.tsx` to swipe/
- [x] Move `SwipeCard.web.tsx` to swipe/
- [x] Move `SwipeCardPremium.tsx` to swipe/

### 6.2 Update Imports
- [x] Update all imports for moved components
- [x] Create index.ts files for each directory
- [x] Verify no broken imports

---

## Phase 7: Testing Infrastructure

### 7.1 Setup
- [ ] Install testing dependencies (jest, testing-library)
- [ ] Configure jest for React Native
- [ ] Create test utilities and mocks

### 7.2 Hook Tests
- [ ] Test `useAmbientOrbAnimation`
- [ ] Test `useMediaPicker`
- [ ] Test `useTypingIndicator`
- [ ] Test `useMessageSubscription`
- [ ] Test `useChatMessages`
- [ ] Test `useMediaUpload`

### 7.3 Store Tests
- [ ] Test `authStore` actions
- [ ] Test `matchStore` actions
- [ ] Test `packsStore` actions
- [ ] Test `messageStore` actions
- [ ] Test `subscriptionStore` actions

### 7.4 Component Tests
- [ ] Test `DecorativeSeparator` variants
- [ ] Test `ReadReceipt` states
- [ ] Test `InputBar` interactions
- [ ] Test `MessageBubble` rendering

---

## Progress Summary

| Phase | Status | Completion |
|-------|--------|------------|
| 1. Shared Hooks | Complete | 100% |
| 2. Shared UI Components | Complete | 100% |
| 3. Split Store | Complete | 100% |
| 4. Decompose Chat | Complete | 100% |
| 5. Decompose Profile | Complete | 100% |
| 6. Component Organization | Complete | 100% |
| 7. Testing | Not Started | 0% |

---

## Notes

- Each phase can be completed independently
- Test after each component extraction
- Keep original files until phase is verified
- Follow DESIGN.md for any UI changes
- Do not modify tab bar background styling
