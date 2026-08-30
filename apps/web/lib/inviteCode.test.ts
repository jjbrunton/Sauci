import { describe, expect, it } from 'vitest'
import { isValidInviteCode, normalizeInviteCode } from './inviteCode'

describe('isValidInviteCode', () => {
  it('accepts 8-character alphanumeric codes', () => {
    expect(isValidInviteCode('ABCD1234')).toBe(true)
    expect(isValidInviteCode('abcd1234')).toBe(true)
  })

  it('rejects codes with the wrong length or characters', () => {
    expect(isValidInviteCode('ABC123')).toBe(false)
    expect(isValidInviteCode('ABCD12345')).toBe(false)
    expect(isValidInviteCode('ABCD-123')).toBe(false)
    expect(isValidInviteCode('')).toBe(false)
    expect(isValidInviteCode(null)).toBe(false)
    expect(isValidInviteCode(undefined)).toBe(false)
  })
})

describe('normalizeInviteCode', () => {
  it('trims and uppercases', () => {
    expect(normalizeInviteCode('  abcd1234  ')).toBe('ABCD1234')
  })
})
