# Oversized File Inventory and Split Plan

Scope: source files (`.ts`, `.tsx`, `.js`, `.jsx`) with more than 400 lines. Binary assets, lockfiles, and generated artifacts are excluded because they are not refactor targets. Files under 300 lines are out of scope and will not be split unless a clear modularization need emerges later.

Method: `rg --files` + line count as of 2026-01-25.

Example split pattern: a 900-line screen becomes a screen container (`app/` route or `features/<feature>/<Screen>.tsx`) plus UI subcomponents (`features/<feature>/components`), hooks (`features/<feature>/hooks`), services (`features/<feature>/services`), and shared helpers (`utils`).

## Inventory (>= 401 lines)

| File | Lines | Target split plan (layers) |
| --- | --- | --- |
| `apps/mobile/app/(app)/swipe.tsx` | 1675 | Keep route as container; extract UI blocks to `apps/mobile/src/features/swipe/components`, screen logic to `apps/mobile/src/features/swipe/hooks`, data fetching/mutations to `apps/mobile/src/features/swipe/services`, shared helpers (formatting/animation config) to `apps/mobile/src/features/swipe/utils`. |
| `packages/shared/src/types/supabase.ts` | 1652 | Generated types: keep single source; if split is required, drive via codegen to `packages/shared/src/types/supabase/` with `utils` for shared type helpers and a barrel export (no hand edits). |
| `apps/mobile/src/types/supabase.ts` | 1586 | Generated types: keep single source; if split is required, mirror `types/supabase/` via codegen and re-export from the current path. |
| `apps/mobile/app/(app)/matches.tsx` | 1452 | Route becomes container; extract list/cards, empty state, filters to `features/matches/components`; match list logic to `features/matches/hooks`; fetch/update to `features/matches/services`; formatting helpers to `features/matches/utils`. |
| `apps/admin/src/pages/content/QuestionsPage.tsx` | 1144 | Page container only; move table, filters, bulk actions into `components`; query state, pagination, and selection logic into `hooks`; API calls into `services`; parsing/formatting into `utils`. |
| `apps/mobile/src/components/questions/QuestionCardAudio.tsx` | 1111 | Split UI into `QuestionAudioHeader`, `AudioControls`, `PlaybackTimeline` components; playback state to `hooks/useAudioPlayback`; upload/download logic to `services/audio`; formatting to `utils/audio`. |
| `apps/mobile/app/(app)/onboarding.tsx` | 1052 | Route container; onboarding steps into `features/onboarding/components`; step flow and state to `hooks/useOnboardingFlow`; data persistence to `services/onboarding`; shared copy/format to `utils`. |
| `apps/admin/src/pages/AiSettingsPage.tsx` | 972 | Page container; settings panels into `components`; form state and validation into `hooks`; API calls into `services`; mapping to/from form models in `utils`. |
| `apps/admin/src/pages/content/QuestionAnalyticsPage.tsx` | 947 | Page container; charts/tables into `components`; data fetching/filters into `hooks`; analytics API into `services`; data shaping into `utils`. |
| `apps/mobile/src/components/paywall/Paywall.tsx` | 886 | Split layout sections into `components/paywall/*`; purchase flow to `hooks/usePaywallPurchase`; revenue-cat API to `services/billing`; price formatting to `utils/billing`. |
| `apps/admin/src/components/content/ReviewQuestionsDialog.tsx` | 879 | Split dialog into `components/ReviewQuestions*` subcomponents; review state and actions into `hooks`; approval/reject API to `services/contentReview`; formatting to `utils`. |
| `apps/mobile/app/(auth)/login.tsx` | 870 | Route container; form fields and auth providers into `features/auth/components`; form state and validation into `features/auth/hooks`; auth API to `features/auth/services`; copy/format to `utils`. |
| `apps/mobile/src/features/chat/components/MatchCard.tsx` | 867 | Extract header, avatar row, and metadata into subcomponents; hooks for avatar load/status into `hooks`; data formatting helpers into `utils`. |
| `apps/admin/src/pages/FlaggedMessagesPage.tsx` | 842 | Page container; message table, filters, bulk actions into `components`; query state into `hooks`; API calls into `services/moderation`; data transforms into `utils`. |
| `apps/mobile/src/components/responses/EditResponseSheet.tsx` | 836 | Split sheet layout into subcomponents; state and validation into `hooks/useEditResponse`; save/update calls into `services/responses`; formatting helpers to `utils`. |
| `apps/mobile/app/pack/[id].tsx` | 811 | Route container; pack header, question list, CTA into `features/packs/components`; state into `features/packs/hooks`; data fetching into `features/packs/services`; formatting into `utils`. |
| `apps/admin/src/pages/activity/UserActivityPage.tsx` | 807 | Page container; activity timeline/table into `components`; filters into `hooks`; API calls into `services/activity`; data shaping into `utils`. |
| `apps/mobile/src/store/matchStore.ts` | 772 | Split store into `store/matchStore/state`, `store/matchStore/actions`, `store/matchStore/selectors`; move sorting/filtering helpers into `store/matchStore/utils`. |
| `apps/admin/src/pages/admins/AdminsPage.tsx` | 746 | Page container; admin list, invite dialog, role editor into `components`; form and table state into `hooks`; API calls into `services/admins`; formatting into `utils`. |
| `apps/admin/src/pages/users/UserDetailPage.tsx` | 715 | Page container; profile summary, activity, entitlements into `components`; data fetching into `hooks`; API calls into `services/users`; formatting into `utils`. |
| `apps/mobile/src/features/profile/components/DangerZone.tsx` | 714 | Split destructive actions into subcomponents; state and confirmations into `hooks/useDangerZoneActions`; account deletion calls into `services/account`; messaging helpers into `utils`. |
| `apps/mobile/src/components/ui/IntensitySlider.tsx` | 659 | Split slider track/thumb into subcomponents; interaction logic into `hooks/useIntensitySlider`; easing helpers into `utils/slider`. |
| `apps/admin/src/pages/content/PacksPage.tsx` | 633 | Page container; pack list, filters, edit dialog into `components`; state into `hooks`; API calls into `services/packs`; formatting into `utils`. |
| `apps/mobile/src/components/questions/QuestionCardPhoto.tsx` | 630 | Split UI into header/body/media subcomponents; media picker state to `hooks/useQuestionPhoto`; upload to `services/media`; formatting to `utils`. |
| `apps/admin/src/pages/users/MatchChatPage.tsx` | 627 | Page container; message list, chat header, metadata into `components`; data fetching into `hooks`; API calls into `services/chat`; formatting into `utils`. |
| `apps/mobile/app/(app)/_layout.tsx` | 625 | Keep route as container; extract tab bar, header config into `components/navigation`; navigation state into `hooks/useAppNavigation`; constants into `utils/navigation`. |
| `apps/admin/src/pages/DashboardPage.tsx` | 625 | Page container; metric cards, charts, tables into `components`; data fetching into `hooks`; API calls into `services/dashboard`; formatting into `utils`. |
| `apps/admin/src/pages/content/DarePacksPage.tsx` | 620 | Page container; list, filters, edit dialog into `components`; state into `hooks`; API calls into `services/darePacks`; formatting into `utils`. |
| `apps/admin/src/pages/content/CategoriesPage.tsx` | 614 | Page container; category list and editor into `components`; state into `hooks`; API calls into `services/categories`; formatting into `utils`. |
| `apps/mobile/src/features/profile/screens/SaveAccountScreen.tsx` | 590 | Screen container; sections into `features/profile/components`; state and validation into `features/profile/hooks`; API calls into `features/profile/services`; formatting to `utils`. |
| `apps/admin/src/pages/RedemptionCodesPage.tsx` | 574 | Page container; codes table, filters, generate dialog into `components`; state into `hooks`; API calls into `services/redemptions`; formatting into `utils`. |
| `apps/mobile/src/features/profile/components/RelationshipDangerZone.tsx` | 571 | Split destructive actions into subcomponents; confirmations into `hooks/useRelationshipDangerZone`; API calls into `services/relationship`; messaging helpers into `utils`. |
| `apps/mobile/src/components/tutorials/MatchesTutorial.tsx` | 569 | Split slide components into `components/tutorials/Matches*`; step state into `hooks/useTutorialSteps`; analytics to `services/tutorials`; formatting to `utils`. |
| `apps/mobile/app/(app)/pairing.tsx` | 562 | Route container; pairing steps into `features/pairing/components`; flow state into `features/pairing/hooks`; API calls into `features/pairing/services`; formatting into `utils`. |
| `apps/mobile/app/(app)/my-answers.tsx` | 557 | Route container; answer list, filters into `features/answers/components`; state into `features/answers/hooks`; API calls into `features/answers/services`; formatting into `utils`. |
| `apps/mobile/src/components/feedback/FeedbackModal.tsx` | 550 | Split modal sections into subcomponents; form state into `hooks/useFeedbackForm`; submission into `services/feedback`; formatting into `utils`. |
| `apps/mobile/src/components/MatchNotificationModal.tsx` | 528 | Split header/body/actions into subcomponents; state into `hooks/useMatchNotification`; API calls into `services/matches`; formatting into `utils`. |
| `apps/mobile/src/components/share/SharePreviewModal.tsx` | 522 | Split preview card and actions into subcomponents; share state into `hooks/useSharePreview`; share API into `services/share`; formatting into `utils`. |
| `apps/admin/src/pages/content/DaresPage.tsx` | 521 | Page container; list, filters, edit dialog into `components`; state into `hooks`; API calls into `services/dares`; formatting into `utils`. |
| `apps/mobile/src/components/PackTeaser.tsx` | 510 | Split teaser layout into subcomponents; state into `hooks/usePackTeaser`; API calls into `services/packs`; formatting into `utils`. |
| `apps/mobile/src/__tests__/stores/responsesStore.test.ts` | 499 | Split test cases by feature into `__tests__/stores/responsesStore.*.test.ts`; shared fixtures/helpers into `__tests__/stores/utils`. |
| `apps/mobile/src/components/questions/QuestionCardText.tsx` | 496 | Split header/body/actions into subcomponents; input state into `hooks/useQuestionText`; validation into `utils`; submission to `services/responses`. |
| `apps/admin/src/pages/FeedbackPage.tsx` | 495 | Page container; table, filters, detail panel into `components`; state into `hooks`; API calls into `services/feedback`; formatting into `utils`. |
| `apps/mobile/src/__tests__/stores/matchStore.test.ts` | 485 | Split test cases by behavior into `__tests__/stores/matchStore.*.test.ts`; shared fixtures/helpers into `__tests__/stores/utils`. |
| `apps/mobile/src/components/questions/QuestionCardWhoLikely.tsx` | 478 | Split header/body/actions into subcomponents; selection state into `hooks/useQuestionWhoLikely`; analytics into `services/responses`; formatting to `utils`. |
| `apps/mobile/src/features/chat/ChatScreen.tsx` | 465 | Further split into container + `components` (message list, input, header) and `hooks` (message subscription, media upload) with data calls in `services/chat` and formatting in `utils/chat`. |
| `apps/admin/src/pages/content/TagsPage.tsx` | 459 | Page container; list and editor into `components`; state into `hooks`; API calls into `services/tags`; formatting into `utils`. |
| `apps/mobile/src/components/questions/QuestionCard.tsx` | 452 | Keep as base card; move option renderers to `components/questions/QuestionCard*`; move shared helpers to `hooks/useQuestionCard` and `utils/questionCard`. |
| `apps/mobile/src/features/profile/screens/ProfileSettingsScreen.tsx` | 442 | Screen container; settings sections into `features/profile/components`; state into `features/profile/hooks`; API calls into `features/profile/services`; formatting into `utils`. |
| `apps/supabase/functions/classify-message/index.ts` | 420 | Split handler into `services/classifyMessage` (Supabase edge logic), `utils/textNormalization`, and `utils/featureFlags`; keep `index.ts` as entrypoint. |
| `apps/admin/src/components/layout/Sidebar.tsx` | 406 | Split nav sections into subcomponents; state into `hooks/useSidebarState`; route config into `utils/navigation`. |

## Notes

- Large binary assets and lockfiles exceed 400 lines by file encoding; they are excluded because they are not refactor candidates.
- No files under 300 lines are scheduled for splitting at this stage.
