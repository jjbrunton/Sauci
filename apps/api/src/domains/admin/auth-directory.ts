import { z } from 'zod';

type Fetch = typeof globalThis.fetch;

const authUser = z.object({
  id: z.string().uuid(),
  email: z.string().nullable().optional(),
  last_sign_in_at: z.string().nullable().optional(),
  email_confirmed_at: z.string().nullable().optional(),
  confirmed_at: z.string().nullable().optional(),
}).passthrough();

export type AdminAuthUser = {
  id: string;
  email: string | null;
  last_sign_in_at: string | null;
  email_confirmed_at: string | null;
};

export interface AdminAuthDirectory {
  users(userId?: string): Promise<AdminAuthUser[]>;
}

export class SupabaseAdminAuthDirectory implements AdminAuthDirectory {
  constructor(
    private readonly authUrl: string | undefined,
    private readonly serviceRoleKey: string | undefined,
    private readonly request: Fetch = globalThis.fetch,
  ) {}

  async users(userId?: string): Promise<AdminAuthUser[]> {
    if (!this.authUrl || !this.serviceRoleKey) return [];
    const base = this.authUrl.replace(/\/$/, '').replace(/\/auth\/v1$/, '');
    const url = userId
      ? `${base}/auth/v1/admin/users/${encodeURIComponent(userId)}`
      : `${base}/auth/v1/admin/users?page=1&per_page=1000`;
    const response = await this.request(url, {
      headers: { apikey: this.serviceRoleKey, authorization: `Bearer ${this.serviceRoleKey}` },
      signal: AbortSignal.timeout(10_000),
    }).catch(() => null);
    if (!response?.ok) return [];
    const payload = await response.json().catch(() => null);
    const candidates = userId ? [payload] : z.object({ users: z.array(z.unknown()) }).safeParse(payload).data?.users ?? [];
    return candidates.flatMap((candidate) => {
      const parsed = authUser.safeParse(candidate); if (!parsed.success) return [];
      return [{
        id: parsed.data.id,
        email: parsed.data.email ?? null,
        last_sign_in_at: parsed.data.last_sign_in_at ?? null,
        email_confirmed_at: parsed.data.email_confirmed_at ?? parsed.data.confirmed_at ?? null,
      }];
    });
  }
}
