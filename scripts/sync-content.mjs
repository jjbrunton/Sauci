#!/usr/bin/env node
/**
 * Sync content from production to non-production using direct PostgreSQL connection
 *
 * Usage:
 *   export PROD_DATABASE_URL="postgresql://postgres.xxx:password@aws-0-eu-west-2.pooler.supabase.com:6543/postgres"
 *   export NONPROD_DATABASE_URL="postgresql://postgres.xxx:password@aws-0-eu-west-1.pooler.supabase.com:6543/postgres"
 *   node scripts/sync-content.mjs
 *
 * Get connection strings from: Supabase Dashboard > Settings > Database > Connection string (Transaction pooler)
 */

import pg from 'pg';
const { Client } = pg;

const PROD_URL = process.env.PROD_DATABASE_URL;
const NONPROD_URL = process.env.NONPROD_DATABASE_URL;

if (!PROD_URL || !NONPROD_URL) {
  console.error('Missing required environment variables:');
  if (!PROD_URL) console.error('  - PROD_DATABASE_URL');
  if (!NONPROD_URL) console.error('  - NONPROD_DATABASE_URL');
  console.error('\nGet connection strings from: Supabase Dashboard > Settings > Database > Connection string (Transaction pooler)');
  process.exit(1);
}

async function main() {
  console.log('=== Content Sync: Production -> Non-Production ===\n');

  const prodClient = new Client({ connectionString: PROD_URL });
  const nonprodClient = new Client({ connectionString: NONPROD_URL });

  try {
    console.log('Connecting to databases...');
    await prodClient.connect();
    console.log('  - Connected to production');
    await nonprodClient.connect();
    console.log('  - Connected to non-production');

    // Fetch all content from production
    console.log('\nFetching content from production...');

    const categories = (await prodClient.query('SELECT * FROM categories ORDER BY sort_order')).rows;
    console.log(`  - ${categories.length} categories`);

    const topics = (await prodClient.query('SELECT * FROM topics ORDER BY sort_order')).rows;
    console.log(`  - ${topics.length} topics`);

    const questionPacks = (await prodClient.query('SELECT * FROM question_packs ORDER BY sort_order')).rows;
    console.log(`  - ${questionPacks.length} question packs`);

    const darePacks = (await prodClient.query('SELECT * FROM dare_packs ORDER BY sort_order')).rows;
    console.log(`  - ${darePacks.length} dare packs`);

    const questions = (await prodClient.query('SELECT * FROM questions ORDER BY pack_id')).rows;
    console.log(`  - ${questions.length} questions`);

    const dares = (await prodClient.query('SELECT * FROM dares ORDER BY pack_id')).rows;
    console.log(`  - ${dares.length} dares`);

    const packTopics = (await prodClient.query('SELECT * FROM pack_topics')).rows;
    console.log(`  - ${packTopics.length} pack-topic associations`);

    // Clear and insert in non-prod
    console.log('\nClearing existing content in non-production...');
    await nonprodClient.query('BEGIN');

    await nonprodClient.query('DELETE FROM pack_topics');
    await nonprodClient.query('DELETE FROM questions');
    await nonprodClient.query('DELETE FROM dares');
    await nonprodClient.query('DELETE FROM question_packs');
    await nonprodClient.query('DELETE FROM dare_packs');
    await nonprodClient.query('DELETE FROM topics');
    await nonprodClient.query('DELETE FROM categories');
    console.log('  - Cleared all content tables');

    // Insert categories
    console.log('\nInserting content into non-production...');
    for (const cat of categories) {
      await nonprodClient.query(
        `INSERT INTO categories (id, name, description, icon, sort_order, created_at, is_public)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [cat.id, cat.name, cat.description, cat.icon, cat.sort_order, cat.created_at, cat.is_public]
      );
    }
    console.log(`  - Inserted ${categories.length} categories`);

    // Insert topics
    for (const topic of topics) {
      await nonprodClient.query(
        `INSERT INTO topics (id, name, description, icon, sort_order, created_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [topic.id, topic.name, topic.description, topic.icon, topic.sort_order, topic.created_at]
      );
    }
    console.log(`  - Inserted ${topics.length} topics`);

    // Insert question_packs
    for (const pack of questionPacks) {
      await nonprodClient.query(
        `INSERT INTO question_packs (id, name, description, icon, is_premium, is_public, sort_order, created_at, category_id, is_explicit, min_intensity, max_intensity, avg_intensity, scheduled_release_at, release_notified)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
        [pack.id, pack.name, pack.description, pack.icon, pack.is_premium, pack.is_public, pack.sort_order, pack.created_at, pack.category_id, pack.is_explicit, pack.min_intensity, pack.max_intensity, pack.avg_intensity, pack.scheduled_release_at, pack.release_notified]
      );
    }
    console.log(`  - Inserted ${questionPacks.length} question packs`);

    // Insert dare_packs
    for (const pack of darePacks) {
      await nonprodClient.query(
        `INSERT INTO dare_packs (id, name, description, icon, is_premium, is_public, is_explicit, sort_order, category_id, min_intensity, max_intensity, avg_intensity, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [pack.id, pack.name, pack.description, pack.icon, pack.is_premium, pack.is_public, pack.is_explicit, pack.sort_order, pack.category_id, pack.min_intensity, pack.max_intensity, pack.avg_intensity, pack.created_at]
      );
    }
    console.log(`  - Inserted ${darePacks.length} dare packs`);

    // Insert questions (first pass without inverse_of)
    let questionCount = 0;
    for (const q of questions) {
      await nonprodClient.query(
        `INSERT INTO questions (id, pack_id, text, intensity, partner_text, allowed_couple_genders, target_user_genders, required_props, deleted_at, inverse_of, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NULL, $10)`,
        [q.id, q.pack_id, q.text, q.intensity, q.partner_text, q.allowed_couple_genders, q.target_user_genders, q.required_props, q.deleted_at, q.created_at]
      );
      questionCount++;
      if (questionCount % 100 === 0) {
        process.stdout.write(`\r  - Inserting questions: ${questionCount}/${questions.length}`);
      }
    }
    console.log(`\r  - Inserted ${questions.length} questions`);

    // Update inverse_of references
    const questionsWithInverse = questions.filter(q => q.inverse_of !== null);
    if (questionsWithInverse.length > 0) {
      for (const q of questionsWithInverse) {
        await nonprodClient.query(
          'UPDATE questions SET inverse_of = $1 WHERE id = $2',
          [q.inverse_of, q.id]
        );
      }
      console.log(`  - Updated ${questionsWithInverse.length} inverse_of references`);
    }

    // Insert dares
    for (const dare of dares) {
      await nonprodClient.query(
        `INSERT INTO dares (id, pack_id, text, intensity, suggested_duration_hours, created_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [dare.id, dare.pack_id, dare.text, dare.intensity, dare.suggested_duration_hours, dare.created_at]
      );
    }
    console.log(`  - Inserted ${dares.length} dares`);

    // Insert pack_topics
    for (const pt of packTopics) {
      await nonprodClient.query(
        `INSERT INTO pack_topics (pack_id, topic_id) VALUES ($1, $2)`,
        [pt.pack_id, pt.topic_id]
      );
    }
    console.log(`  - Inserted ${packTopics.length} pack-topic associations`);

    await nonprodClient.query('COMMIT');

    console.log('\n=== Sync Complete! ===');
    console.log(`
Summary:
  - ${categories.length} categories
  - ${topics.length} topics
  - ${questionPacks.length} question packs
  - ${darePacks.length} dare packs
  - ${questions.length} questions
  - ${dares.length} dares
  - ${packTopics.length} pack-topic associations
`);

  } catch (error) {
    console.error('\nSync failed:', error.message);
    try {
      await nonprodClient.query('ROLLBACK');
    } catch (e) {}
    process.exit(1);
  } finally {
    await prodClient.end();
    await nonprodClient.end();
  }
}

main();
