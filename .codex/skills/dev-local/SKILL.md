---
name: dev-local
description: Start, inspect, reset, or stop the complete local Sauci stack. Use for local development, service logs, port diagnosis, and full-stack test setup.
---

# Local Sauci stack

Use `scripts/dev-local.sh`; do not manually mix remote and local services.

| Service | Port |
|---|---:|
| web | 3000 |
| admin | 3001 |
| MCP | 3002 |
| Expo Metro | 8081 |
| Supabase API / DB / Studio | 54321 / 54322 / 54323 |

Prerequisites: Node from `.nvmrc`, `npm ci`, tmux, Docker-compatible runtime, and
the repository Supabase CLI dependency.

- `scripts/dev-local.sh up` — idempotently start infra and services.
- `status`, `logs <service>`, `restart <service>`, `attach` — inspect.
- `reset` — local-only database reset plus deterministic fixtures.
- `ios` / `android` — launch the native app against local Supabase.
- `down`; `down --all` — stop services, optionally infrastructure.

If a port is occupied, use `status` and inspect its owning process before stopping
anything. If a tmux window exited, read its logs before restarting it.
