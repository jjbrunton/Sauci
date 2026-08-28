# Internal MCP service

Hono service exposing privileged administrative tools.

- Treat `SAUCI_ADMIN_API_TOKEN` and `SAUCI_MCP_API_KEY` as secrets. MCP must
  never receive a Supabase service-role key or a direct database credential.
- Fail closed when MCP authentication is missing outside explicit local mode.
- Every mutation validates inputs, authorizes the operation, and writes audit
  evidence where the product contract requires it.
- Read operations preserve least privilege and avoid excessive user data.
- Add unit/API coverage for tool contract or auth changes.
- Verify lint, tests, typecheck, build, and `/health` locally.
