import { mkdir, writeFile } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) throw new Error('Local Supabase environment is required');
const host = new URL(url).hostname;
if (host !== '127.0.0.1' && host !== 'localhost') {
  throw new Error(`Refusing to seed non-local Supabase host: ${host}`);
}

const client = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const password = 'Sauci-e2e-only-2026!';
const emails = ['e2e.alex@example.test', 'e2e.sam@example.test'];

const { data: listed, error: listError } = await client.auth.admin.listUsers({ perPage: 1000 });
if (listError) throw listError;
for (const user of listed.users.filter((candidate) => emails.includes(candidate.email ?? ''))) {
  const { error } = await client.auth.admin.deleteUser(user.id);
  if (error) throw error;
}

const users = [];
for (const email of emails) {
  const { data, error } = await client.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: email.includes('alex') ? 'Alex E2E' : 'Sam E2E' },
  });
  if (error || !data.user) throw error ?? new Error(`Could not create ${email}`);
  users.push(data.user);
}

const coupleId = 'e2e00000-0000-4000-8000-000000000001';
const packId = 'e2e00000-0000-4000-8000-000000000002';
const questionId = 'e2e00000-0000-4000-8000-000000000003';
await client.from('couples').delete().eq('id', coupleId);
let result = await client.from('couples').insert({ id: coupleId, invite_code: 'E2E2026A' });
if (result.error) throw result.error;
result = await client.from('profiles').update({ couple_id: coupleId }).in('id', users.map((user) => user.id));
if (result.error) throw result.error;
result = await client.from('question_packs').upsert({
  id: packId,
  name: 'E2E Connection Pack',
  description: 'Deterministic local verification content',
  is_premium: false,
  is_public: true,
  sort_order: 999,
});
if (result.error) throw result.error;
result = await client.from('questions').upsert({
  id: questionId,
  pack_id: packId,
  text: 'Plan a technology-free evening together',
  intensity: 1,
});
if (result.error) throw result.error;
result = await client.from('redemption_codes').upsert({
  code: 'SAUCI-E2E-2026',
  max_uses: 100,
  current_uses: 0,
  is_active: true,
  expires_at: '2099-01-01T00:00:00.000Z',
});
if (result.error) throw result.error;

await mkdir(new URL('../e2e/.auth/', import.meta.url), { recursive: true });
await writeFile(new URL('../e2e/.auth/fixtures.json', import.meta.url), JSON.stringify({
  users: emails.map((email, index) => ({ email, password, id: users[index].id })),
  coupleId,
  inviteCode: 'E2E2026A',
  packId,
  questionId,
  redemptionCode: 'SAUCI-E2E-2026',
}, null, 2));

console.log('Created deterministic local E2E fixtures');
