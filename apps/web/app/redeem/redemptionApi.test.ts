import { afterEach, describe, expect, it, vi } from 'vitest'
import { redeemCode } from './redemptionApi'

describe('redeemCode', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('posts only the public redemption fields to the standalone API', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_URL', 'http://127.0.0.1:3003/')
    const request = vi.fn(async () => Response.json({ success: true, message: 'redeemed' }))
    vi.stubGlobal('fetch', request)

    await expect(redeemCode('alice@example.test', 'PROMO')).resolves.toEqual({
      success: true,
      message: 'redeemed',
    })
    expect(request).toHaveBeenCalledWith('http://127.0.0.1:3003/public/v1/redemptions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'alice@example.test', code: 'PROMO' }),
    })
  })

  it('fails closed instead of falling back to hosted Supabase', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_URL', '')
    const request = vi.fn()
    vi.stubGlobal('fetch', request)
    await expect(redeemCode('alice@example.test', 'PROMO')).rejects.toThrow('NEXT_PUBLIC_API_URL')
    expect(request).not.toHaveBeenCalled()
  })
})

