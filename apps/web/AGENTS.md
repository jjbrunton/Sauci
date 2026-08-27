# Web application

Next.js App Router marketing, legal, and redemption UI.

- Prefer server components; add `use client` only when browser state is needed.
- Preserve PostHog provider/page-view integration unless the task changes it.
- Keep metadata current for public pages.
- Never expose server credentials through `NEXT_PUBLIC_*` variables.
- Public redemption must use sandbox/local Supabase during automated tests.
- Verify lint, typecheck, build, and the relevant Playwright flow.
