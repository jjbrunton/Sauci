import type { Couple, Profile } from '@sauci/shared';

export interface CoupleStateResponse {
  couple: Couple | null;
  partner: Profile | null;
}

export interface CoupleMutationResponse {
  success: true;
  couple_id: string | null;
  invite_code?: string;
}

export type CoupleErrorCode =
  | 'profile_not_found'
  | 'already_paired'
  | 'invalid_invite_code'
  | 'couple_full'
  | 'not_paired'
  | 'invite_code_collision';

export class CoupleError extends Error {
  constructor(
    readonly code: CoupleErrorCode,
    message: string,
    readonly status: 400 | 404 | 409,
  ) {
    super(message);
    this.name = 'CoupleError';
  }
}
