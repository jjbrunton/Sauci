# Account operations and billing

This domain replaces the `delete-relationship`, `reset-couple-progress`,
`delete-account`, and `sync-subscription` Supabase Edge Functions. The request
identity always comes from the verified bearer token; no route accepts a user or
couple identifier from the client.

## Server-only configuration

- `SUPABASE_AUTH_URL`: hosted Supabase project URL (or its `/auth/v1`
  endpoint), used only for Auth.
- `SUPABASE_AUTH_SERVICE_ROLE_KEY`: server-side Auth Admin credential required
  for account deletion. Never expose this as an `EXPO_PUBLIC_*` value.
- `REVENUECAT_API_KEY`: secret RevenueCat REST API key used to verify the token
  owner's entitlement.
- `REVENUECAT_ENTITLEMENT_ID`: entitlement checked by sync; defaults to
  `Sauci Pro` to preserve the previous function behavior.

Missing provider secrets fail the affected operation with `503` before any
durable local change. Account deletion holds its local transaction open until
hosted Auth confirms deletion, and rolls the transaction back on Auth failure.
Provider error bodies are not returned to the mobile app.

## Application wiring

Create one `PostgresAccountOperationsRepository`, then construct:

```ts
const accountOperationsService = new AccountOperationsService(
  accountOperationsRepository,
  new SupabaseAuthAdminClient(process.env.SUPABASE_AUTH_URL, process.env.SUPABASE_AUTH_SERVICE_ROLE_KEY),
  new HttpRevenueCatClient(process.env.REVENUECAT_API_KEY, process.env.REVENUECAT_ENTITLEMENT_ID),
  new ExpoPartnerNotifier(),
);
```

Pass it to the app and call `registerAccountOperationRoutes`. Close the
repository during graceful shutdown. No schema migration is required for these
four operations: they use `profiles`, `couples`, `responses`, and `matches`.

Blob deletion must be handled by the self-hosted media/storage lifecycle when
that vertical is wired. These operations intentionally never call the hosted
Supabase database, Storage API, or Edge Functions.
