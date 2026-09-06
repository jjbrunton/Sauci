import { readdir, readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

interface JournalEntry {
  idx: number;
  tag: string;
}

describe('Drizzle migration journal', () => {
  it('lists every ordered SQL migration exactly once', async () => {
    const migrationsDirectory = new URL('../drizzle/', import.meta.url);
    const journal = JSON.parse(await readFile(new URL('meta/_journal.json', migrationsDirectory), 'utf8')) as {
      entries: JournalEntry[];
    };
    const migrationFiles = (await readdir(migrationsDirectory))
      .filter((name) => name.endsWith('.sql'))
      .sort();
    const journalFiles = journal.entries.map((entry) => `${entry.tag}.sql`);

    expect(journal.entries.map((entry) => entry.idx)).toEqual([...journal.entries.keys()]);
    expect(new Set(journalFiles).size).toBe(journalFiles.length);
    expect(journalFiles).toEqual(migrationFiles);
  });
});
