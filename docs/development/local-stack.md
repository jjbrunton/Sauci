# Local full-stack development

Use `scripts/dev-local.sh`; do not start a mixture of local and production-backed
services manually.

| Service | Owner | Port |
|---|---|---:|
| Supabase API / functions | Supabase CLI | 54321 |
| Supabase database | Supabase CLI | 54322 |
| Supabase Studio | Supabase CLI | 54323 |
| Web | Next.js | 3000 |
| Admin | Vite | 3001 |
| MCP | Hono | 3002 |
| Expo Metro | Expo | 8081 |

## First run

1. Use Node from `.nvmrc` and run `npm ci`.
2. Install Docker Desktop or Rancher Desktop, tmux, and the Supabase CLI.
3. Copy committed environment examples. Local helpers derive local Supabase
   values; they never print or overwrite production credentials.
4. Run `scripts/dev-local.sh reset` to apply migrations and create E2E fixtures.
5. Run `scripts/dev-local.sh up`.

`up` is idempotent. `down` stops tmux services and leaves Supabase available;
`down --all` also stops Supabase. Use `status`, `logs <service>`, `restart
<service>`, and `attach` for diagnosis.

The Expo window defaults to Metro. Use `scripts/dev-local.sh ios` or `android` to
launch the native app against the same backend.
