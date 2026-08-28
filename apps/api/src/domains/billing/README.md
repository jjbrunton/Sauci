# Billing and redemption

This domain owns RevenueCat webhook persistence and public promotional-code
redemption. Neither route uses the hosted Supabase data plane.

- `POST /webhooks/revenuecat` requires an exact
  `Authorization: Bearer <REVENUECAT_WEBHOOK_SECRET>` header. A missing server
  secret disables the webhook with `503`; it never becomes unauthenticated.
- `POST /public/v1/redemptions` accepts `{ email, code }` for the public web
  redemption form. Validation, remaining-use checks, redemption recording, and
  the premium grant run in one database transaction.

Both public endpoints have request-body limits (1 MiB for provider webhooks and
16 KiB for redemption). Webhook authorization is checked before JSON parsing.
Because the API cannot independently authenticate a proxy-supplied client IP,
redemption also uses a database-backed global ceiling of 60 attempts per minute
across all replicas. The production reverse proxy must additionally apply a
per-client-IP limit; forwarded-IP headers must not be trusted from the public
internet unless the proxy strips and rewrites them.

Webhook event insertion, subscription upsert, premium recomputation, and any
premium-pack disabling are atomic. The unique event ID makes provider retries
idempotent. A known event for an unknown user rolls back the event record so a
later retry can succeed after identity reconciliation. Unknown and `TEST` events
are recorded once and acknowledged without changing subscription state.

Wire a `PostgresBillingRepository`, construct `BillingService` with the
server-only `REVENUECAT_WEBHOOK_SECRET`, call `registerBillingRoutes`, and close
the repository during graceful shutdown. The web app should receive the API base
URL via `NEXT_PUBLIC_API_URL`; no server secret belongs in a `NEXT_PUBLIC_*`
variable.

Rate-limit the public redemption endpoint by client IP at the trusted reverse
proxy. The API limits request size and atomically locks codes, but deliberately
does not trust arbitrary forwarded-IP headers on its own.
