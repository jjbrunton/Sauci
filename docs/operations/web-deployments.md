# Website deployment

Dokploy deploys the public Sauci website from the `main` branch using
`apps/web/docker-compose.prod.yml`. The Compose file builds from the repository
root so the Docker build can use the committed workspace lockfile. Its Dockerfile
builds `@sauci/web` and runs the Next standalone server from its workspace path.

## Required configuration

`NEXT_PUBLIC_API_URL` is required at build time and must be the intended public
standalone API URL. `NEXT_PUBLIC_POSTHOG_KEY` is optional. When it is set,
`NEXT_PUBLIC_POSTHOG_HOST` defaults to `https://eu.i.posthog.com` unless Dokploy
provides a different value. These public values are inlined into the Next build;
do not place server credentials in them.

## Promotion and acceptance

Promote the verified website commit to `main` before allowing Dokploy to deploy
it. After the deployment reports success, verify valid TLS and HTTP 200 for:

- `https://sauci.app/`
- `https://sauci.app/delete-account`

The second check is required for the Google Play account-deletion resource. A
successful Dokploy deployment alone is not sufficient evidence that either URL
is publicly reachable.
