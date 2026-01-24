/**
 * Script to sync content from production to non-production Supabase
 *
 * Usage: npx ts-node scripts/sync-content-to-nonprod.ts
 *
 * Make sure you have the following environment variables set:
 * - PROD_SUPABASE_URL (or uses default)
 * - PROD_SUPABASE_SERVICE_KEY
 * - NONPROD_SUPABASE_URL (or uses default)
 * - NONPROD_SUPABASE_SERVICE_KEY
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Configuration
const PROD_URL = process.env.PROD_SUPABASE_URL || 'https://ckjcrkjpmhqhiucifukx.supabase.co';
const PROD_KEY = process.env.PROD_SUPABASE_SERVICE_KEY;

const NONPROD_URL = process.env.NONPROD_SUPABASE_URL || 'https://itbzhrvlgvdmzbnhzhyx.supabase.co';
const NONPROD_KEY = process.env.NONPROD_SUPABASE_SERVICE_KEY;

if (!PROD_KEY || !NONPROD_KEY) {
  console.error('Missing required environment variables:');
  if (!PROD_KEY) console.error('  - PROD_SUPABASE_SERVICE_KEY');
  if (!NONPROD_KEY) console.error('  - NONPROD_SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const prodClient = createClient(PROD_URL, PROD_KEY);
const nonprodClient = createClient(NONPROD_URL, NONPROD_KEY);

async function fetchAll<T>(client: SupabaseClient, table: string, orderBy?: string): Promise<T[]> {
  let allData: T[] = [];
  let offset = 0;
  const limit = 1000;

  while (true) {
    let query = client.from(table).select('*').range(offset, offset + limit - 1);
    if (orderBy) {
      query = query.order(orderBy);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Error fetching ${table}: ${error.message}`);
    }

    if (!data || data.length === 0) break;

    allData = allData.concat(data as T[]);
    offset += limit;

    if (data.length < limit) break;
  }

  return allData;
}

async function clearTable(client: SupabaseClient, table: string) {
  // Use RPC to bypass RLS for deletion
  const { error } = await client.rpc('truncate_table', { table_name: table });
  if (error) {
    // If RPC doesn't exist, try direct delete
    const { error: deleteError } = await client.from(table).delete().gte('id', '00000000-0000-0000-0000-000000000000');
    if (deleteError) {
      console.warn(`Warning: Could not clear ${table}: ${deleteError.message}`);
    }
  }
}

async function insertBatch<T extends Record<string, any>>(
  client: SupabaseClient,
  table: string,
  data: T[],
  batchSize = 100
): Promise<void> {
  for (let i = 0; i < data.length; i += batchSize) {
    const batch = data.slice(i, i + batchSize);
    const { error } = await client.from(table).upsert(batch, { onConflict: 'id' });

    if (error) {
      console.error(`Error inserting into ${table} at batch ${i / batchSize}:`, error.message);
      // Try inserting one by one to find the problematic row
      for (const row of batch) {
        const { error: singleError } = await client.from(table).upsert(row, { onConflict: 'id' });
        if (singleError) {
          console.error(`  Failed row:`, row.id, singleError.message);
        }
      }
    }

    process.stdout.write(`\r  Inserted ${Math.min(i + batchSize, data.length)}/${data.length}`);
  }
  console.log();
}

async function main() {
  console.log('=== Content Sync: Production -> Non-Production ===\n');

  try {
    // 1. Fetch all content from production
    console.log('Fetching content from production...');

    console.log('  - Categories...');
    const categories = await fetchAll(prodClient, 'categories', 'sort_order');
    console.log(`    Found ${categories.length} categories`);

    console.log('  - Topics...');
    const topics = await fetchAll(prodClient, 'topics', 'sort_order');
    console.log(`    Found ${topics.length} topics`);

    console.log('  - Question Packs...');
    const questionPacks = await fetchAll(prodClient, 'question_packs', 'sort_order');
    console.log(`    Found ${questionPacks.length} question packs`);

    console.log('  - Dare Packs...');
    const darePacks = await fetchAll(prodClient, 'dare_packs', 'sort_order');
    console.log(`    Found ${darePacks.length} dare packs`);

    console.log('  - Questions...');
    const questions = await fetchAll(prodClient, 'questions', 'pack_id');
    console.log(`    Found ${questions.length} questions`);

    console.log('  - Dares...');
    const dares = await fetchAll(prodClient, 'dares', 'pack_id');
    console.log(`    Found ${dares.length} dares`);

    console.log('  - Pack Topics...');
    const packTopics = await fetchAll(prodClient, 'pack_topics');
    console.log(`    Found ${packTopics.length} pack-topic associations`);

    // 2. Clear existing content in non-prod (in reverse dependency order)
    console.log('\nClearing existing content in non-production...');
    console.log('  - pack_topics...');
    await clearTable(nonprodClient, 'pack_topics');
    console.log('  - questions...');
    await clearTable(nonprodClient, 'questions');
    console.log('  - dares...');
    await clearTable(nonprodClient, 'dares');
    console.log('  - question_packs...');
    await clearTable(nonprodClient, 'question_packs');
    console.log('  - dare_packs...');
    await clearTable(nonprodClient, 'dare_packs');
    console.log('  - topics...');
    await clearTable(nonprodClient, 'topics');
    console.log('  - categories...');
    await clearTable(nonprodClient, 'categories');

    // 3. Insert content into non-prod (in dependency order)
    console.log('\nInserting content into non-production...');

    console.log('  - Categories...');
    await insertBatch(nonprodClient, 'categories', categories);

    console.log('  - Topics...');
    await insertBatch(nonprodClient, 'topics', topics);

    console.log('  - Question Packs...');
    await insertBatch(nonprodClient, 'question_packs', questionPacks);

    console.log('  - Dare Packs...');
    await insertBatch(nonprodClient, 'dare_packs', darePacks);

    // Handle questions with inverse_of self-reference
    // First insert all questions with inverse_of set to NULL
    console.log('  - Questions (pass 1: without inverse_of)...');
    const questionsWithoutInverse = questions.map((q: any) => ({ ...q, inverse_of: null }));
    await insertBatch(nonprodClient, 'questions', questionsWithoutInverse);

    // Then update the inverse_of references
    const questionsWithInverse = (questions as any[]).filter(q => q.inverse_of !== null);
    if (questionsWithInverse.length > 0) {
      console.log(`  - Questions (pass 2: updating ${questionsWithInverse.length} inverse_of references)...`);
      for (const q of questionsWithInverse) {
        const { error } = await nonprodClient
          .from('questions')
          .update({ inverse_of: q.inverse_of })
          .eq('id', q.id);
        if (error) {
          console.error(`    Failed to update inverse_of for ${q.id}:`, error.message);
        }
      }
      console.log(`    Updated ${questionsWithInverse.length} references`);
    }

    console.log('  - Dares...');
    await insertBatch(nonprodClient, 'dares', dares);

    console.log('  - Pack Topics...');
    // pack_topics has composite primary key, need different upsert strategy
    for (const pt of packTopics as any[]) {
      const { error } = await nonprodClient
        .from('pack_topics')
        .upsert(pt, { onConflict: 'pack_id,topic_id' });
      if (error) {
        console.error(`    Failed pack_topic:`, pt, error.message);
      }
    }
    console.log(`    Inserted ${(packTopics as any[]).length} pack-topic associations`);

    console.log('\n=== Sync Complete! ===');
    console.log(`
Summary:
  - ${categories.length} categories
  - ${topics.length} topics
  - ${questionPacks.length} question packs
  - ${darePacks.length} dare packs
  - ${questions.length} questions
  - ${dares.length} dares
  - ${(packTopics as any[]).length} pack-topic associations
`);

  } catch (error) {
    console.error('Sync failed:', error);
    process.exit(1);
  }
}

main();
