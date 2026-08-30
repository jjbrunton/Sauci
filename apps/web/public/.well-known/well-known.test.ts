import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

const aasaPath = new URL('./apple-app-site-association', import.meta.url)
const assetlinksPath = new URL('./assetlinks.json', import.meta.url)

describe('apple-app-site-association', () => {
  it('is valid JSON that covers /join/*', async () => {
    const raw = await readFile(aasaPath, 'utf8')
    const data = JSON.parse(raw)

    expect(data.applinks.details).toHaveLength(1)
    expect(data.applinks.details[0].paths).toContain('/join/*')
    // com.sauci.app matches apps/mobile/app.json ios.bundleIdentifier.
    expect(data.applinks.details[0].appID).toMatch(/\.com\.sauci\.app$/)
  })
})

describe('assetlinks.json', () => {
  it('is valid JSON that targets the Android package', async () => {
    const raw = await readFile(assetlinksPath, 'utf8')
    const data = JSON.parse(raw)

    expect(data[0].target.package_name).toBe('com.sauci.app')
    expect(data[0].target.namespace).toBe('android_app')
    // Must be the Play App Signing key certificate fingerprint (Play Console >
    // Test and release > Setup > App signing), colon-separated uppercase hex.
    expect(data[0].target.sha256_cert_fingerprints[0]).toMatch(/^([0-9A-F]{2}:){31}[0-9A-F]{2}$/)
  })
})
