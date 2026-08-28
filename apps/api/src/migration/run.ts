import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { Pool } from 'pg';
import { loadCheckpoint, saveCheckpoint } from './checkpoint.js';
import { migrateDatabase, relationalParity } from './database.js';
import { validateEndpoints, redactDatabaseUrl } from './safety.js';
import { createSupabaseDownloader, migrateStorage } from './storage.js';
import type { ParityReport } from './types.js';

const args = new Set(process.argv.slice(2));
const dryRun = args.has('--dry-run'); const finalSync = args.has('--final-sync'); const prune = args.has('--prune'); const includeStorage = args.has('--storage');
if (prune && (!finalSync || dryRun)) throw new Error('--prune requires a non-dry-run --final-sync with the legacy source stopped');
if (includeStorage && !process.env.MEDIA_ROOT) throw new Error('MEDIA_ROOT is required with --storage');
const endpoints = validateEndpoints(process.env.SOURCE_DATABASE_URL, process.env.TARGET_DATABASE_URL, process.env.MIGRATION_TARGET_HOST_ALLOWLIST);
const checkpointPath = resolve(process.env.MIGRATION_CHECKPOINT_FILE ?? '.migration-state/backend-cutover.json');
const reportPath = resolve(process.env.MIGRATION_REPORT_FILE ?? '.migration-state/backend-parity.json');
const checkpoint = await loadCheckpoint(checkpointPath, finalSync);
const source = new Pool({ connectionString: endpoints.source, max: 2 }); const target = new Pool({ connectionString: endpoints.target, max: 2 });
const startedAt = new Date().toISOString();
console.log(`Migration ${checkpoint.runId}: ${redactDatabaseUrl(endpoints.source)} -> ${redactDatabaseUrl(endpoints.target)} (${dryRun ? 'dry-run' : finalSync ? 'final-sync' : 'initial'})`);
try {
  const save = (value: typeof checkpoint) => saveCheckpoint(checkpointPath, value);
  const tables = await migrateDatabase(source, target, { dryRun, finalSync, prune, checkpoint, saveCheckpoint: save });
  const storage = includeStorage ? await migrateStorage(source, target, {
    dryRun, prune: finalSync && prune, mediaRoot: process.env.MEDIA_ROOT ?? '', checkpoint, saveCheckpoint: save,
    download: createSupabaseDownloader(process.env.SOURCE_STORAGE_URL ?? '', process.env.SOURCE_STORAGE_SERVICE_ROLE_KEY ?? ''),
  }) : null;
  const relational = await relationalParity(target);
  const parity = tables.filter((row) => row.status !== 'skipped').every((row) => row.status === 'equal') && Object.values(relational).every((count) => count === 0) && (!storage || (storage.sourceFiles === storage.targetFiles && storage.failedFiles === 0 && storage.missingOnDisk.length === 0));
  const report: ParityReport = { runId: checkpoint.runId, dryRun, finalSync, startedAt, finishedAt: new Date().toISOString(), tables, storage, relational, parity };
  await mkdir(dirname(reportPath), { recursive: true }); await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
  console.log(JSON.stringify(report, null, 2));
  if (!parity && finalSync) process.exitCode = 2;
} finally { await Promise.all([source.end(), target.end()]); }
