import { access, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const errors = [];
const scoped = process.argv.includes('--scope');

async function exists(file) {
  try { await access(file); return true; } catch { return false; }
}

async function walk(directory, files = []) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (['.git', 'node_modules', '.next', 'dist', 'build', 'coverage', 'evidence', '.ralph'].includes(entry.name)) continue;
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) await walk(target, files);
    else files.push(target);
  }
  return files;
}

function fail(file, message, fix) {
  errors.push(`${path.relative(root, file)}: ${message}\n  Fix: ${fix}`);
}

const allFiles = await walk(root);
for (const file of allFiles) {
  if (path.basename(file) === 'agents.md') {
    fail(file, 'lowercase agent context is not discoverable consistently', 'rename it to AGENTS.md or move maintained detail under docs/');
  }
  if (!/\.(md|sql)$/.test(file)) continue;
  const source = await readFile(file, 'utf8');
  if (/^\s*[-*]\s*Use\s+.*apply_migration/im.test(source)) {
    fail(file, 'instruction authorizes untracked remote migrations', 'create a local apps/supabase/migrations file instead');
  }
}

if (!scoped) {
  const packageJson = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
  for (const app of (await readdir(path.join(root, 'apps'), { withFileTypes: true })).filter((entry) => entry.isDirectory())) {
    const packageFile = path.join(root, 'apps', app.name, 'package.json');
    if (!(await exists(packageFile))) continue;
    if (!packageJson.workspaces.includes(`apps/${app.name}`)) {
      fail(packageFile, 'application is outside the root workspace', `add apps/${app.name} to package.json workspaces`);
    }
  }

  const claude = await readFile(path.join(root, 'CLAUDE.md'), 'utf8');
  if (claude.split('\n').length > 20 || !claude.includes('AGENTS.md')) {
    fail(path.join(root, 'CLAUDE.md'), 'runtime-specific context has drifted from the universal map', 'keep CLAUDE.md as a short pointer to AGENTS.md');
  }

  const duplicateMigrations = path.join(root, 'supabase', 'migrations');
  if (await exists(duplicateMigrations)) {
    const entries = await readdir(duplicateMigrations);
    if (entries.length) fail(duplicateMigrations, 'second migration tree can bypass deployment', 'move migrations to apps/supabase/migrations and remove the duplicate');
  }

  const cutoff = '20260201100806';
  const migrationDir = path.join(root, 'apps', 'supabase', 'migrations');
  for (const name of await readdir(migrationDir)) {
    if (name.slice(0, 14) <= cutoff) continue;
    const file = path.join(migrationDir, name);
    const source = await readFile(file, 'utf8');
    if (/https:\/\/[a-z0-9-]+\.supabase\.co/i.test(source)) {
      fail(file, 'new migration hardcodes a remote Supabase project', 'resolve the function URL from environment-specific app_config');
    }
  }

  const docsIndex = await readFile(path.join(root, 'docs', 'index.md'), 'utf8');
  for (const match of docsIndex.matchAll(/\[[^\]]+\]\(([^)]+\.md)\)/g)) {
    const target = path.resolve(root, 'docs', match[1]);
    if (!(await exists(target))) fail(path.join(root, 'docs', 'index.md'), `broken documentation link ${match[1]}`, 'correct the link or restore the maintained document');
  }

  const mcpAuth = await readFile(path.join(root, 'apps', 'mcp', 'src', 'lib', 'auth.ts'), 'utf8');
  if (/allowing all requests|query\(['"]apiKey/i.test(mcpAuth)) {
    fail(path.join(root, 'apps', 'mcp', 'src', 'lib', 'auth.ts'), 'MCP authentication can leak or fail open', 'require a configured Bearer token and fail closed');
  }
}

if (errors.length) {
  console.error(`Harness invariant failures (${errors.length}):\n\n${errors.join('\n\n')}`);
  process.exit(1);
}
console.log('Harness invariants passed');
