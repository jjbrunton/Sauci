import 'dotenv/config';
import { Pool } from 'pg';
import { z } from 'zod';
import { PostgresRepository } from './repository.js';

const schema = z.object({
  DATABASE_URL: z.string().url(),
  SEED_USER_ID: z.string().uuid().optional(),
  SEED_USER_EMAIL: z.string().email().default('local@sauci.test'),
  SEED_ADMIN_USER_ID: z.string().uuid().default('00000000-0000-4000-8000-000000000002'),
  SEED_ADMIN_USER_EMAIL: z.string().email().default('local-admin@sauci.test'),
});

const env = schema.parse(process.env);
const databaseUrl = new URL(env.DATABASE_URL);
if (!['127.0.0.1', 'localhost', '::1'].includes(databaseUrl.hostname)) {
  throw new Error('db:seed only permits a localhost DATABASE_URL');
}

const repository = new PostgresRepository(env.DATABASE_URL);
const pool = new Pool({ connectionString: env.DATABASE_URL });
try {
  if (env.SEED_USER_ID) await repository.upsertProfile({
    id: env.SEED_USER_ID, email: env.SEED_USER_EMAIL, name: 'Local Sauci User', avatarUrl: null,
  });
  await repository.upsertProfile({
    id: env.SEED_ADMIN_USER_ID,
    email: env.SEED_ADMIN_USER_EMAIL,
    name: 'Local Sauci Admin Service',
    avatarUrl: null,
  });
  await pool.query(`
    insert into admin_users(user_id,role,permissions,is_active)
    values($1,'super_admin','{}',true)
    on conflict(user_id) do update set role='super_admin',is_active=true,updated_at=now()
  `, [env.SEED_ADMIN_USER_ID]);
  console.log(`Seeded local admin service profile ${env.SEED_ADMIN_USER_ID}`);
  if (env.SEED_USER_ID) console.log(`Seeded local profile ${env.SEED_USER_ID}`);
} finally {
  await Promise.all([repository.close(), pool.end()]);
}
