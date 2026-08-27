# Shared contracts

`@sauci/shared` contains cross-application TypeScript types and constants only.

- No runtime services, state, or application-specific behavior.
- Export public contracts through `src/index.ts`.
- Prefer generated Supabase types over duplicated handwritten database shapes.
- Update every consumer when a shared contract changes.
- Do not add production dependencies without an explicit architecture decision.
