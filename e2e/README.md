# System E2E

Tests assume `scripts/dev-local.sh up` is already running. Execute with
`npm run verify:e2e`; the wrapper supplies local-only Supabase credentials and
refuses remote hosts. Playwright retains traces, screenshots, and videos on
failure under ignored output directories.

Native flows live under `maestro/` and run with `npm run test:mobile:e2e` after an
iOS or Android build is installed.
