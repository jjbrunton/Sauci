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

function tomlString(source, key) {
  return source.match(new RegExp(`^${key}\\s*=\\s*"([^"]+)"\\s*$`, 'm'))?.[1];
}

const allFiles = await walk(root);
for (const file of allFiles) {
  if (path.basename(file) === 'agents.md') {
    fail(file, 'lowercase agent context is not discoverable consistently', 'rename it to AGENTS.md or move maintained detail under docs/');
  }
  if (!/\.(md|sql)$/.test(file)) continue;
  const source = await readFile(file, 'utf8');
  if (/^\s*[-*]\s*Use\s+.*apply_migration/im.test(source)) {
    fail(file, 'instruction authorizes untracked remote migrations', 'create a committed apps/api/drizzle migration instead');
  }
}

if (!scoped) {
  const agentsFile = path.join(root, 'AGENTS.md');
  const agents = await readFile(agentsFile, 'utf8');
  const noEmDashRule = 'Agents must not use em dash characters in text they add to this repository.';
  if (!agents.includes(noEmDashRule)) {
    fail(agentsFile, 'agent writing rule against em dash characters is missing', `restore: ${noEmDashRule}`);
  }

  const packageJson = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
  const codexConfigFile = path.join(root, '.codex', 'config.toml');
  const codexConfig = await readFile(codexConfigFile, 'utf8');
  if (!/^\[agents\]$/m.test(codexConfig) || !/^enabled\s*=\s*true$/m.test(codexConfig)) {
    fail(codexConfigFile, 'project subagent routing is not enabled', 'restore the [agents] table with enabled = true');
  }
  if (tomlString(codexConfig, 'default_subagent_model') !== 'gpt-5.6-terra') {
    fail(codexConfigFile, 'ordinary subagents no longer default to the cost-balanced model', 'set default_subagent_model = "gpt-5.6-terra"');
  }
  if (tomlString(codexConfig, 'default_subagent_reasoning_effort') !== 'medium') {
    fail(codexConfigFile, 'ordinary subagent effort is no longer the balanced default', 'set default_subagent_reasoning_effort = "medium"');
  }
  const maxThreads = Number(codexConfig.match(/^max_concurrent_threads_per_session\s*=\s*(\d+)$/m)?.[1]);
  if (!Number.isInteger(maxThreads) || maxThreads < 1 || maxThreads > 3) {
    fail(codexConfigFile, 'subagent concurrency is missing or exceeds the repository cost cap', 'set max_concurrent_threads_per_session between 1 and 3');
  }

  const agentContracts = {
    'repo-scout.toml': { name: 'repo_scout', model: 'gpt-5.6-luna', effort: 'low', readOnly: true },
    'implementation.toml': { name: 'implementation', model: 'gpt-5.6-terra', effort: null, flexibleEffort: true },
    'test-writer.toml': { name: 'test_writer', model: 'gpt-5.6-terra', effort: 'medium' },
    'verifier.toml': { name: 'verifier', model: 'gpt-5.6-terra', effort: 'medium' },
    'database-reviewer.toml': { name: 'database_reviewer', model: 'gpt-5.6-terra', effort: 'high', readOnly: true },
    'security-reviewer.toml': { name: 'security_reviewer', model: 'gpt-5.6-sol', effort: 'high', readOnly: true },
    'architecture-reviewer.toml': { name: 'architecture_reviewer', model: 'gpt-5.6-sol', effort: 'high', readOnly: true },
  };
  for (const [filename, contract] of Object.entries(agentContracts)) {
    const agentFile = path.join(root, '.codex', 'agents', filename);
    if (!(await exists(agentFile))) {
      fail(agentFile, 'required task-agent profile is missing', `restore .codex/agents/${filename}`);
      continue;
    }
    const source = await readFile(agentFile, 'utf8');
    if (tomlString(source, 'name') !== contract.name || tomlString(source, 'model') !== contract.model) {
      fail(agentFile, 'task-agent identity or cost tier drifted', `set name = "${contract.name}" and model = "${contract.model}"`);
    }
    const effort = tomlString(source, 'model_reasoning_effort');
    if (contract.flexibleEffort ? effort !== undefined : effort !== contract.effort) {
      fail(
        agentFile,
        contract.flexibleEffort ? 'implementation reasoning is pinned and cannot flex by task complexity' : 'task-agent reasoning effort drifted',
        contract.flexibleEffort ? 'omit model_reasoning_effort so the handoff or project default controls it' : `set model_reasoning_effort = "${contract.effort}"`,
      );
    }
    if (contract.readOnly && tomlString(source, 'sandbox_mode') !== 'read-only') {
      fail(agentFile, 'review-only agent can mutate the workspace', 'set sandbox_mode = "read-only"');
    }
    if (!/^description\s*=\s*".+"$/m.test(source) || !/developer_instructions\s*=\s*"""[\s\S]*\S[\s\S]*"""/m.test(source)) {
      fail(agentFile, 'custom agent is missing its required description or instructions', 'restore non-empty description and developer_instructions fields');
    }
  }

  const mobilePackageFile = path.join(root, 'apps', 'mobile', 'package.json');
  const mobilePackageJson = JSON.parse(await readFile(mobilePackageFile, 'utf8'));
  const releaseBuildScripts = Object.entries(mobilePackageJson.scripts ?? {})
    .filter(([name]) => /^release:(ios|android)(:preview)?$/.test(name));
  for (const [name, command] of releaseBuildScripts) {
    if (/\bexpo\s+prebuild\b/.test(command)) {
      fail(
        mobilePackageFile,
        `${name} regenerates tracked native projects before packaging`,
        'keep native regeneration as an explicit reviewed change and let the release script build the checked-in native sources',
      );
    }
    if (/\b(?:fastlane|eas)\b[^\n]*(?:upload|submit)|\bupload_to_/.test(command)) {
      fail(
        mobilePackageFile,
        `${name} combines build creation with store mutation`,
        'keep build scripts artifact-only and expose upload or submission as a separately authorized command',
      );
    }
  }

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
    if (entries.length) fail(duplicateMigrations, 'second migration tree can bypass deployment', 'move active migrations to apps/api/drizzle and remove the duplicate');
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

  for (const directory of [
    path.join(root, 'apps', 'mobile'),
    path.join(root, 'apps', 'admin', 'src'),
    path.join(root, 'apps', 'web'),
    path.join(root, 'apps', 'mcp', 'src'),
  ]) {
    for (const file of await walk(directory, [])) {
      if (!/\.(?:ts|tsx|js|jsx)$/.test(file) || /(?:\.test\.|__tests__)/.test(file)) continue;
      const source = await readFile(file, 'utf8');
      if (/\/functions\/v1\/|\.functions\.invoke\s*\(/.test(source)) {
        fail(file, 'runtime code calls the retired Supabase Edge Function data plane', 'call the standalone versioned API instead');
      }
    }
  }
}

if (errors.length) {
  console.error(`Harness invariant failures (${errors.length}):\n\n${errors.join('\n\n')}`);
  process.exit(1);
}
console.log('Harness invariants passed');
