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

  it('attempts the app scheme link and shows the raw code fallback', async () => {
    const source = await readFile(componentPath, 'utf8')

    expect(source).toContain('buildInviteSchemeUrl')
    expect(source).toContain('invite-code-display')
    expect(source).toContain('Copy code')
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
    expect(source).toContain("posthog?.capture('join_page_code_copied')")
    expect(source).toContain("posthog?.capture('join_page_store_button_clicked'")
  })

  it('shows a clear fallback message for a malformed invite code', async () => {
    const source = await readFile(componentPath, 'utf8')

    expect(source).toContain('Invite link not recognized')
  })
})
