# Testing strategy

Verification is layered so quick feedback stays cheap while user-facing behavior
is proved through the real stack.

## Gates

- `verify:fast`: invariant lint, workspace lint/typecheck, and unit tests.
- `verify:full`: fast gate plus builds and standalone API/PostgreSQL integration
  tests against a loopback database.
- `verify:e2e`: starts or safely reuses the documented standalone local stack,
  then runs Playwright browser flows. Native Maestro flows remain an explicit
  separate check against that stack.
- `verify`: full plus E2E; this is the pre-PR target.

The required CI checks also run instrumented coverage for the API and mobile
workspaces. Mobile coverage includes every TypeScript file under `app` and
`src`, including files no test imports. The committed thresholds are ratchets,
not targets: raise them as coverage improves, and never narrow the collected
source set to make a percentage pass.

- API unit floor: 30% statements/lines, 60% branches, 40% functions.
- API PostgreSQL integration floor: 55% statements/lines, 65% branches/functions.
- Mobile floor: 23% statements/lines, 17% branches, 21% functions.

CI runs deterministic checks on every pull request and on pushes to `staging`
and `main`. The backend integration job provisions disposable PostgreSQL and
refuses non-loopback database URLs. User-facing browser/native acceptance remains
a pre-promotion check because it requires running services and test identities.

## Test ownership

- Unit/component tests live with their workspace.
- Standalone backend integration tests live in `apps/api/test`.
- `apps/supabase/tests` cover the retired data plane and are not a deployment gate.
- Cross-application browser tests live in `e2e`.
- Native black-box flows live in `e2e/maestro`.

E2E product-data endpoints and fixture databases must be loopback, never
production or staging. The browser redemption flow uses a disposable local
PostgreSQL fixture and verifies the API's resulting state, rather than the
retired Supabase data plane. Authenticated native acceptance uses the designated
non-production hosted Auth project and disposable fixture users.
