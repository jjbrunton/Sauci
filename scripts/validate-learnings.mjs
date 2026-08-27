import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const base = path.join(root, '.agents', 'learnings');
const requiredSections = ['## Symptom', '## Reproduction', '## Cause', '## Remediation', '## Evidence'];
const failures = [];

for (const state of ['inbox', 'promoted']) {
  const directory = path.join(base, state);
  for (const name of await readdir(directory)) {
    if (!name.endsWith('.md')) continue;
    const file = path.join(directory, name);
    const source = await readFile(file, 'utf8');
    const frontmatter = source.match(/^---\n([\s\S]*?)\n---/);
    if (!frontmatter) { failures.push(`${file}: missing YAML frontmatter`); continue; }
    const fields = Object.fromEntries(frontmatter[1].split('\n').map((line) => {
      const index = line.indexOf(':');
      return index === -1 ? [line, ''] : [line.slice(0, index).trim(), line.slice(index + 1).trim()];
    }));
    for (const key of ['id', 'date', 'status', 'scope', 'evidence', 'review_after']) {
      if (!fields[key]) failures.push(`${file}: missing ${key}`);
    }
    if (fields.status !== state) failures.push(`${file}: status must be ${state}`);
    if (state === 'promoted' && !fields.destination) failures.push(`${file}: promoted lesson needs destination`);
    for (const section of requiredSections) if (!source.includes(section)) failures.push(`${file}: missing ${section}`);
  }
}

if (failures.length) {
  console.error(`Learning record failures:\n${failures.join('\n')}`);
  process.exit(1);
}
console.log('Learning records are valid');
