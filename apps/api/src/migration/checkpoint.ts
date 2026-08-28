import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { MigrationCheckpoint } from './types.js';

export async function loadCheckpoint(path: string, finalSync: boolean): Promise<MigrationCheckpoint> {
  if (!finalSync) {
    try {
      const parsed = JSON.parse(await readFile(path, 'utf8')) as MigrationCheckpoint;
      if (parsed.version === 1 && parsed.mode === 'initial') return parsed;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }
  return { version: 1, runId: randomUUID(), mode: finalSync ? 'final' : 'initial', completedTables: [], storage: {}, updatedAt: new Date().toISOString() };
}

export async function saveCheckpoint(path: string, checkpoint: MigrationCheckpoint): Promise<void> {
  checkpoint.updatedAt = new Date().toISOString();
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(checkpoint, null, 2)}\n`, { mode: 0o600 });
  await rename(temporary, path);
}
