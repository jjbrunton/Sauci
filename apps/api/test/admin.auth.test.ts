import { describe, expect, it, vi } from 'vitest';
import type { AuthVerifier } from '../src/auth.js';
import { AdminRequestAuth } from '../src/domains/admin/auth.js';

const hosted: AuthVerifier = { verify: vi.fn(async (token) => {
  if (token !== 'hosted') throw new Error('invalid');
  return { id: '11111111-1111-4111-8111-111111111111', email: 'admin@test', name: null, avatarUrl: null };
}) };

describe('AdminRequestAuth', () => {
  it('accepts hosted Supabase bearer identities', async () => {
    await expect(new AdminRequestAuth(hosted).verify('hosted')).resolves.toMatchObject({ id: '11111111-1111-4111-8111-111111111111' });
  });

  it('maps a stable service token to its explicit least-privilege admin actor', async () => {
    const auth = new AdminRequestAuth(hosted, 'a'.repeat(32), '22222222-2222-4222-8222-222222222222');
    await expect(auth.verify('a'.repeat(32))).resolves.toMatchObject({ id: '22222222-2222-4222-8222-222222222222' });
    await expect(auth.verify('wrong')).rejects.toThrow('invalid');
  });

  it('rejects partial or weak service-token configuration', () => {
    expect(() => new AdminRequestAuth(hosted, 'a'.repeat(32))).toThrow(/configured together/);
    expect(() => new AdminRequestAuth(hosted, 'short', '22222222-2222-4222-8222-222222222222')).toThrow(/32/);
  });
});
