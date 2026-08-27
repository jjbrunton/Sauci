# Admin application

Vite/React administration UI. Use existing layout, route, and Supabase client
patterns before introducing abstractions.

- `pack_creator` manages permitted content; `super_admin` can access privileged
  user/admin/audit surfaces.
- Enforce role checks in both route visibility and the backend/RLS boundary.
- Administrative mutations must remain auditable.
- Use `.maybeSingle()` when zero rows are valid.
- Never expose credentials, tokens, or private user content unnecessarily.
- Add accessible labels and a focused test for changed behavior.
- Verify with `npm run lint -w @sauci/admin`, `npm run typecheck -w
  @sauci/admin`, and `npm run build -w @sauci/admin`.
