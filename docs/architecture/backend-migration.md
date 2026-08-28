# Standalone backend migration

Sauci's standalone Node API, PostgreSQL data plane, worker, and private filesystem media
store are implemented; production cutover is still pending. Hosted Supabase remains only
as the identity provider: the mobile and admin applications obtain a Supabase access token,
and the API verifies that token against the project's public JWKS. Product data, files,
realtime events, webhooks, scheduled work, admin operations, and MCP tools do not use the
Supabase data plane.

## Target runtime

- `api`: Node 20, Hono, Drizzle, PostgreSQL 17
- `worker`: Node 20 process sharing the API's domain modules and PostgreSQL
- `storage`: private filesystem-backed Docker volume with authenticated uploads and
  API-issued, expiring HMAC download URLs; the metadata/deletion queue lives in PostgreSQL
- `realtime`: authenticated polling, with optimistic concurrency for collaborative state
- `auth`: hosted Supabase Auth only. A server-only service-role credential is used solely
  for the Auth Admin account-deletion endpoint, never for database, Storage, Realtime,
  or Functions access.

The API derives every user identifier from the verified bearer token. Mobile-supplied
user IDs are never an authorization boundary.

## Delivery slices

| Slice | Backend | Mobile proof | Status |
|---|---|---|---|
| Identity | profiles, feature interests | bootstrap and interest hook tests; native launch | implemented |
| Couples | create/join/read/leave relationship | pairing and profile state | implemented |
| Catalogue | categories, packs, enabled packs, progress | pack list and toggling | implemented |
| Answers | questions, responses, matches, streaks | swipe/answer/match flows | implemented |
| Chat | messages, reports, deletions, typing/polling | message and typing store tests | implemented |
| Media | avatars, response media, chat media, feedback screenshots, cleanup | upload/view/expiry | implemented |
| Account | settings, notifications, feedback, deletion | settings and account lifecycle | implemented |
| Billing | subscriptions and RevenueCat webhook idempotency | entitlement refresh | implemented |
| Operations | reminders, digests, scheduled releases, moderation and cleanup | worker/integration tests | implemented |
| Admin/MCP | role-scoped management API and audited automation | admin and MCP contract tests | implemented |

## Gate for every slice

1. Add an idempotent standalone PostgreSQL migration and domain repository tests against
   a temporary real schema.
2. Add API authorization/validation tests, including a second-user isolation test where
   the domain is user-scoped.
3. Move the mobile domain to `apiClient`; hosted Supabase remains reachable only through
   the dedicated Auth client.
4. Run focused mobile tests, the complete mobile Jest suite, API tests/typecheck/build,
   and a native simulator flow when the slice is user-visible.
5. Do not remove the legacy source or cut production traffic until a stopped-source final
   sync, row/file parity checks, and application-level staging flows have passed.

Authenticated native acceptance requires an isolated hosted **non-production** Supabase
Auth project plus an onboarding-complete test user whose Auth subject has a matching profile
in the staging PostgreSQL database. Supply its public URL/anon key to the mobile build and
`E2E_EMAIL`/`E2E_PASSWORD` to Maestro at execution time. Never use a production project,
subscriber, service-role key, or production data-plane credential for local or E2E work.
The credential-free `e2e/maestro/login-screen-smoke.yaml` remains the safe build/login-shell
check when that fixture is unavailable; it is not proof of authenticated API behaviour.

## Deployment sequence

Dokploy staging receives separate persistent PostgreSQL and private-media volumes. The
API migration job must complete before the API starts. Cutover is deliberately later:

1. Export a first production snapshot into staging and compare table counts plus sampled
   relational invariants.
2. Exercise the mobile app against staging while it still uses hosted Supabase Auth.
3. Stop product-data writes to the old backend, perform the final delta sync, and repeat
   parity and app-level tests.
4. Switch the mobile/API endpoint. Retain the Supabase data plane read-only until rollback
   is no longer required; only then reduce the hosted project to the Auth-only footprint.

The executable import, parity, final-sync, and rollback procedure is maintained in
[`docs/operations/backend-cutover.md`](../operations/backend-cutover.md).
