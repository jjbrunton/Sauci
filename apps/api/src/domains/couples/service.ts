import { randomBytes, randomUUID } from 'node:crypto';
import type { CoupleRepository } from './repository.js';
import { CoupleError, type CoupleMutationResponse, type CoupleStateResponse } from './types.js';

const inviteAlphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateInviteCode(bytes: Uint8Array = randomBytes(8)): string {
  return Array.from(bytes, (byte) => inviteAlphabet[byte % inviteAlphabet.length]).join('').slice(0, 8);
}

export class CoupleService {
  constructor(private readonly repository: CoupleRepository) {}

  getState(userId: string): Promise<CoupleStateResponse> {
    return this.repository.getState(userId);
  }

  async create(userId: string): Promise<CoupleMutationResponse> {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const inviteCode = generateInviteCode();
      try {
        const couple = await this.repository.create(userId, randomUUID(), inviteCode);
        return { success: true, couple_id: couple.id, invite_code: couple.invite_code };
      } catch (error) {
        if (!(error instanceof CoupleError) || error.code !== 'invite_code_collision') throw error;
      }
    }
    throw new Error('Unable to allocate a unique invite code');
  }

  async join(userId: string, inviteCode: string): Promise<CoupleMutationResponse> {
    const canonicalCode = inviteCode.trim().toUpperCase();
    if (!/^[A-Z0-9]{8}$/.test(canonicalCode)) {
      throw new CoupleError('invalid_invite_code', 'Invalid invite code format', 400);
    }
    const couple = await this.repository.join(userId, canonicalCode);
    return { success: true, couple_id: couple.id };
  }

  async cancel(userId: string): Promise<CoupleMutationResponse> {
    await this.repository.cancel(userId);
    return { success: true, couple_id: null };
  }
}
