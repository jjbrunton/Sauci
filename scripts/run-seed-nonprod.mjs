#!/usr/bin/env node
/**
 * Run content seed against non-production database using Node.js
 *
 * Usage:
 *   export NONPROD_DATABASE_PASSWORD="your-database-password"
 *   node scripts/run-seed-nonprod.mjs
 *
 * Get the password from: Supabase Dashboard > Settings > Database > Database password
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const { Client } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Non-production database connection
const NONPROD_PASSWORD = process.env.NONPROD_DATABASE_PASSWORD;

if (!NONPROD_PASSWORD) {
  console.error('Error: NONPROD_DATABASE_PASSWORD environment variable is not set');
  console.error('Get it from: Supabase Dashboard > Settings > Database > Database password');
  process.exit(1);
}

const connectionString = `postgresql://postgres.itbzhrvlgvdmzbnhzhyx:${NONPROD_PASSWORD}@aws-0-eu-west-1.pooler.supabase.com:6543/postgres`;

async function main() {
  console.log('=== Running content seed against Sauci Non-Production ===\n');

  // Read the seed file
  const seedFile = path.join(__dirname, '../apps/supabase/content-seed.sql');

  if (!fs.existsSync(seedFile)) {
    console.error(`Error: Seed file not found at ${seedFile}`);
    console.error('Run the export from production first.');
    process.exit(1);
  }

  const sql = fs.readFileSync(seedFile, 'utf8');
  console.log(`Loaded seed file (${sql.split('\n').length} lines)`);

  const client = new Client({ connectionString });

  try {
    console.log('Connecting to non-production database...');
    await client.connect();
    console.log('Connected!\n');

    console.log('Executing seed SQL...');
    await client.query(sql);

    console.log('\n=== Content sync complete! ===');

    // Verify the data
    console.log('\nVerifying data:');
    const tables = ['categories', 'topics', 'question_packs', 'dare_packs', 'questions', 'dares', 'pack_topics'];
    for (const table of tables) {
      const result = await client.query(`SELECT COUNT(*) as count FROM ${table}`);
      console.log(`  - ${table}: ${result.rows[0].count} rows`);
    }

  } catch (error) {
    console.error('\nError:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
