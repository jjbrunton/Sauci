import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

const providerPath = new URL('./providers.tsx', import.meta.url)

describe('PostHogProvider invite privacy', () => {
  it('disables DOM autocapture and session recording on invite routes', async () => {
    const source = await readFile(providerPath, 'utf8')

    expect(source).toContain("pathname?.startsWith('/join/')")
    expect(source).toContain("window.location.pathname.startsWith('/join/')")
    expect(source).toContain('autocapture: !isInvitePage')
    expect(source).toContain('disable_session_recording: isInvitePage')
    expect(source).toContain('mask_all_text: isInvitePage')
  })
})
