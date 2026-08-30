# Local full-stack development

Use `scripts/dev-local.sh`; do not start a mixture of local and production data
services manually. The default stack uses conventional PostgreSQL and the Sauci
Node API. It does **not** start local Supabase. Supabase remains the hosted
identity provider, so local application processes need the public Auth settings
described by their environment examples.

| Service | Owner | Port |
|---|---|---:|
| PostgreSQL | Docker Compose | 54320 |
| Sauci API | Node / Hono | 3003 |
| Operations worker | Node / Hono domain modules | none |
| Web | Next.js | 3000 |
| Admin | Vite | 3001 |
| MCP | Hono | 3002 |
| Expo Metro | Expo | 8081 |

If another local project owns one of the application ports, add a different,
unique value to the ignored root `.env.local` before running `up`:

```text
SAUCI_WEB_PORT=3100
SAUCI_ADMIN_PORT=3101
SAUCI_MCP_PORT=3102
SAUCI_METRO_PORT=8181
```

`SAUCI_POSTGRES_PORT` and `SAUCI_API_PORT` remain available for their existing
local overrides. Every configured port must be a unique integer from 1 through
65535. Before launching managed services, the launcher checks both IPv4 and IPv6
listeners and fails closed with the owning PID, command, and working directory;
it never stops another project's process.

PostgreSQL is bound to `127.0.0.1`, is healthchecked before application startup,
and stores data in a named Docker volume. The local connection string is:

```text
postgresql://sauci:sauci_local_only@127.0.0.1:54320/sauci
```

Those credentials are for local development only. Deployed environments must
inject unique secrets; they must never consume `infra/backend/.env.example`.

## Start the stack

One command starts the local database, applies migrations and fixtures, and
launches the application services:

```bash
scripts/dev-local.sh up
```

Before the first use, install Docker Desktop or Rancher Desktop, tmux, and the
repository dependencies with `npm ci`. The launcher reads `.nvmrc` itself. When
the active Node version differs, it loads an installed Homebrew `nvm` and selects
the exact version automatically. If that version has not been installed yet, run
the command the launcher prints once, then rerun `up`.

Create the ignored root `.env.local` with the public Auth settings for the
designated non-production Supabase project (`itbzhrvlgvdmzbnhzhyx`). Set
`SUPABASE_AUTH_URL` (or `EXPO_PUBLIC_SUPABASE_URL`) and
`EXPO_PUBLIC_SUPABASE_ANON_KEY`; the launcher uses the URL for the API and both
values for Expo. It accepts only this designated hosted project or loopback Auth,
and explicitly rejects the production project and every other hosted project.
Environment variables exported in the shell take precedence over `.env.local`.
The launcher treats `.env.local` as data, never shell code: use unquoted
`KEY=VALUE` lines for only the documented launcher keys. Never place production
credentials or Auth issuer/JWKS, Auth service-role, RevenueCat, or other provider
secrets in `.env.local`; the launcher removes those inherited values from its
local API and worker processes. Each `up` replaces its managed tmux windows so
stale application processes cannot retain earlier configuration, while leaving
unrelated windows intact. Credentials are passed only to the local process that
needs them: MCP receives its local API token/key but never `DATABASE_URL`.
Before replacing a managed window, the launcher verifies and stops only its
current descendant processes. If those descendants do not exit promptly, it
leaves that window in place and fails rather than broadening process cleanup.
This includes a previously captured descendant that has left the pane lineage:
the launcher will not signal it again or replace the window until that captured
process identity is gone.

Authenticated mobile E2E requires a disposable, onboarding-complete user whose
subject has a matching local profile. Pass its credentials as `E2E_EMAIL` and
`E2E_PASSWORD` only to the Maestro process; do not store them in an Expo
environment file. To exercise MCP tools, also set a local
`ADMIN_API_SERVICE_TOKEN`, its fixture `ADMIN_API_SERVICE_USER_ID`, and a
separate `SAUCI_MCP_API_KEY`. `scripts/dev-local.sh` passes the service token to
MCP as `SAUCI_ADMIN_API_TOKEN`; MCP never receives a database or Supabase service
credential.

`up` is idempotent. `down` stops only the launcher's managed tmux application
windows and leaves unrelated windows and the database available. `down --all`
also stops PostgreSQL but retains its volume, and runs only after managed
application cleanup succeeds.
Use `status`, `logs <service>`, `restart <service>`, and `attach` for diagnosis.
`logs postgres` reads Compose logs; other names read their tmux panes.
The `worker` pane owns scheduled jobs, notifications, moderation classification,
and filesystem cleanup; local development disables external AI classification.

`reset` is destructive but fails closed unless the database is the dedicated
loopback instance on port 54320. It removes only the `sauci-local` Compose
volume, starts a fresh healthy database, then runs the API's `db:migrate` and
`db:seed` scripts. `seed` retains the volume and reapplies those two scripts.
The API seed is a no-op unless its documented local fixture identity is set.

The Expo window defaults to Metro with
`EXPO_PUBLIC_API_URL=http://127.0.0.1:3003`. Use `scripts/dev-local.sh ios` or
`android` to launch the native application against the same API. The native
launcher supplies a UTF-8 locale inside its sanitized environment so CocoaPods
does not depend on the calling shell's locale. Physical devices require a
reachable host URL rather than loopback.

`e2e/maestro/login-screen-smoke.yaml` verifies the native build and Auth shell
without credentials. `e2e/maestro/login-smoke.yaml` is the authenticated
standalone-API flow and must fail closed unless the non-production fixture above
is explicitly supplied. Neither local nor E2E runs may use the production Auth
project, production subscriber, or production application database.
