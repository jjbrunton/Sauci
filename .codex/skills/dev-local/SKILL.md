---
name: dev-local
description: Start, inspect, reset, or stop the complete local Sauci stack. Use for local development, service logs, port diagnosis, and full-stack test setup.
---

# Local Sauci stack

Use `scripts/dev-local.sh`; do not manually mix remote and local services.

| Service | Port |
|---|---:|
| PostgreSQL | 54320 |
| API | 3003 |
| web | 3000 (overridable with `SAUCI_WEB_PORT`) |
| admin | 3001 (overridable with `SAUCI_ADMIN_PORT`) |
| MCP | 3002 (overridable with `SAUCI_MCP_PORT`) |
| Expo Metro | 8081 |

Prerequisites: Node from `.nvmrc`, `npm ci`, tmux, Docker-compatible runtime,
and the configured hosted Auth credentials where an authenticated client needs them.

- `scripts/dev-local.sh up`: idempotently start PostgreSQL and services.
- `status`, `logs <service>`, `restart <service>`, `attach`: inspect.
- `reset`: local-only database reset plus deterministic fixtures.
- `e2e`: start or safely reuse the local stack, validate local endpoints, and
  run Playwright with launcher-derived URLs and a loopback PostgreSQL fixture.
- `ios` / `android`: launch the native app against the standalone local API and
  configured hosted Auth project.
- `down`; `down --all`: stop services, optionally infrastructure.

Hosted Supabase provides Auth only. Local E2E never starts or writes to a
Supabase data plane. If a port is occupied, use `status` and inspect its owning
process before stopping anything. If a tmux window exited, read its logs before
restarting it.
