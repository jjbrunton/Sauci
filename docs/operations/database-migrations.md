# Database migration safety

The standalone PostgreSQL schema is owned by ordered SQL files under
`apps/api/drizzle/`. Hosted Supabase owns Auth only; its legacy product-data
migrations and Edge Functions are retained as cutover history and are not a
deployment target.

## Required workflow

1. Add the next ordered SQL migration under `apps/api/drizzle/`.
2. Keep application, repository, shared-contract, and client changes in the same
   reviewed change where the schema contract requires them.
3. Run `npm run verify:full` against the dedicated loopback PostgreSQL service.
4. Run `infra/backend/verify-production.sh` for container and migration startup.
5. Merge to `staging`; the Dokploy migration service applies the committed files
   under an advisory lock before the API receives traffic.
6. Prove staging health and affected authenticated behavior before promoting the
   exact commit from `staging` to `main`.

## Safety invariants

- Never point local integration tests, reset commands, or disposable verification
  at a remote database.
- Never deploy `apps/supabase/migrations` or `apps/supabase/functions` as part of
  the standalone backend release.
- Never execute DDL through MCP or provider SQL tools.
- Never edit migration history already applied to a persistent environment; add
  a forward migration.
- Back up PostgreSQL and private media together before a destructive production
  migration or data import, and prove restore separately.
- A failed migration must block API startup. Do not bypass the one-shot `migrate`
  service to force new code against an old schema.

Production data cutover has additional stop-source, final-sync, parity, legacy
media, and authenticated-mobile checks in [backend-cutover.md](backend-cutover.md).
