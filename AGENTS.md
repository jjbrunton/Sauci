# Sauci agent map

Sauci is a couples connection product: an Expo mobile app, React admin, Next.js
web app, standalone Node/PostgreSQL backend, hosted Supabase Auth, and an internal
MCP service in one npm/Turborepo workspace.

## Golden rules

1. Read the nearest `AGENTS.md` before changing a scoped area.
2. Preserve tenant and couple isolation. Never bypass RLS, role checks, or auth.
3. Product-data schema changes are committed SQL files in `apps/api/drizzle/`.
   Hosted Supabase owns Auth only; do not deploy product-data migrations or Edge
   Functions there. Never execute remote DDL through MCP or provider tools.
4. Never target production from local development or E2E. Database integration
   tests must fail closed unless `DATABASE_URL` resolves to loopback. Authenticated
   native acceptance may use only the designated non-production Auth project.
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
| `apps/api` | standalone API, worker, PostgreSQL migrations | repository rules |
| `apps/supabase` | legacy data-plane history; hosted Auth configuration only | `apps/supabase/AGENTS.md` |
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
