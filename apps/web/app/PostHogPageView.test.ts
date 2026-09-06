import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { redactInvitePaths } from './providers'

const pageViewPath = new URL('./PostHogPageView.tsx', import.meta.url)
const providerPath = new URL('./providers.tsx', import.meta.url)

describe('PostHog invite privacy boundary', () => {
  it('does not send a global page view for invite routes', async () => {
    const source = await readFile(pageViewPath, 'utf8')

    expect(source).toContain("pathname?.startsWith('/join/')")
    expect(source.indexOf("pathname?.startsWith('/join/')")).toBeLessThan(source.indexOf("posthog.capture('$pageview'"))
  })

  it('disables automatic page-leave capture and redacts join URLs', async () => {
    const source = await readFile(providerPath, 'utf8')

    expect(source).toContain('capture_pageview: false')
    expect(source).toContain('capture_pageleave: false')
    expect(source).toContain('get_current_url: redactInviteUrl')
    expect(source).toContain('before_send: redactInvitePathsBeforeSend')
    expect(source).toContain("url.pathname.startsWith('/join/')")
    expect(source).toContain('/join/[invite]')
  })

  it('removes an invite code from every serialized URL or path property', () => {
    const inviteCode = 'A4K9BT2Q'
    const event = {
      event: 'join_page_viewed',
      properties: {
        $current_url: `https://sauci.app/join/${inviteCode}`,
        $pathname: `/join/${inviteCode}`,
        $referrer: `https://sauci.app/join/${inviteCode}?source=message`,
        $session_entry_url: `https://sauci.app/join/${inviteCode}`,
        nested: { previous_path: `/join/${inviteCode}` },
      },
    }

    const serialized = JSON.stringify(redactInvitePaths(event))

    expect(serialized).not.toContain(inviteCode)
    expect(serialized).toContain('/join/[invite]')
    expect(serialized).toContain('join_page_viewed')
  })
})
