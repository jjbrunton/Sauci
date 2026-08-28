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

PostgreSQL is bound to `127.0.0.1`, is healthchecked before application startup,
and stores data in a named Docker volume. The local connection string is:

```text
postgresql://sauci:sauci_local_only@127.0.0.1:54320/sauci
```

Those credentials are for local development only. Deployed environments must
inject unique secrets; they must never consume `infra/backend/.env.example`.

## First run

1. Use Node from `.nvmrc` and run `npm ci`.
2. Install Docker Desktop or Rancher Desktop and tmux.
3. Configure the hosted Supabase Auth public URL/key for the mobile application
   and the hosted Auth issuer/JWKS settings for the API. Do not configure any
   local command with production credentials. Authenticated mobile E2E requires
   the designated hosted non-production Auth project and a disposable,
   onboarding-complete user whose subject has a matching local profile. Pass
   its credentials as `E2E_EMAIL` and `E2E_PASSWORD` only to the Maestro process;
   do not store them in an Expo environment file.
   To exercise MCP tools, also set a local `ADMIN_API_SERVICE_TOKEN`, its
   fixture `ADMIN_API_SERVICE_USER_ID`, and a separate `SAUCI_MCP_API_KEY`.
   `scripts/dev-local.sh` passes the service token to MCP as
   `SAUCI_ADMIN_API_TOKEN`; MCP never receives a database or Supabase service
   credential.
4. Run `scripts/dev-local.sh reset` to recreate only the dedicated local Docker
   volume, apply API migrations, and create configured fixtures.
5. Run `scripts/dev-local.sh up`.

`up` is idempotent. `down` stops tmux application processes and leaves the
database available. `down --all` also stops PostgreSQL but retains its volume.
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
`android` to launch the native application against the same API. Physical
devices require a reachable host URL rather than loopback.

`e2e/maestro/login-screen-smoke.yaml` verifies the native build and Auth shell
without credentials. `e2e/maestro/login-smoke.yaml` is the authenticated
standalone-API flow and must fail closed unless the non-production fixture above
is explicitly supplied. Neither local nor E2E runs may use the production Auth
project, production subscriber, or production application database.
