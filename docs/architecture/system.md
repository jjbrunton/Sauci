# System architecture

Sauci is an npm workspace coordinated by Turborepo.

| Component | Technology | Responsibility |
|---|---|---|
| Mobile | Expo / React Native / Expo Router | primary customer product |
| Admin | Vite / React | content and administrative operations |
| Web | Next.js App Router | marketing, policies, redemption |
| Backend | Supabase Postgres/Auth/Realtime/Edge Functions | identity, data, workflows |
| MCP | Hono / MCP SDK | authenticated internal administrative tools |
| Shared | TypeScript types | cross-application contracts only |

## Trust boundaries

- Mobile and web use public Supabase credentials and depend on RLS.
- Administrative access requires both an authenticated identity and role checks.
- Service-role edge functions authenticate and authorize callers before user-data
  operations.
- MCP has privileged access and requires `SAUCI_MCP_API_KEY`; absent credentials
  must never make a non-local deployment public.
- Local verification uses local Supabase, never a remote project.

## Product flow

Two profiles join a couple, answer questions independently, and the
`submit-response` edge function creates a match when answers are compatible.
Realtime subscriptions surface matches and chat messages to the partner.

## Change boundaries

- Database shape: migration plus generated/shared types plus affected clients.
- Edge function contract: function tests plus calling UI/store behavior.
- Shared contract: update every consumer in the same change.
- UI flow: component/unit coverage and observable E2E evidence.
