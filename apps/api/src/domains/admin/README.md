# Admin API

Browser administrators authenticate with hosted Supabase Auth. The API then
loads the active `admin_users` row for the token subject and enforces each role
permission again server-side. UI role state is never trusted for authorization.

Non-browser clients can use `ADMIN_API_SERVICE_TOKEN` with
`ADMIN_API_SERVICE_USER_ID`. The opaque token is compared in constant time and
maps to an explicit active `admin_users` record, so its permissions and audit
actor are identical to a browser administrator. It does not grant Supabase
service-role access.

Every generic mutation is transacted with an `audit_logs` write. Sensitive
fields are redacted from audit payloads. Admin data routes are resource-
whitelisted; arbitrary table names are rejected.

Central application wiring must exempt `/v1/admin/*` from the general hosted
Auth middleware and pass `AdminRequestAuth` to `registerAdminRoutes`, which
accepts either hosted JWTs or the configured service token.

`SupabaseAdminAuthDirectory` may use the existing server-side Auth Admin
credential to enrich `/v1/admin/users` with email confirmation and last sign-in
timestamps. It talks only to hosted Auth, never the Supabase data plane, and
degrades to explicit null metadata when the credential or provider is absent.

`GET /v1/admin/media/:mediaId/url` requires `view_media` and issues a five-minute
signed URL with `private, no-store` response caching. The object must exist and
not be marked deleted. The opaque service credential can therefore request a
URL without being accepted by customer media authorization.
