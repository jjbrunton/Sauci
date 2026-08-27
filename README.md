# Sauci

Sauci is a couples connection product built as a full-stack npm/Turborepo
workspace.

## Applications

| Path | Surface |
|---|---|
| `apps/mobile` | Expo React Native customer app |
| `apps/admin` | Vite/React administration app |
| `apps/web` | Next.js marketing and redemption app |
| `apps/supabase` | database, auth, realtime, storage, and Edge Functions |
| `apps/mcp` | authenticated internal MCP service |
| `packages/shared` | shared TypeScript contracts |

## Bootstrap and run

Use Node `20.10.0` from `.nvmrc`, Docker-compatible containers, and tmux.

```bash
npm ci
scripts/dev-local.sh reset
scripts/dev-local.sh up
```

The launcher starts local Supabase, Edge Functions, web, admin, MCP, and Expo in
one tmux session. See [local stack documentation](docs/development/local-stack.md)
for ports, logs, native launch commands, and troubleshooting.

## Verify

```bash
npm run verify:fast  # lint, typecheck, unit/contract tests
npm run verify:full  # fast checks, builds, Supabase integration
npm run verify:e2e   # running-stack Playwright journeys
npm run verify       # complete pre-PR gate
```

Native black-box flows use `npm run test:mobile:e2e`. Pull requests run static
and full-stack gates and retain browser traces/screenshots/videos on failure.

## Agent harness

Start with [AGENTS.md](AGENTS.md) and [the documentation index](docs/index.md).
Task/risk agent routing lives in [docs/agents/routing.md](docs/agents/routing.md),
repository skills live under `.codex/skills`, and verified lessons follow the
[learning promotion lifecycle](docs/agents/learnings.md).

Database schema changes must use committed files in `apps/supabase/migrations`.
Remote migration tools and DDL through MCP SQL execution are forbidden.
