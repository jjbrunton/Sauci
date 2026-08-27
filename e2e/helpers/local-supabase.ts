import { createClient } from '@supabase/supabase-js';

export function localSupabase() {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error('Run E2E through npm run verify:e2e');
  const host = new URL(url).hostname;
  if (host !== '127.0.0.1' && host !== 'localhost') {
    throw new Error(`E2E refuses non-local Supabase host: ${host}`);
  }
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function createRedemptionFixture() {
  const client = localSupabase();
  const nonce = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const email = `redeem-${nonce}@example.test`;
  const code = `E2E-${nonce}`.toUpperCase();
  const { data: created, error: userError } = await client.auth.admin.createUser({
    email,
    password: 'Sauci-e2e-only-2026!',
    email_confirm: true,
  });
  if (userError || !created.user) throw userError ?? new Error('User creation failed');
  const { data: redemptionCode, error: codeError } = await client.from('redemption_codes').insert({
    code,
    description: 'Playwright local fixture',
    max_uses: 1,
    is_active: true,
    expires_at: new Date(Date.now() + 3_600_000).toISOString(),
  }).select().single();
  if (codeError) throw codeError;
  return { client, email, code, userId: created.user.id, codeId: redemptionCode.id };
}
