import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

const componentPath = new URL('./JoinClient.tsx', import.meta.url)

describe('/join/[code] JoinClient', () => {
  it('validates the code shape client-side without calling a private API', async () => {
    const source = await readFile(componentPath, 'utf8')

    expect(source).toContain("isValidInviteCode(code)")
    expect(source).not.toMatch(/\/public\/v1\//)
    expect(source).not.toMatch(/fetch\(/)
  })

  it('only attempts the app scheme link after an explicit Open in Sauci action', async () => {
    const source = await readFile(componentPath, 'utf8')

    expect(source).toContain('buildInviteSchemeUrl')
    expect(source).toContain('Open in Sauci')
    expect(source.indexOf('const handleOpenInApp')).toBeLessThan(source.indexOf('window.location.href = buildInviteSchemeUrl'))
    expect(source).toContain('invite-code-display')
  })

  it('copies only the raw code, not a share message', async () => {
    const source = await readFile(componentPath, 'utf8')

    expect(source).toContain('navigator.clipboard.writeText(normalizedCode)')
  })

  it('links to both app stores', async () => {
    const source = await readFile(componentPath, 'utf8')

    expect(source).toContain('APP_STORE_URL')
    expect(source).toContain('PLAY_STORE_URL')
  })

  it('instruments the funnel with PostHog page view, copy, and store-click events', async () => {
    const source = await readFile(componentPath, 'utf8')

    expect(source).toContain("posthog?.capture('join_page_viewed'")
    expect(source).toContain("posthog?.capture('join_page_code_copied'")
    expect(source).toContain("posthog?.capture('join_page_store_button_clicked'")
    expect(source).toContain("posthog?.capture('join_page_open_app_clicked'")
    expect(source).toContain("posthog?.capture('join_page_open_app_fallback_shown'")
    expect(source).toContain("posthog?.capture('join_page_offline_shown'")
  })

  it('does not put an invite code in a PostHog payload', async () => {
    const source = await readFile(componentPath, 'utf8')

    expect(source).not.toMatch(/posthog\?\.capture\([^)]*normalizedCode/)
    expect(source).not.toMatch(/posthog\?\.capture\([^)]*\bcode\s*:/)
  })

  it('uses the required recovery and accessibility states', async () => {
    const source = await readFile(componentPath, 'utf8')

    expect(source).toContain('Copy this before you install')
    expect(source).toContain('setTimeout(() =>')
    expect(source).toContain('}, 1500)')
    expect(source).toContain("document.visibilityState === 'visible'")
    expect(source).toContain("aria-live=\"polite\"")
    expect(source).toContain('navigator.onLine')
    expect(source).toContain('surface-solid')
    expect(source).not.toContain('glass-light')
  })

  it('shows a clear fallback message for a malformed invite code', async () => {
    const source = await readFile(componentPath, 'utf8')

    expect(source).toContain('Invite link not recognized')
    expect(source).not.toContain('has expired')
  })
})
