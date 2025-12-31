# Web App - Agent Guidelines

**STRICT RULES - DO NOT VIOLATE**

## Architecture

This is a Next.js 14+ marketing/landing website using:
- **Framework**: Next.js with App Router
- **Styling**: Tailwind CSS
- **Analytics**: PostHog
- **Routing**: File-based routing in `app/` directory

## Directory Structure

```
app/
  layout.tsx            # Root layout with PostHog provider
  page.tsx              # Home/landing page
  globals.css           # Global styles
  providers.tsx         # PostHog provider wrapper
  PostHogPageView.tsx   # Page view tracking component
  privacy/              # Privacy policy
  terms/                # Terms of service
  redeem/               # Code redemption page
components/             # Reusable components
public/                 # Static assets (images, fonts)
```

## Critical Rules

### App Router

This uses Next.js App Router (not Pages Router):
- Server Components by default
- Use `'use client'` directive for client components
- Metadata exported from layout.tsx and page.tsx

### PostHog Integration

PostHog is configured at root level:
- Provider in `providers.tsx`
- Page view tracking in `PostHogPageView.tsx`
- Wrap all pages in `<PostHogProvider>`

### SEO & Metadata

Metadata is defined in `layout.tsx`:
```typescript
export const metadata: Metadata = {
  title: 'Sauci - Ignite Your Connection',
  description: '...',
  openGraph: { ... },
  twitter: { ... },
};
```

Update metadata when adding new pages.

### Styling

- Use Tailwind CSS classes
- Global styles in `globals.css`
- Follow mobile-first responsive design

### Static Pages

Privacy and Terms pages are static content:
- `/privacy` - Privacy policy
- `/terms` - Terms of service

Keep these updated with legal requirements.

### Environment Variables

Required environment variables:
- `NEXT_PUBLIC_POSTHOG_KEY` - PostHog API key
- `NEXT_PUBLIC_POSTHOG_HOST` - PostHog host

## Forbidden Actions

1. **DO NOT** remove PostHog tracking without approval
2. **DO NOT** use Pages Router patterns (use App Router)
3. **DO NOT** add server-side API routes that expose sensitive data
4. **DO NOT** forget to update metadata for new pages
5. **DO NOT** skip mobile responsiveness
6. **DO NOT** commit .env files with real API keys
