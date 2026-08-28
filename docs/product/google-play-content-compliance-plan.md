# Google Play content compliance implementation plan

Status: proposed implementation plan; no production changes have been made.

## 1. Outcome and non-negotiable invariants

Sauci keeps its core compatibility mechanic: each partner privately answers the
same preference or boundary prompt and Sauci reveals agreement. The Google Play
build must not supply explicit sexual acts, sexual instructions, fetish content,
or other developer-authored material intended for sexual gratification.

The implementation is complete only when all of these are true:

1. Google Play clients can receive only content explicitly reviewed as allowed.
2. `unreviewed` is treated exactly like `blocked` for Google Play.
3. A pack, its category, and the individual question must all be allowed before
   the question can be returned.
4. `is_explicit`, intensity, premium access, and `hide_nsfw` remain product
   controls; none of them can override the Google Play boundary.
5. Missing, invalid, old, or unknown client-distribution metadata resolves to
   the Google Play-safe policy.
6. Filtering applies to catalogue browsing, swipe selection, direct links,
   pending questions, answers, matches, chat headers, progress, search, counts,
   realtime payloads, notification destinations, and write endpoints.
7. Historical responses and matches are retained. They are not disclosed in a
   Google Play response when their source content is blocked.
8. New developer-authored content defaults to `unreviewed` and cannot reach the
   Google Play build until a recorded review allows it.
9. iOS may retain the broader catalogue through the API; legacy direct database
   access is always restricted to the safe catalogue.
10. Couple isolation, premium rules, role checks, and RLS remain enforced.

This is a distribution policy, not an age gate. An 18+ confirmation or content
toggle does not make otherwise prohibited developer-authored content eligible.

## 2. Content model

### 2.1 Classification used by engineering

Each category, question pack, question, dare pack, and dare has a Google Play
review status:

| Status | Google Play behaviour | Meaning |
|---|---|---|
| `unreviewed` | hidden and non-actionable | no affirmative decision exists |
| `allowed` | eligible, subject to parent visibility and access rules | manually reviewed against the Play policy |
| `blocked` | hidden and non-actionable | explicit, sexual-gratification, fetish, instructional, or otherwise unsuitable |

An allowed question should describe a non-graphic preference, relationship
dynamic, comfort level, romantic interest, or boundary. It must not name or
instruct a sexual act, explicit anatomy, sex toy use, nudity as stimulation,
public sexual activity, or coercive/predatory scenario.

Examples of the intended retained mechanic:

- "Would you enjoy taking the lead more often?"
- "Would you like your partner to surprise you with a private date idea?"
- "Are you curious about exploring a new dynamic together?"
- "Would you be comfortable sharing a fantasy in your own words?"

The last example lets the users supply the final detail. The app must present it
as private couple communication, not solicit a named sexual act or provide an
explicit example. User-authored fields still need reporting/blocking, terms,
rate limits, and safe notification previews.

### 2.2 Initial catalogue decision

The first production review is ID-based, not keyword-based. Keyword scans can
queue content for review but must never auto-allow it.

Immediately block the exact questions shown in the rejection evidence and all
developer-authored explicit acts/instructions. Use a conservative first pass:

- Block whole packs pending line review: All Eyes On Us, Boundary Discovery,
  Dare to Play, Deep in Character, Dream Scenarios, Fantasy Scenarios, Intimate
  Games, Kink Discovery, Know Your Limits, Leveling Up Together, Pleasure
  Experiments, Position Exploration, Private Line, Pushing Limits, Role Play
  Ideas, Secret Desires, Sensory Play, Sensual Touch, Starting Out, Tease &
  Tension, The Deep End, and Total Control.
- Line-review the apparently safer relationship packs before allowing them;
  benign pack names do not prove every contained question is safe.
- Line-review mixed packs individually: Missing You, Testing the Waters,
  Romantic Gestures, First Impressions, Body Mapping, Love Notes, Sensual
  Massage, and Date Night Sparks.
- Treat every dare and dare pack as `unreviewed` until the Android dare feature
  is separately reviewed. The current coming-soon copy must also be rewritten
  to neutral relationship language.

Do not delete or rewrite the iOS catalogue in place. Classification separates
distribution while preserving subscriptions, IDs, responses, and match history.

## 3. Database changes

Create one canonical Supabase migration with:

```sh
npm run db:migration:new -- add_google_play_content_policy
```

The migration lives only in `apps/supabase/migrations/`. The untracked Drizzle
work under `apps/api/drizzle/` must not become an independent schema authority;
update `apps/api/src/db/schema.ts` to mirror the canonical schema after the
Supabase migration exists.

There is a repository-level sequencing conflict to resolve in the implementation
PR: the root `AGENTS.md` makes Supabase migrations canonical, while the current
uncommitted `docs/architecture/backend-migration.md` describes API-owned
standalone PostgreSQL migrations. This plan follows the root instruction. Update
the architecture decision before changing that ownership rule; do not quietly
create the compliance schema twice with divergent migrations.

The compliance fields must exist in whichever database is authoritative at the
time of release. If the standalone-backend migration has not cut over, enforce
them in production Supabase first and carry the values through the controlled
data migration. If the standalone backend cuts over first, import and verify the
same statuses there and leave legacy Supabase fail-closed/read-only. Never let
old clients write Supabase while new clients write a standalone database; that
would split responses and matches between two sources of truth.

### 3.1 Types and columns

Add:

```sql
create type google_play_review_status as enum
  ('unreviewed', 'allowed', 'blocked');

alter table categories add column google_play_status
  google_play_review_status not null default 'unreviewed';
alter table question_packs add column google_play_status
  google_play_review_status not null default 'unreviewed';
alter table questions add column google_play_status
  google_play_review_status not null default 'unreviewed';
alter table dare_packs add column google_play_status
  google_play_review_status not null default 'unreviewed';
alter table dares add column google_play_status
  google_play_review_status not null default 'unreviewed';
```

Add the same review metadata to all five tables:

- `google_play_review_reason text`
- `google_play_reviewed_at timestamptz`
- `google_play_reviewed_by uuid references auth.users(id) on delete set null`

Add `catalog_policy_revision integer not null default 1` and
`force_safe_catalog boolean not null default true` to the singleton
`app_config`. Increment the revision whenever classifications or eligibility
rules change. `force_safe_catalog` is the emergency kill switch; when true all
channels receive the Play-safe catalogue.

Add indexes used by all disclosure paths:

```sql
create index categories_google_play_catalog_idx
  on categories (google_play_status, is_public, sort_order);
create index question_packs_google_play_catalog_idx
  on question_packs (google_play_status, is_public, category_id, sort_order);
create index questions_google_play_catalog_idx
  on questions (pack_id, google_play_status, intensity)
  where deleted_at is null;
create index dare_packs_google_play_catalog_idx
  on dare_packs (google_play_status, is_public, category_id, sort_order);
create index dares_google_play_catalog_idx
  on dares (pack_id, google_play_status, intensity);
```

### 3.2 Durable review audit

Add an append-only `content_distribution_reviews` table:

- `id uuid primary key default gen_random_uuid()`
- `entity_type text` checked to the five supported table types
- `entity_id uuid not null`
- `distribution text not null default 'google_play'`
- `previous_status google_play_review_status not null`
- `new_status google_play_review_status not null`
- `reason text not null`
- `reviewed_by uuid references auth.users(id) on delete set null`
- `created_at timestamptz not null default now()`

Only super admins can read it. Clients cannot insert, update, or delete it.
Use database triggers on the five content tables to:

- reject a status change without a non-blank reason;
- set `reviewed_at` and `reviewed_by` from database time and `auth.uid()`;
- append the old/new decision to `content_distribution_reviews`;
- increment `app_config.catalog_policy_revision` after a real status change.

This replaces reliance on the admin's current best-effort, client-side audit
call for compliance decisions. Existing `audit_logs` remain useful for normal
CRUD history.

### 3.3 Eligibility helpers

Add stable SQL helpers used consistently by RPCs and tests:

- `is_google_play_category_allowed(category_id uuid)`
- `is_google_play_pack_allowed(pack_id uuid)`
- `is_google_play_question_allowed(question_id uuid)`
- dare equivalents

A question is eligible only when it is active, its own status is `allowed`, its
pack is public and `allowed`, and its optional category is public and `allowed`.
Premium and couple-pack rules are applied in addition to this predicate.

### 3.4 Legacy-client fail-closed boundary

Old builds query the public Supabase tables and RPCs directly and send no trusted
distribution context. Change public/authenticated SELECT policies so non-admin
direct access exposes only Google Play-allowed rows. Preserve the existing admin
policy as a separate permissive policy.

Specifically drop every overlapping non-admin visibility policy (including the
current public-pack and premium-pack policies) and replace the broad policies
for `categories`, `question_packs`, `questions`, `dare_packs`, and `dares`. The
question policy must include
`deleted_at is null`, question status, parent pack status/public access, category
status/public access, premium access, and existing gender rules where relevant.

Recreate every SECURITY DEFINER content RPC with the same fail-closed predicate,
including at minimum:

- `get_recommended_questions`
- `get_answer_gap_status`
- `get_daily_response_limit_status` if its counts are presented as catalogue progress
- pack statistics/progress functions
- dare catalogue and statistics functions

`get_recommended_questions(target_pack_id)` must reject a blocked/unreviewed
explicit target pack rather than trusting the supplied UUID. It must also filter
the individual question and exclude soft-deleted questions.

Because existing iOS builds also omit distribution metadata, this cutover will
temporarily give old iOS builds the safe catalogue. That is unavoidable without
leaving old Android builds able to retrieve blocked content. Updated iOS builds
restore the broader catalogue through the private API.

### 3.5 Write enforcement

Reads alone are insufficient. A user who retained an old question UUID must not
be able to submit or change a response to it from the Google Play/default-safe
channel.

Move submission/update into the API and enforce the resolved distribution before
writing. During the legacy window, update `submit-response` and
`update-response` edge functions so missing/unknown channel means Play-safe and
blocked IDs return `404 content_not_available` (not text or policy details).

The same rule applies to:

- enabling a pack in `couple_packs`;
- creating a sent dare from a developer-authored dare;
- retrieving or mutating a historical response;
- opening a match/chat tied to blocked developer content.

Keep existing rows. Do not cascade-delete responses, matches, messages, or media.

### 3.6 Device records for notification safety

Replace the single `profiles.push_token` as the long-term delivery model with
`user_devices`:

- `id uuid primary key`
- `user_id uuid not null references profiles(id) on delete cascade`
- `expo_push_token text not null unique`
- `platform text` checked to `ios` or `android`
- `distribution text` checked to `apple_app_store`, `google_play`, or `unknown`
- `app_version text`, `build_number integer`
- `catalog_policy_revision integer not null`
- `last_seen_at`, `created_at`, `updated_at`
- `disabled_at timestamptz`

RLS permits a user to manage only their own device rows. Backend workers read
them privately. Unknown devices get safe counts and safe destinations. Keep
`profiles.push_token` during one release as a compatibility fallback, then stop
writing it and remove it in a later migration after delivery metrics confirm the
cutover.

## 4. API changes

The new API is the only long-term product-data boundary. The current pack-domain
work is incomplete and not registered by `apps/api/src/app.ts`; extend that work
rather than creating another parallel path.

### 4.1 Request context

Update `apps/mobile/src/lib/apiClient.ts` to send:

- `X-Sauci-Platform: ios|android`
- `X-Sauci-Distribution: apple_app_store|google_play`
- `X-Sauci-App-Version`
- `X-Sauci-Build-Number`
- `X-Sauci-Catalog-Policy-Revision`

Use Expo Constants and `Platform.OS`, not environment-specific user choices.
Add a typed API middleware/request context in `apps/api/src/app.ts` that parses
these headers once. Invalid, contradictory, absent, or future values resolve to
`google_play`; they never resolve to the broader catalogue. The distribution
header is a policy routing signal, not an authentication or authorization
credential. Add App Attest/Play Integrity later if resistance to platform
spoofing becomes a product requirement.

When `force_safe_catalog` is true, the resolved policy is Google Play-safe for
every request. Include the current policy revision in every catalogue response.

### 4.2 Required API surface

Implement and register authenticated routes for every product-content path:

| Route | Required behaviour |
|---|---|
| `GET /v1/catalog` | eligible categories and packs; question counts count only eligible questions |
| `GET /v1/packs/:id` | eligible metadata and preview questions; blocked IDs return 404 |
| `GET /v1/me/enabled-packs` | omit blocked pack IDs without deleting couple settings |
| `PUT /v1/me/enabled-packs/:id` | reject an ineligible pack |
| `GET /v1/me/pack-progress` | denominator and answered count use only eligible questions |
| `GET /v1/questions/recommended` | preserve partner/gender/intensity/premium logic plus policy filter |
| `GET /v1/questions/pending` | filter both partner response and joined question |
| `POST /v1/responses` | validate eligibility in the same transaction as the write/match calculation |
| `PATCH /v1/responses/:id` | validate ownership and current eligibility |
| `GET /v1/me/responses` | omit blocked history and its question/pack text |
| `GET /v1/matches` | omit blocked matches and exclude them from badges/counts |
| `GET /v1/matches/:id` | blocked IDs return 404 before returning question, summary, messages, or media URLs |
| dare routes | same parent/item/read/write enforcement; do not expose until reviewed |
| `PUT/DELETE /v1/me/devices/:token` | register/disable device metadata |

All repository queries take a required `ContentPolicy` argument. Do not accept a
boolean such as `showAdult`; use a closed server type such as
`'google_play_safe' | 'full_catalog'`. Centralize the SQL predicate so route
authors cannot forget it. Repository tests must fail if no policy is supplied.

Do not return hidden text in error bodies, logs, analytics, or tracing tags.

### 4.3 Transaction and isolation rules

- Derive `user_id` from the verified JWT, never request JSON.
- Derive `couple_id` from the authenticated profile.
- On submission, lock/read the eligible question and existing responses inside
  one transaction, then upsert the response and match.
- Every match/message query checks the authenticated user's current couple.
- Pack toggles use the authenticated couple and an eligible pack in one query.
- Preserve current premium, answer-gap, daily-limit, gender-targeting, inverse,
  and question-type behaviour while adding the distribution predicate.

## 5. Mobile changes

### 5.1 Remove content reads from `legacyDataClient`

Migrate these exact surfaces to typed API methods:

- `src/store/packsStore.ts`: catalogue, enabled packs, toggles, progress.
- `src/features/swipe/services/swipeService.ts`: pack context, recommended and
  pending questions, status checks, and response submission.
- `app/pack/[id].tsx`: pack/question preview and direct-link handling.
- `src/store/matchStore.ts`: all match, pending, their-turn, response, and nudge
  context queries.
- `src/store/responsesStore.ts`: My Answers, pagination, counts, edits.
- `src/features/chat/ChatScreen.tsx`: match/question header and initial access.
- `app/(app)/_layout.tsx`: realtime match hydration and toast copy.
- future dare stores/screens and all content search surfaces.

Auth may continue to use `authClient`. Realtime can temporarily use Supabase only
as an invalidation signal containing IDs; the app must refetch the visible DTO
from the API before rendering it. Never render embedded realtime question text.

### 5.2 Typed DTOs and safe UI states

Add shared types and Zod schemas in `packages/shared`, exported through
`src/index.ts`, for request context, catalogue, questions, responses, matches,
device registration, `content_not_available`, and policy revision.

Blocked/stale deep links should navigate to a neutral screen: "This item is no
longer available in this version of Sauci." Do not display the old title or
question. The same neutral state is used when an item becomes blocked while the
app is open.

On policy revision change or app resume:

- cancel in-flight catalogue requests;
- clear packs, swipe queue, pending, matches, response-history, and chat-header
  stores;
- clear React Query content keys;
- discard any current card before refetching;
- retain only IDs needed for locally skipped questions; no question text is
  persisted.

Add a response interceptor for `404 content_not_available` and policy revision
mismatch so every screen gets the same clearing behaviour.

### 5.3 Copy and settings

- Remove the Android-visible promise of explicit content from onboarding,
  settings, subscription paywalls, empty states, analytics screen names, and the
  dares coming-soon page.
- Keep `hide_nsfw`/intensity for iOS product preferences, but do not show a
  control on Android that implies blocked adult content can be unlocked.
- Describe the Android value as private compatibility, curiosity, boundaries,
  relationship dynamics, and user-led conversation.
- Never seed an explicit example or placeholder into a free-text field.

### 5.4 Private user-authored content

If Sauci adds "write your own" prompts to preserve the final jump:

- it is a separate question type and database record, visibly labelled as
  written by the partner rather than Sauci;
- content is private to the couple and not discoverable, searchable, or reused;
- notifications say only that a partner shared a private prompt;
- provide report, delete, block-partner/leave-couple, and safety help actions;
- rate-limit creation and validate length/media type;
- do not generate, complete, recommend, categorize, or provide explicit starter
  text;
- include UGC moderation and enforcement terms before enabling it on Android.

This feature should be a later submission, not mixed into the remediation build.

## 6. Admin changes

Update Categories, Packs, Questions, Dare Packs, and Dares pages/services to add:

- Google Play status badge and reason;
- filters for unreviewed/allowed/blocked and "parent blocks child";
- single and bulk review actions available only to `super_admin`;
- required reason and confirmation showing affected question counts;
- a queue sorted with rejection-evidence items first;
- a read-only review history panel from `content_distribution_reviews`;
- dashboard counts and a hard warning when any public item is unreviewed;
- CSV export/import by immutable ID for offline line review, with dry-run diff;
- publish/scheduled-release validation that does not imply Play eligibility.

Review inverse question pairs together. A transaction-backed admin API/RPC must
change both sides atomically and reject mismatched pair status. Do not add a hard
constraint until the existing inverse data has been audited and repaired, since
legacy pairs may not currently be reciprocal.

Creating or materially editing text resets that item to `unreviewed`, clears its
review metadata, and increments the policy revision. Editing pack/category text
also resets that parent. Reordering, icon/color changes, and pricing changes do
not reset status unless visible copy changes.

Update `AUDITED_TABLES` to include dare tables and the new review table, while
keeping the database review-event trigger as the authoritative compliance log.

## 7. Notifications, jobs, and cached disclosure

Update all notification workers and scheduled functions:

- `send-notification`
- `send-message-notification`
- `send-match-notification-digest`
- `send-partner-activity-notification`
- `send-catchup-reminder`
- `send-weekly-summary`
- future dare notification functions

Counts for a Google Play/unknown device include only eligible source questions.
Never include question, pack, dare, response, or message text in a push preview.
A tap may carry an opaque match ID, but the target route must re-authorize and
re-evaluate eligibility. Suppress a push when its only destination would be a
blocked item.

Realtime payloads are invalidations, not renderable content. Clear current
content on sign-out, relationship deletion, policy revision, and distribution
change. Verify SecureStore/AsyncStorage migrations do not contain prompt text.

## 8. Migration and release sequence

### Phase A - content freeze and evidence

1. Freeze developer-authored pack/question/dare publishing.
2. Export immutable IDs, visible copy, pack/category, intensity, inverse ID,
   public/premium flags, and response/match counts from production.
3. Save the exact rejection screenshots and map every shown card to its question
   ID. Do not store subscriber answers or message content in the review file.
4. Produce an allow/block CSV reviewed by a human; unresolved rows remain
   `unreviewed`.
5. Capture before-state counts by status, pack, responses, and matches.

### Phase B - schema and API locally

1. Create the canonical migration and seed the reviewed ID decisions in the same
   migration or a separate explicit data migration. Never classify by mutable
   pack name in production SQL.
2. Update generated Supabase types and the Drizzle schema mirror.
3. Implement API request context, repositories, routes, device registration,
   and policy-aware notification queries.
4. Update edge functions and legacy RPCs for fail-closed compatibility.
5. Reset local Supabase and run SQL/RLS/function tests.

### Phase C - mobile and admin

1. Move all listed mobile content paths to the API.
2. Add revision-driven cache clearing and neutral unavailable states.
3. Build admin review queue, atomic bulk review, audit view, and release guards.
4. Rewrite Android-visible sexualized marketing/UI copy.
5. Complete content review; no public Play item remains `unreviewed`.

### Phase D - controlled production cutover

1. Declare and record the one authoritative product database for this release.
   If the standalone migration is incomplete, do not mix its writes with live
   Supabase writes; perform the compliance cutover on the current source first.
2. Deploy additive schema and API with `force_safe_catalog=true`.
3. Read back schema, seeded decisions, RLS definitions, status counts, and a
   sample of each endpoint. Do not expose text in deployment logs.
4. Ship the API-based iOS update first and verify the full-catalogue path. Old
   iOS builds may remain safe-only after the RLS cutover.
5. Enable the legacy RLS/RPC safe boundary so every old Android build becomes
   safe, then independently test production with a legacy token/build.
6. Deploy Android version code greater than 45 to internal testing. Verify a new
   user and an existing production-like user with historical adult responses.
7. Keep the emergency kill switch on for the first Play review. A later,
   separately verified change may allow the full iOS policy while Android stays
   safe.

### Phase E - Play submission

1. Deactivate superseded non-compliant bundles from every active testing track
   that is included in review.
2. Complete the content-rating questionnaire from the remediated binary and
   catalogue, not the previous app. Do not under-declare remaining content.
3. Provide working reviewer credentials and deterministic navigation notes.
4. In the submission note, state that the cited Fantasy Scenarios, Sensual
   Touch, and Pushing Limits content is unavailable in the Android build and
   that new Android content is manually allowlisted.
5. Attach concise evidence from the exhaustive Android crawl. Do not argue that
   competitor apps prove compliance.
6. Submit one clean remediation build; do not repeatedly test policy boundaries
   with incremental explicit variants.

## 9. Verification matrix

### Database

- Fresh local reset applies every migration.
- New content defaults to `unreviewed`.
- Non-admin direct SELECT cannot see unreviewed/blocked child or parent rows.
- Admin can see all rows without weakening couple/user RLS.
- Direct target-pack RPC calls cannot retrieve a blocked pack.
- Soft-deleted questions never appear.
- Status changes require a reason, record actor/time, append one audit event,
  and increment policy revision.
- Content-text edits reset status; metadata-only edits behave as specified.
- Existing response/match/message row counts are unchanged by classification.

### API

- Android, missing headers, invalid headers, and unknown future builds all get
  exactly the safe allowlist.
- iOS gets the intended policy only when the kill switch permits it.
- Every catalogue count equals its filtered children.
- A known blocked UUID returns 404 on pack, question, response, match, chat,
  toggle, and dare endpoints.
- Pending, answer gap, daily limit, badges, and progress exclude blocked items.
- Couple A cannot infer IDs, counts, responses, matches, or devices for Couple B.
- Premium cannot bypass distribution status.
- Logs/errors never contain blocked text.

### Mobile Android

- Fresh install, upgrade from version 45, existing subscriber, non-subscriber,
  paired/unpaired, and user with historical adult matches.
- Browse every category/pack/card; test direct links and notification taps.
- Test Matches tabs, My Answers, chat header, realtime toasts, search, empty
  states, settings, onboarding, subscription screens, and dare interest page.
- Change policy revision while a blocked card is on screen; it disappears before
  any further render/action.
- Attempt traffic replay with a blocked UUID; UI shows only the neutral state.
- Automated screenshot/text crawl contains none of the rejection evidence or
  disallowed developer-authored acts.

### iOS regression

- The API-based iOS build retains the intended broader catalogue, subscriptions,
  answers, matches, chats, inverse text, and premium behaviour.
- Android classifications do not delete or rewrite iOS data.

Run the repository gates in order: focused unit/integration tests,
`npm run verify:fast`, local database reset/RLS tests, API E2E, native Android
verification, then `npm run verify:full`. A missing emulator, database, or
credential is reported as an environment limitation, not a pass.

## 10. Observability and rollback

Emit metrics without content text:

- catalogue responses by resolved policy/build;
- count of allowed/blocked/unreviewed entities;
- blocked-ID read/write attempts by route;
- policy revision adoption by active device;
- notification suppressions by reason;
- legacy direct-client usage and API migration percentage.

Add a nightly invariant check that fails if any Google Play API response could
join a non-allowed entity, if an allowed child has a blocked parent, or if an
allowed inverse pair is inconsistent. Alert rather than auto-classifying.

Rollback is configuration-first: set `force_safe_catalog=true`, invalidate
caches by incrementing the policy revision, and disable affected API routes. Do
not roll back the additive schema or restore broad direct-table RLS. Content
decisions can be reverted only through a new audited review event.

## 11. Concrete file checklist

Database and functions:

- new `apps/supabase/migrations/*_add_google_play_content_policy.sql`
- `apps/supabase/functions/submit-response/index.ts`
- `apps/supabase/functions/update-response/index.ts`
- all notification/catch-up/summary functions listed above
- regenerated `packages/shared/src/types/supabase.ts`
- regenerated `apps/mobile/src/types/supabase.ts` if it remains during migration

API and shared contracts:

- `apps/api/src/app.ts`
- new request-context/content-policy modules
- `apps/api/src/db/schema.ts`
- `apps/api/src/domains/packs/{repository,routes,schema}.ts`
- new questions, responses, matches, devices, notifications, and dares domains
- route/repository/integration tests for every domain
- `packages/shared/src/types/index.ts` plus domain-specific schema/type modules

Mobile:

- `apps/mobile/src/lib/apiClient.ts`
- stores/services/screens listed in section 5.1
- `apps/mobile/src/lib/notifications.ts`
- `apps/mobile/app/_layout.tsx` and `apps/mobile/app/(app)/_layout.tsx`
- new content-policy/cache reset module and tests
- Android-visible onboarding/settings/paywall/dare copy

Admin:

- content pages and services for categories, packs, questions, dare packs, dares
- `apps/admin/src/hooks/useAuditedSupabase.ts`
- new review queue/history/bulk-confirmation components and tests
- dashboard compliance counts

Documentation:

- `docs/architecture/system.md` for the enforced API boundary
- `docs/question-selection.md` for distribution-aware selection
- `docs/match-notifications.md` for device-aware safe delivery
- `docs/schema.md` for review/device tables
- `docs/releasing.md` for the Android compliance gate
- `docs/testing/strategy.md` for the distribution matrix
- `docs/index.md` linking this maintained plan while remediation is active

## 12. Definition of done

The remediation is not done when the three cited packs disappear from the pack
screen. It is done when a version-45 client, the new Android binary, direct
Supabase requests, guessed IDs, history, matches, chat, realtime, and push paths
all fail closed; the audited allowlist is complete; iOS data is preserved; and
the end-to-end Android crawl proves no disallowed developer-authored content can
be reached.
