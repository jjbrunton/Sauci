# Internal MCP service

Hono service exposing privileged administrative tools.

- Treat the service-role key and `SAUCI_MCP_API_KEY` as secrets.
- Fail closed when MCP authentication is missing outside explicit local mode.
- Every mutation validates inputs, authorizes the operation, and writes audit
  evidence where the product contract requires it.
- Read operations preserve least privilege and avoid excessive user data.
- Add unit/API coverage for tool contract or auth changes.
- Verify lint, tests, typecheck, build, and `/health` locally.
