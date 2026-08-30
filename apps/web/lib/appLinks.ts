// App store and deep-link destinations used by the invite join page
// (apps/web/app/join/[code]/page.tsx). These are the real, live listing URLs
// already used by components/Hero.tsx, components/CTA.tsx,
// components/Navbar.tsx, and components/Pricing.tsx.

export const APP_STORE_URL = 'https://apps.apple.com/gb/app/sauci-couple-games-romance/id6757159885'
export const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.sauci.app'

export function buildInviteSchemeUrl(code: string): string {
  return `app.sauci://join?code=${encodeURIComponent(code)}`
}

export function buildInviteUniversalUrl(code: string): string {
  return `https://sauci.app/join/${encodeURIComponent(code)}`
}
