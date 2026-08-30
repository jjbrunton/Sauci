import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

const pagePath = new URL('./page.tsx', import.meta.url)

describe('/delete-account public deletion resource', () => {
  it('provides an accessible request route and the required deletion details', async () => {
    const page = await readFile(pagePath, 'utf8')

    expect(page).toContain('Delete your Sauci account')
    expect(page).toContain('mailto:privacy@sauci.app')
    expect(page).toContain('without reinstalling the app')
    expect(page).toContain('Open Sauci and go to your Profile.')
    expect(page).toContain('Choose Delete Account and follow the confirmation steps.')
    expect(page).toContain('within 30 days')
    expect(page).toContain('required for legal purposes')
    expect(page).toContain('relationship data, question responses, match data, chat messages and photos')
  })
})
