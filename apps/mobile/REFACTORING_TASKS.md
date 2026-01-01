# Mobile App Refactoring Tasks

Track progress by checking off completed items.

---

## Phase 1: Extract Shared Hooks

### 1.1 Ambient Orb Animation Hook
- [ ] Create `src/hooks/useAmbientOrbAnimation.ts`
- [ ] Extract animation logic from `app/(app)/swipe.tsx`
- [ ] Update `app/(app)/swipe.tsx` to use hook
- [ ] Update `app/(app)/chat/[id].tsx` to use hook
- [ ] Update `src/components/SwipeCard.native.tsx` to use hook
- [ ] Remove duplicate animation code from all files

### 1.2 Media Picker Hook
- [ ] Create `src/hooks/useMediaPicker.ts`
- [ ] Extract image picker logic from chat screen
- [ ] Extract video picker logic from chat screen
- [ ] Extract camera logic from chat screen
- [ ] Update chat screen to use hook

### 1.3 Typing Indicator Hook
- [ ] Create `src/hooks/useTypingIndicator.ts`
- [ ] Extract broadcast channel logic from chat
- [ ] Extract typing state management
- [ ] Update chat screen to use hook

### 1.4 Message Subscription Hook
- [ ] Create `src/hooks/useMessageSubscription.ts`
- [ ] Extract real-time subscription logic
- [ ] Extract message status update logic
- [ ] Extract optimistic update logic
- [ ] Update chat screen to use hook

---

## Phase 2: Shared UI Components

### 2.1 Decorative Separator
- [ ] Create `src/components/ui/DecorativeSeparator.tsx`
- [ ] Support diamond, dot, and line variants
- [ ] Update `app/(app)/swipe.tsx` (6+ instances)
- [ ] Update `app/(app)/chat/[id].tsx`
- [ ] Update `src/components/SwipeTutorial.tsx`
- [ ] Remove duplicate separator styles

### 2.2 Loading Overlay
- [ ] Create `src/components/ui/LoadingOverlay.tsx`
- [ ] Support spinner, shimmer, and progress variants
- [ ] Extract UploadingSkeleton from chat screen
- [ ] Update usage across app

### 2.3 Read Receipt
- [ ] Create `src/components/ui/ReadReceipt.tsx`
- [ ] Support sent, delivered, read states
- [ ] Update chat screen MessageMeta
- [ ] Remove inline receipt logic

### 2.4 Ambient Orbs Component
- [ ] Create `src/components/ui/AmbientOrbs.tsx`
- [ ] Use `useAmbientOrbAnimation` hook
- [ ] Support default, chat, premium variants
- [ ] Update swipe screen to use component
- [ ] Update chat screen to use component

---

## Phase 3: Split Zustand Store

### 3.1 Create Store Structure
- [ ] Create `src/store/` directory structure
- [ ] Create `src/store/authStore.ts`
- [ ] Create `src/store/matchStore.ts`
- [ ] Create `src/store/packsStore.ts`
- [ ] Create `src/store/messageStore.ts`
- [ ] Create `src/store/subscriptionStore.ts`

### 3.2 Migrate Stores
- [ ] Move `useAuthStore` to `authStore.ts`
- [ ] Move `useMatchStore` to `matchStore.ts`
- [ ] Move `usePacksStore` to `packsStore.ts`
- [ ] Move `useMessageStore` to `messageStore.ts`
- [ ] Move `useSubscriptionStore` to `subscriptionStore.ts`

### 3.3 Update Exports
- [ ] Update `src/store/index.ts` to re-export all stores
- [ ] Verify all imports still work
- [ ] Delete old monolithic code from index.ts

---

## Phase 4: Decompose Chat Screen

### 4.1 Create Feature Structure
- [ ] Create `src/features/chat/` directory
- [ ] Create `src/features/chat/components/` directory
- [ ] Create `src/features/chat/hooks/` directory
- [ ] Create `src/features/chat/types.ts`

### 4.2 Extract Components
- [ ] Extract `ChatHeader.tsx`
- [ ] Extract `MessageContent.tsx`
- [ ] Extract `ChatVideoPlayer.tsx`
- [ ] Extract `MessageBubble.tsx`
- [ ] Extract `TypingIndicator.tsx`
- [ ] Extract `InputBar.tsx`
- [ ] Extract `MediaMenu.tsx`
- [ ] Extract `ChatMessages.tsx`
- [ ] Extract `UploadProgress.tsx`

### 4.3 Extract Hooks
- [ ] Create `useChatMessages.ts`
- [ ] Create `useMediaUpload.ts`
- [ ] Create `useVideoCache.ts`

### 4.4 Create Main Screen
- [ ] Create `src/features/chat/ChatScreen.tsx`
- [ ] Wire up all components and hooks
- [ ] Create `src/features/chat/index.ts` exports
- [ ] Update `app/(app)/chat/[id].tsx` to use feature

### 4.5 Cleanup
- [ ] Remove old code from route file
- [ ] Verify all functionality works
- [ ] Test real-time messaging
- [ ] Test media upload/download
- [ ] Test video playback

---

## Phase 5: Decompose Profile Screen

### 5.1 Create Feature Structure
- [ ] Create `src/features/profile/` directory
- [ ] Create `src/features/profile/components/` directory
- [ ] Create `src/features/profile/hooks/` directory

### 5.2 Extract Components
- [ ] Extract `ProfileHeader.tsx`
- [ ] Extract `CoupleStatus.tsx`
- [ ] Extract `SettingsSection.tsx`
- [ ] Extract `NotificationSettings.tsx`
- [ ] Extract `PrivacySettings.tsx`
- [ ] Extract `AppearanceSettings.tsx`
- [ ] Extract `DangerZone.tsx`

### 5.3 Extract Hooks
- [ ] Create `useProfileSettings.ts`
- [ ] Create `useCoupleManagement.ts`

### 5.4 Create Main Screen
- [ ] Create `src/features/profile/ProfileScreen.tsx`
- [ ] Create `src/features/profile/index.ts` exports
- [ ] Update `app/(app)/profile.tsx` to use feature

---

## Phase 6: Component Organization

### 6.1 Reorganize Components
- [ ] Create `src/components/feedback/` directory
- [ ] Move `FeedbackModal.tsx` to feedback/
- [ ] Move `QuestionFeedbackModal.tsx` to feedback/
- [ ] Create `src/components/tutorials/` directory
- [ ] Move `SwipeTutorial.tsx` to tutorials/
- [ ] Move `MatchesTutorial.tsx` to tutorials/
- [ ] Create `src/components/paywall/` directory
- [ ] Move `Paywall.tsx` to paywall/
- [ ] Create `src/components/swipe/` directory
- [ ] Move `SwipeCard.native.tsx` to swipe/
- [ ] Move `SwipeCard.web.tsx` to swipe/
- [ ] Move `SwipeCardPremium.tsx` to swipe/

### 6.2 Update Imports
- [ ] Update all imports for moved components
- [ ] Create index.ts files for each directory
- [ ] Verify no broken imports

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
| 1. Shared Hooks | Not Started | 0% |
| 2. Shared UI Components | Not Started | 0% |
| 3. Split Store | Not Started | 0% |
| 4. Decompose Chat | Not Started | 0% |
| 5. Decompose Profile | Not Started | 0% |
| 6. Component Organization | Not Started | 0% |
| 7. Testing | Not Started | 0% |

---

## Notes

- Each phase can be completed independently
- Test after each component extraction
- Keep original files until phase is verified
- Follow DESIGN.md for any UI changes
- Do not modify tab bar background styling
