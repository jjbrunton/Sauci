# Supabase backend

This directory owns local configuration, migrations, Edge Functions, seeds, and
integration tests.

## Schema safety

- Create migrations only with `npm run db:migration:new -- <name>`.
- Edit only `apps/supabase/migrations/`; this is the authoritative migration tree.
- Never use any remote `apply_migration` tool.
- Never execute DDL through MCP SQL tools; those tools are `SELECT`-only.
- Never link or reset a remote project during local verification.
- Cron/function URLs must resolve per environment, never hardcode production.

## Function boundaries

- Set deployment JWT configuration deliberately per function. A function using
  `verify_jwt = false` must implement the correct manual, webhook, cron, or internal
  authentication boundary; it is not permission to omit authorization.
- Service-role clients never run in customer clients.
- Preserve CORS handling and return non-sensitive errors.
- Test RLS, authorization, and important side effects, not only HTTP status.

Verify with local reset, `npm run test:supabase`, invariant lint, and affected
client tests. See `docs/operations/database-migrations.md`.
