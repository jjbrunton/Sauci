#!/usr/bin/env node

import { createInterface } from 'node:readline';
import pg from 'pg';

const { Client } = pg;

const targetUrl = process.env.TARGET_DATABASE_URL;
if (!targetUrl) throw new Error('TARGET_DATABASE_URL is required');

const parsedTarget = new URL(targetUrl);
if (!['127.0.0.1', 'localhost', '::1'].includes(parsedTarget.hostname)) {
  throw new Error('Catalogue imports must use a localhost database URL (use an SSH tunnel for remote staging)');
}

const order = [
  'categories',
  'topics',
  'question_packs',
  'dare_packs',
  'questions',
  'dares',
  'pack_topics',
  'app_config',
  'ai_config',
];
const keys = {
  categories: ['id'],
  topics: ['id'],
  question_packs: ['id'],
  dare_packs: ['id'],
  questions: ['id'],
  dares: ['id'],
  pack_topics: ['pack_id', 'topic_id'],
  app_config: ['id'],
  ai_config: ['id'],
};
const forbiddenColumns = new Set(['openrouter_api_key', 'updated_by', 'supabase_url']);
const rowsByTable = new Map();
const encodedChunks = new Map();
const input = createInterface({ input: process.stdin, crlfDelay: Infinity });

for await (const line of input) {
  if (!line.trim()) continue;
  const entry = JSON.parse(line);
  if (entry.done === true) break;
  if (order.includes(entry.table) && typeof entry.chunk === 'string') {
    encodedChunks.set(entry.table, [...(encodedChunks.get(entry.table) ?? []), entry.chunk]);
    continue;
  }
  if (order.includes(entry.table) && entry.tableDone === true) {
    const encoded = (encodedChunks.get(entry.table) ?? []).join('');
    const rows = JSON.parse(Buffer.from(encoded, 'base64').toString('utf8'));
    if (!Array.isArray(rows)) throw new Error(`${entry.table} payload is not an array`);
    rowsByTable.set(entry.table, [...(rowsByTable.get(entry.table) ?? []), ...rows]);
    encodedChunks.delete(entry.table);
    continue;
  }
  if (!order.includes(entry.table) || !Array.isArray(entry.rows)) {
    throw new Error('Each input line must contain a supported table and rows array');
  }
  rowsByTable.set(entry.table, [...(rowsByTable.get(entry.table) ?? []), ...entry.rows]);
}
input.close();

for (const table of order) {
  if (!rowsByTable.has(table)) throw new Error(`Missing catalogue export for ${table}`);
}

const quote = (value) => `"${value.replaceAll('"', '""')}"`;
const client = new Client({ connectionString: targetUrl });
await client.connect();

try {
  await client.query('begin');
  await client.query("set local sauci.suppress_operations = 'on'");

  for (const table of [...order].reverse()) {
    await client.query(`delete from ${quote(table)}`);
  }

  for (const table of order) {
    const rows = rowsByTable.get(table);
    const targetColumnRows = (await client.query(
      `select column_name,data_type from information_schema.columns where table_schema=current_schema() and table_name=$1 order by ordinal_position`,
      [table],
    )).rows;
    const targetColumns = targetColumnRows.map((row) => row.column_name);
    const targetTypes = new Map(targetColumnRows.map((row) => [row.column_name, row.data_type]));
    const columns = targetColumns.filter((column) =>
      !forbiddenColumns.has(column) && rows.some((row) => Object.hasOwn(row, column)),
    );
    if (!keys[table].every((key) => columns.includes(key))) {
      throw new Error(`${table} export is missing a required key`);
    }

    for (const row of rows) {
      const values = columns.map((column) => {
        if (table === 'questions' && column === 'inverse_of') return null;
        const value = row[column];
        return targetTypes.get(column) === 'jsonb' && value !== null ? JSON.stringify(value) : value;
      });
      await client.query(
        `insert into ${quote(table)} (${columns.map(quote).join(',')}) values (${columns.map((_, index) => `$${index + 1}`).join(',')})`,
        values,
      );
    }
  }

  for (const row of rowsByTable.get('questions')) {
    if (row.inverse_of) await client.query('update questions set inverse_of=$1 where id=$2', [row.inverse_of, row.id]);
  }

  await client.query('commit');
  const counts = {};
  for (const table of order) {
    counts[table] = Number((await client.query(`select count(*) count from ${quote(table)}`)).rows[0].count);
  }
  process.stdout.write(`${JSON.stringify(counts)}\n`);
} catch (error) {
  await client.query('rollback');
  throw error;
} finally {
  await client.end();
}
