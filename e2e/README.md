# System E2E

Execute with `npm run verify:e2e`. The command starts the documented standalone
local stack, waits for API, web, admin, and MCP health, and supplies Playwright
with the ports selected by `scripts/dev-local.sh`. Product-data fixtures use only
the loopback standalone PostgreSQL database and assert the visible web result
plus the resulting database state. It never starts or writes to the retired
Supabase data plane.

To reuse a stack that the same local-stack configuration already manages, set
`SAUCI_E2E_REUSE=true`. The command still requires the approved local/non-production
Auth URL, loopback PostgreSQL, and all four local services to be healthy. Keep
the same `SAUCI_*_PORT` overrides that were used to start that stack; do not pass
ad-hoc `WEB_URL`, `ADMIN_URL`, or `MCP_URL` values.

Playwright retains traces, screenshots, and videos on failure under ignored
output directories.

Native flows live under `maestro/` and run with `npm run test:mobile:e2e` after an
iOS or Android build is installed. `login-screen-smoke.yaml` is credential-free.
`login-smoke.yaml` requires `E2E_EMAIL` and `E2E_PASSWORD` for a disposable,
onboarding-complete user in the designated hosted non-production Supabase Auth
project, with a matching standalone database profile. Never use production Auth,
a subscriber account, or a service-role key for local/E2E acceptance.
