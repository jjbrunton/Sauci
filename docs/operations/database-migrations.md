# Database migration safety

All schema changes are versioned local files under `apps/supabase/migrations/`.

## Required workflow

1. `npm run db:migration:new -- <descriptive_name>`
2. Edit the generated local migration.
3. Prefer idempotent SQL where semantics permit it.
4. `npm run db:reset` against local Supabase.
5. Run `npm run test:supabase` and affected application checks.
6. Commit the migration with dependent code and types.

## Forbidden paths

- Never call a remote `apply_migration` MCP tool.
- Never execute DDL through MCP SQL execution.
- MCP SQL execution is read-only `SELECT` use only.
- Never insert migration history manually except an explicitly approved repair.
- Never hardcode a production URL in a migration or cron definition.

CI deploys committed migrations and Edge Functions to non-production after relevant
pushes. Production promotion is a manual workflow dispatch. Terraform is applied
only when files under `terraform/` change, or when `deploy_infrastructure` is
explicitly selected during a manual deployment. Local verification must not link a
remote project.
