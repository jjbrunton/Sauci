# Backend deployment and branching

Dokploy deploys the standalone backend directly from GitHub. GitHub Actions is
the verification gate; it does not hold a broad Dokploy API credential and does
not deploy the retired Supabase data plane.

## Branch contract

| Branch | Purpose | Dokploy target | Public API |
|---|---|---|---|
| feature branches | isolated reviewed work | none | none |
| `staging` | integrated release candidate | `backend-staging` | `https://api.preprod.sauci.app` |
| `main` | production promotion | `backend-production` | `https://api.sauci.app` |
| `master` | frozen legacy default | none | none |

Normal feature pull requests target `staging`. After CI and authenticated staging
acceptance pass, open a promotion pull request from `staging` to `main`. Do not
add production-only commits to `main`: production should run the exact commit
already exercised in staging. Direct pushes to either deployment branch are for
explicit incident recovery only.

Each Dokploy Compose application is connected to `jjbrunton/Sauci`, watches its
single branch with push-triggered automatic deployment, and uses
`infra/backend/compose.production.yaml`. The Compose file deliberately has no
top-level project name so Dokploy assigns different project names, networks, and
named volumes to staging and production. Never point both applications at the
same PostgreSQL or media volume.

## Promotion checks

1. GitHub `Verify / static` and `Verify / backend-integration` succeed for the
   candidate commit.
2. The Dokploy deployment for `staging` reports success; `/health/live` and
   `/health/ready` return 200 over valid TLS.
3. An unauthenticated protected request returns 401, proving the public route is
   not bypassing authentication.
4. The mobile app signs in through non-production Supabase Auth and reads real
   migrated content from `https://api.preprod.sauci.app`.
5. Promote the exact `staging` commit to `main` and verify the production health,
   TLS, and authentication boundary independently.

Health proves infrastructure, not customer-data cutover. The App Store build
must not be released against production until the controlled final sync and the
checks in [backend-cutover.md](backend-cutover.md) are complete.
