# AGENTS

## Verification
- npm test (runs mobile Jest suite)
- npm run lint
- npm run typecheck
- npm run build

## Database Migrations - MANDATORY RULES

**NEVER use `mcp__sauci-prod__apply_migration` or `mcp__sauci-non-prod__apply_migration`.** These create migration records in the remote database without local files, which breaks CI/CD deployments.

**NEVER run DDL (`CREATE`, `ALTER`, `DROP`) via `mcp__*__execute_sql`.** This changes the schema with no migration tracking.

**All schema changes must be local migration files:**
1. Run `supabase migration new <name>` to create the file
2. Edit the file in `apps/supabase/migrations/`
3. Use idempotent SQL (`IF NOT EXISTS`, `CREATE OR REPLACE`)
4. Commit the file — CI deploys it automatically

**`execute_sql` is ONLY for SELECT queries.** No exceptions.
