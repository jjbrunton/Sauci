// Shared invite code shape validation for the web join page. Mirrors the
// mobile app's invite code shape (apps/mobile/src/lib/inviteLink.ts) and the
// standalone API's invite_code column. This module only validates the shape
// client-side; it never calls a private API.

const INVITE_CODE_PATTERN = /^[A-Za-z0-9]{8}$/

export function isValidInviteCode(code: string | null | undefined): boolean {
  if (!code) return false
  return INVITE_CODE_PATTERN.test(code.trim())
}

export function normalizeInviteCode(code: string): string {
  return code.trim().toUpperCase()
}
