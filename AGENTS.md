# Sauci agent map

Sauci is a couples connection product: an Expo mobile app, React admin, Next.js
web app, Supabase backend, and an internal MCP service in one npm/Turborepo
workspace.

## Golden rules

1. Read the nearest `AGENTS.md` before changing a scoped area.
2. Preserve tenant and couple isolation. Never bypass RLS, role checks, or auth.
3. All schema changes are local files in `apps/supabase/migrations/` created with
   `npm run db:migration:new -- <name>`. Never use remote `apply_migration`, never
   execute DDL through MCP SQL tools, and use those SQL tools for `SELECT` only.
4. Never target production from local development or E2E. Local tests must fail
   closed when a configured Supabase URL is not localhost.
5. Read `apps/mobile/DESIGN.md` before mobile UI work.
6. Keep shared package exports type-only and route them through `src/index.ts`.
7. Do not commit secrets, generated evidence, local logs, or runtime state.
8. Scope work to the task. Use high-effort reviewers only for the risk triggers in
   `docs/agents/routing.md`.

## Repository map

| Area | Purpose | Local instructions |
|---|---|---|
| `apps/mobile` | Expo React Native product | `apps/mobile/AGENTS.md` |
| `apps/admin` | Vite administration UI | `apps/admin/AGENTS.md` |
| `apps/web` | Next.js marketing/redemption UI | `apps/web/AGENTS.md` |
| `apps/supabase` | migrations, functions, local backend | `apps/supabase/AGENTS.md` |
| `apps/mcp` | internal administrative MCP service | `apps/mcp/AGENTS.md` |
| `packages/shared` | shared TypeScript contracts | `packages/shared/AGENTS.md` |
| `e2e` | cross-application Playwright flows | `e2e/README.md` |
| `docs` | maintained system of record | `docs/index.md` |

## Workflows

- Bootstrap: `npm ci`
- Full local stack: `scripts/dev-local.sh up`
- Fast checks: `npm run verify:fast`
- Authoritative repository checks: `npm run verify:full`
- Running-stack E2E: `npm run verify:e2e`
- Everything: `npm run verify`
- Before a PR: use `.codex/skills/verify/SKILL.md`

When a check cannot run because a prerequisite is absent, report it as an
environment limitation; do not call it a passing product check.

## Where to look

| Question | Source of truth |
|---|---|
| System boundaries and data flow | `docs/architecture/system.md` |
| Local services, ports, fixtures | `docs/development/local-stack.md` |
| Test layers and required gates | `docs/testing/strategy.md` |
| Database migration safety | `docs/operations/database-migrations.md` |
| Agent roles and effort routing | `docs/agents/routing.md` |
| Learning promotion | `docs/agents/learnings.md` |
| Mobile visual language | `apps/mobile/DESIGN.md` |
| Domain documentation index | `docs/index.md` |

## Documentation discipline

Update the maintained doc when a contract, command, port, or invariant changes.
Plans and historical notes are evidence, not current architecture. A repeated
lesson becomes permanent only after it is reproduced and promoted into a doc,
skill, fixture, or executable check.
