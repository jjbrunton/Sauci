# Sauci administrative MCP

The MCP service exposes 46 internal tools through eight groups: content (12),
users (7), moderation (5), redemption codes (5), administrators (5), analytics
(4), configuration (4), and feedback (4).

MCP does not connect to PostgreSQL, Supabase data APIs, or object storage. Tool
requests are translated to the standalone API's `/v1/admin/*` contract. That
API is responsible for resource allowlisting, permission checks, transactions,
and mutation audit evidence. Relationship-shaped results required by existing
tools are assembled from allowlisted API queries.

## Environment

- `SAUCI_MCP_API_KEY`: bearer credential accepted from MCP callers.
- `SAUCI_ADMIN_API_URL`: standalone API base URL. Cleartext HTTP is rejected
  except for loopback development.
- `SAUCI_ADMIN_API_TOKEN`: opaque API service credential. The API maps it to
  the active administrator configured by `ADMIN_API_SERVICE_USER_ID`.

The two bearer credentials serve different trust boundaries and must not be
reused. Missing admin API configuration fails when any data tool is invoked;
missing MCP caller authentication fails closed at the HTTP boundary.
