# Testing strategy

Verification is layered so quick feedback stays cheap while user-facing behavior
is proved through the real stack.

## Gates

- `verify:fast`: invariant lint, workspace lint/typecheck, and unit tests.
- `verify:full`: fast gate plus builds and local Supabase function tests when the
  required local tools are present.
- `verify:e2e`: Playwright browser flows and native Maestro flows against an
  already-running local stack.
- `verify`: full plus E2E; this is the pre-PR target.

CI runs deterministic checks on every pull request. Running-stack tests use a
separate job because they require Docker/Supabase and produce traces,
screenshots, and videos as artifacts.

## Test ownership

- Unit/component tests live with their workspace.
- Supabase function integration tests live in `apps/supabase/tests`.
- Cross-application browser tests live in `e2e`.
- Native black-box flows live in `e2e/maestro`.

E2E must use local or sandbox endpoints. Tests refuse non-local Supabase URLs.
Authentication is proved once through the public flow; reusable fixture sessions
avoid repeating auth in unrelated scenarios.
