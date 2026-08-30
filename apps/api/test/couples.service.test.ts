import type { Couple } from '@sauci/shared';
import { describe, expect, it, vi } from 'vitest';
import type { CoupleRepository } from '../src/domains/couples/repository.js';
import { CoupleService, generateInviteCode } from '../src/domains/couples/service.js';
import { CoupleError } from '../src/domains/couples/types.js';

const couple: Couple = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  invite_code: 'ABCD2345',
  created_at: '2026-08-27T00:00:00.000Z',
};

function repository(overrides: Partial<CoupleRepository> = {}): CoupleRepository {
  return {
    getState: vi.fn(async () => ({ couple: null, partner: null, sealed_count: 0 })),
    create: vi.fn(async () => couple),
    join: vi.fn(async () => couple),
    cancel: vi.fn(async () => undefined),
    close: vi.fn(async () => undefined),
    ...overrides,
  };
}

describe('CoupleService', () => {
  it('generates an eight-character unambiguous uppercase invite code', () => {
    expect(generateInviteCode(Uint8Array.from([0, 1, 2, 3, 4, 5, 6, 7]))).toBe('ABCDEFGH');
  });

  it('canonicalizes join codes and never accepts a caller-supplied owner', async () => {
    const repo = repository();
    const service = new CoupleService(repo);

    await expect(service.join('user-one', ' abcd2345 ')).resolves.toEqual({
      success: true,
      couple_id: couple.id,
    });
    expect(repo.join).toHaveBeenCalledWith('user-one', 'ABCD2345');
  });

  it('rejects malformed invite codes before repository access', async () => {
    const repo = repository();
    const service = new CoupleService(repo);

    await expect(service.join('user-one', 'short')).rejects.toMatchObject({
      code: 'invalid_invite_code',
      status: 400,
    });
    expect(repo.join).not.toHaveBeenCalled();
  });

  it('retries an invite-code collision', async () => {
    const create = vi.fn()
      .mockRejectedValueOnce(new CoupleError('invite_code_collision', 'collision', 409))
      .mockResolvedValueOnce(couple);
    const service = new CoupleService(repository({ create }));

    await expect(service.create('user-one')).resolves.toMatchObject({
      success: true,
      couple_id: couple.id,
    });
    expect(create).toHaveBeenCalledTimes(2);
    expect(create.mock.calls.every(([userId]) => userId === 'user-one')).toBe(true);
  });
});
