---
name: db-migration
description: Create, review, and verify Sauci Supabase schema migrations. Use for tables, columns, functions, policies, indexes, triggers, or other database shape changes.
---

# Sauci database migration

Read `apps/supabase/AGENTS.md` and `docs/operations/database-migrations.md`.

1. Create the local file with `npm run db:migration:new -- <name>`.
2. Edit only `apps/supabase/migrations/`; keep environment-specific URLs dynamic.
3. Update affected shared/generated contracts and callers in the same task.
4. Reset local Supabase, run function/RLS tests, and independently inspect the
   resulting schema/behavior.
5. Commit the migration file with dependent code. CI performs deployment.

Never call remote `apply_migration`; never send DDL through MCP SQL execution;
never use a remote project for local validation.
