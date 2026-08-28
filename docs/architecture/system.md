# System architecture

Sauci is an npm workspace coordinated by Turborepo.

| Component | Technology | Responsibility |
|---|---|---|
| Mobile | Expo / React Native / Expo Router | primary customer product |
| Admin | Vite / React | content and administrative operations |
| Web | Next.js App Router | marketing, policies, redemption |
| API | Node.js / Hono / PostgreSQL | customer data, authorization, and workflows |
| Worker | Node.js / PostgreSQL-backed jobs | scheduled and asynchronous work |
| Auth | Hosted Supabase Auth | identity issuance and account recovery only |
| MCP | Hono / MCP SDK | authenticated internal administrative tools |
| Shared | TypeScript types | cross-application contracts only |

## Trust boundaries

- Mobile and web use public Supabase credentials only for Auth. Application data
  is available exclusively through the versioned Sauci API.
- The API verifies Supabase access tokens against the hosted public JWKS and
  derives user, couple, and administrative authority server-side.
- PostgreSQL and object storage are private infrastructure and are never exposed
  directly to clients.
- Administrative access requires both an authenticated identity and role checks.
- The hosted Auth service-role credential is confined to the API's Auth Admin
  account-deletion and identity-enrichment calls; it is not a product-data
  credential and is not provided to the worker, MCP, or clients.
- MCP authenticates callers with `SAUCI_MCP_API_KEY`, then calls the standalone
  admin API using `SAUCI_ADMIN_API_URL` and a scoped `SAUCI_ADMIN_API_TOKEN`.
  It has no database, Supabase data-plane, or storage credentials. The API maps
  the service token to an active admin identity and owns authorization and audit
  evidence for every mutation.
- Local product-data verification uses only loopback PostgreSQL/API services.
  Authenticated native acceptance may use only the designated hosted
  non-production Auth project and disposable fixture identities, never production.

## Product flow

Two profiles join a couple, answer questions independently, and an API
transaction creates a match when answers are compatible. Authenticated domain
events surface matches and chat messages to the partner.

## Change boundaries

- Database shape: API-owned migration plus shared contracts and affected clients.
- API contract: integration tests plus calling UI/store behavior.
- Shared contract: update every consumer in the same change.
- UI flow: component/unit coverage and observable E2E evidence.
