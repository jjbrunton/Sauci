# System E2E

Tests assume `scripts/dev-local.sh up` is already running. Execute with
`npm run verify:e2e`; application data must use the loopback standalone API and
PostgreSQL. Playwright retains traces, screenshots, and videos on failure under
ignored output directories.

Native flows live under `maestro/` and run with `npm run test:mobile:e2e` after an
iOS or Android build is installed. `login-screen-smoke.yaml` is credential-free.
`login-smoke.yaml` requires `E2E_EMAIL` and `E2E_PASSWORD` for a disposable,
onboarding-complete user in the designated hosted non-production Supabase Auth
project, with a matching standalone database profile. Never use production Auth,
a subscriber account, or a service-role key for local/E2E acceptance.
