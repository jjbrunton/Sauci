# Standalone backend infrastructure

This Compose project is the local data plane for the standalone Sauci API. It
does not run Supabase services. Supabase remains the hosted identity provider;
the API verifies its access tokens and owns all application data access.

Use `scripts/dev-local.sh` rather than invoking Compose directly. PostgreSQL is
bound to loopback and persists in the `sauci-local_sauci-postgres-data` volume.
The committed credentials are deliberately local-only and must not be reused by
a deployed environment.

Private media is stored on the API's `media-data` volume. Mobile clients upload
with bearer authentication, persist opaque `media:<uuid>` references, and ask
the API for short-lived signed read URLs. The public content route accepts only
a valid unexpired HMAC capability; it never exposes directory paths.

## Dokploy deployment contract

`compose.production.yaml` is a deployment-ready baseline containing the Node
API and worker, PostgreSQL, and a one-shot migration service. Configure Dokploy to build the
Compose file from the repository root and route the public API hostname to the
`api` service on port `3003`. Do not publish PostgreSQL.

Create separate Dokploy Compose applications for `staging` and `main`, both using
`infra/backend/compose.production.yaml`; enable push-triggered auto-deploy for
their respective branch. The file intentionally omits a top-level Compose project
name so Dokploy isolates networks and named volumes per application. See
[`docs/operations/backend-deployments.md`](../../docs/operations/backend-deployments.md)
for the promotion contract.

Copy the variable names from `.env.production.example` into Dokploy's secret
configuration. `POSTGRES_PASSWORD` and the password embedded (URL encoded) in
`DATABASE_URL` must match. Generate them for the deployment; never reuse the
committed local password. The API needs only the hosted Supabase Auth URL to
discover its issuer and JWKS endpoint. The server-only service-role key is used
solely by the hosted Auth Admin deletion endpoint; it must never reach a client
or be used for application data or Storage access. The backend must not receive
a Supabase anon key, database password, or direct Supabase Storage connection.

Administrative automation uses a separate opaque credential pair. Configure
`ADMIN_API_SERVICE_TOKEN` and `ADMIN_API_SERVICE_USER_ID` on the API together;
the UUID must resolve to an active, least-privilege `admin_users` row imported or
created in the standalone database. Configure MCP with the same token under the
different name `SAUCI_ADMIN_API_TOKEN` plus its independent caller-facing
`SAUCI_MCP_API_KEY`. The token does not confer Supabase authority: the API maps
it to the configured administrator and applies normal permissions and auditing.
Do not give either admin token to mobile, admin browser, or worker containers.
An environment without an imported active administrator may leave both values
empty; customer API routes still run, while MCP service authentication remains
disabled until the pair is configured. RevenueCat credentials are likewise
optional at infrastructure bootstrap, but purchase verification, webhooks, and
account-deletion provider cleanup remain unavailable until their dedicated
server-side credentials are installed.

Secret ownership is intentionally split:

| Secret | API | Worker | MCP |
|---|:---:|:---:|:---:|
| Hosted Auth service-role key | yes, Auth Admin only | no | no |
| RevenueCat API/webhook secrets | yes | no | no |
| Admin API service token | yes | no | yes, as `SAUCI_ADMIN_API_TOKEN` |
| OpenRouter/Discord worker credentials | no | yes | no |
| PostgreSQL/media signing configuration | yes | yes | no |

On each deployment, `migrate` waits for PostgreSQL, takes a PostgreSQL advisory
lock, applies the committed `apps/api/drizzle` migrations, and exits. The `api`
service starts only after migration succeeds. A failed migration therefore
fails closed instead of starting new application code against an old schema.
The image also exposes the same operation as:

```sh
node dist/db/migrate.js
```

The container runs as the unprivileged `node` user with a read-only filesystem,
dropped Linux capabilities, an init process, and bounded graceful shutdown.
Docker checks `/health/live`; Dokploy should use `/health/ready` for routing so
traffic is admitted only when PostgreSQL is reachable.

Before the first deployment, provide:

1. The API hostname and TLS route.
2. Persistent Dokploy volumes for `postgres-data` and `media-data`, with one
   coordinated backup/restore policy covering both.
3. The hosted Supabase project URL and expected JWT audience.
4. Fresh PostgreSQL credentials stored only in Dokploy secrets.
5. A rollback and restore point before any migrated production data is imported.
6. A separately generated `MEDIA_SIGNING_SECRET` (at least 32 characters) and
   the HTTPS API origin as `MEDIA_PUBLIC_BASE_URL`.
7. Browser origins are fixed by `CORS_ALLOWED_ORIGINS` in the Compose contract:
   `https://sauci.app` (public web) and `https://manage.sauci.app` (admin
   console, which calls `/v1/admin/*` with a bearer token). Do not broaden the
   list without a reviewed browser client requirement, and add any new admin
   host here rather than as a Dokploy override, so the allowlist stays
   reviewable in git.
8. A non-production hosted Auth project and disposable, onboarding-complete test
   identities mapped into the staging database for authenticated mobile acceptance.

Blob deletion is retryable. Database cascades and avatar replacement enqueue
the server-generated storage key in `media_deletion_queue`; the operations
worker removes the file and acknowledges the queue row only after a
successful deletion (missing files are treated as already removed). Failed
metadata transactions remove the newly written file immediately. Operators
should alert on an old/growing deletion queue and include it in database
backups; never delete files by constructing paths outside this lifecycle.

The worker also leases notification, moderation, and optional Discord jobs from
`operations_outbox`. Jobs are retried with bounded exponential backoff and are
not selected again after five attempts. Alert on rows that remain unsent after
five attempts; investigate and replay them explicitly rather than deleting the
idempotency record or blindly retrying provider calls.

Validate configuration without starting anything:

```sh
docker compose --env-file infra/backend/.env.production.local \
  -f infra/backend/compose.production.yaml config
```

## PostgreSQL connection and telemetry contract

The API and worker each create exactly one process-owned PostgreSQL pool and
hand it to every repository. They have separate deployment variables:
`API_DATABASE_POOL_MAX` (default 10) and `WORKER_DATABASE_POOL_MAX` (default
4). Set PostgreSQL `max_connections` above:

```text
(API replicas * API_DATABASE_POOL_MAX) + (worker replicas * WORKER_DATABASE_POOL_MAX) + migration/admin headroom
```

The headroom covers the one-shot migrator, an operator session, and any
backup/monitoring connection; allocating the full server limit to application
pools is unsafe. `DATABASE_POOL_IDLE_TIMEOUT_MS` and
`DATABASE_POOL_CONNECTION_TIMEOUT_MS` apply to both process pools.

API and worker write privacy-safe JSON telemetry to normal logs. Fixed event
types are request, query, pool, sync, and outbox; fields are route templates,
method/status/outcome, durations, counts, and pool/outbox sizes. They never
include SQL, query values, raw paths, identities, tokens, content, dedupe keys,
or request bodies. There is deliberately no public `/metrics` endpoint.
Request, query, and sync events are aggregated into one fixed-interval JSON
record per label set (and worker flushes after its tick); pool state is sampled
once per minute rather than per request. This prevents telemetry itself from
becoming a connection or log-volume amplifier. Outbox observation runs after
work with a 250ms best-effort deadline and uses the same due/unlocked predicate
as claims, so a slow observation cannot delay the next lease.

`pg_stat_statements` is useful for aggregate query investigation but is not
enabled by this repository change. A database operator must first confirm the
PostgreSQL image/provider supports it, add `shared_preload_libraries =
'pg_stat_statements'`, and restart PostgreSQL in a planned window. After that,
the extension itself must be introduced by a reviewed, committed migration in
`apps/api/drizzle/`; do not run ad hoc provider/operator DDL. This changes
server startup and remains deferred from ordinary API deployments.

For a controlled local observation, `npm run load:representative -w @sauci/api`
performs five authenticated sync reads, five authenticated chat reads, and a
read-only outbox-state query. It requires `DATABASE_URL`,
`SAUCI_LOAD_AUTHORIZATION`, `SAUCI_LOAD_USER_ID`, and `SAUCI_LOAD_MATCH_ID`.
It accepts only `http` loopback API port 3003 (or the explicit local
`SAUCI_LOAD_API_PORT`) and loopback PostgreSQL, verifies `/health/live` and the
authenticated fixture identity before load, and emits counts plus p50/p95/p99
summaries without any pass/fail latency threshold. Use disposable local or
designated non-production Auth credentials only; never pass a staging or
production token to this fixture.

Run the repeatable disposable container check before changing the Dokploy
application. It uses hard-coded test-only credentials, creates a unique Compose
project, verifies migration/startup/security/shutdown behaviour, and removes its
volume on exit:

```sh
infra/backend/verify-production.sh
```

Do not point this Compose project at an existing production database during
local validation. Validate against a disposable local volume first. Production
cutover additionally requires a stopped-source final sync, row/count checks,
legacy-media-reference checks, and authenticated mobile behaviour checks against
the non-production fixture; container health alone is not proof of a successful
migration.
