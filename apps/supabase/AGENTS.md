# Legacy Supabase data plane

This directory preserves the former product-data schema, Edge Functions, seeds,
and migration source needed for audited cutover. Hosted Supabase now owns Auth
only. The active application schema and server code live under `apps/api`.

## Schema safety

- Do not add product-data migrations or functions here.
- Do not deploy this migration tree or these Edge Functions to hosted Supabase.
- Never use any remote `apply_migration` tool.
- Never execute DDL through MCP or provider SQL tools.
- Never link or reset a remote project during local verification.

## Function boundaries

- Set deployment JWT configuration deliberately per function. A function using
  `verify_jwt = false` must implement the correct manual, webhook, cron, or internal
  authentication boundary; it is not permission to omit authorization.
- Service-role clients never run in customer clients.
- Preserve CORS handling and return non-sensitive errors.
- Test RLS, authorization, and important side effects, not only HTTP status.

Legacy tests may be run during cutover archaeology, but they are not the active
deployment gate. See `docs/operations/database-migrations.md`.
