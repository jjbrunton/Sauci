import { createHash, timingSafeEqual } from 'node:crypto';
import type { AuthIdentity, AuthVerifier } from '../../auth.js';

export class AdminRequestAuth {
  private readonly serviceDigest?: Buffer;

  constructor(
    private readonly hostedAuth: AuthVerifier,
    serviceToken?: string,
    private readonly serviceUserId?: string,
  ) {
    if (Boolean(serviceToken) !== Boolean(serviceUserId)) throw new Error('Admin service token and user ID must be configured together');
    if (serviceToken && serviceToken.length < 32) throw new Error('Admin service token must contain at least 32 characters');
    this.serviceDigest = serviceToken ? createHash('sha256').update(serviceToken).digest() : undefined;
  }

  async verify(token: string): Promise<AuthIdentity> {
    if (this.serviceDigest && this.serviceUserId) {
      const candidate = createHash('sha256').update(token).digest();
      if (timingSafeEqual(candidate, this.serviceDigest)) {
        return { id: this.serviceUserId, email: null, name: 'Admin API service', avatarUrl: null };
      }
    }
    return this.hostedAuth.verify(token);
  }
}
