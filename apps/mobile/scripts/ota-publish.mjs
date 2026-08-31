#!/usr/bin/env node

import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const projectDir = resolve(import.meta.dirname, '..');
const easConfig = JSON.parse(readFileSync(join(projectDir, 'eas.json'), 'utf8'));
const profiles = {
  production: {
    apiOrigin: 'https://api.sauci.app',
    authOrigin: 'https://ckjcrkjpmhqhiucifukx.supabase.co',
    branch: 'production',
    profile: 'production',
  },
  staging: {
    apiOrigin: 'https://api.preprod.sauci.app',
    authOrigin: 'https://itbzhrvlgvdmzbnhzhyx.supabase.co',
    branch: 'staging',
    profile: 'preview',
  },
};
const requiredPublicKeys = [
  'EXPO_PUBLIC_API_URL',
  'EXPO_PUBLIC_SUPABASE_URL',
  'EXPO_PUBLIC_SUPABASE_ANON_KEY',
];

function fail(message) {
  throw new Error(`OTA publish preflight: ${message}`);
}

function requireCanonicalHttpsRoot(value, expected, label) {
  try {
    const parsed = new URL(value);
    if (
      value !== expected ||
      parsed.protocol !== 'https:' ||
      parsed.origin !== expected ||
      parsed.username ||
      parsed.password ||
      parsed.pathname !== '/' ||
      parsed.search ||
      parsed.hash ||
      parsed.port
    ) {
      fail(`${label} must be the canonical HTTPS root ${expected}`);
    }
  } catch {
    fail(`${label} must be the canonical HTTPS root ${expected}`);
  }
}

export function resolvePublishEnvironment(target, environment = process.env, config = easConfig) {
  const profile = profiles[target];
  if (!profile) fail(`target must be one of: ${Object.keys(profiles).join(', ')}`);

  const profileEnv = config.build?.[profile.profile]?.env;
  if (!profileEnv) fail(`missing EAS build profile ${profile.profile}`);
  const env = { ...environment, ...profileEnv, RELEASE_CHANNEL: target };

  for (const key of requiredPublicKeys) {
    if (!env[key]) fail(`${key} is required for ${target} export`);
  }
  requireCanonicalHttpsRoot(env.EXPO_PUBLIC_SUPABASE_URL, profile.authOrigin, `${target} Auth URL`);
  requireCanonicalHttpsRoot(env.EXPO_PUBLIC_API_URL, profile.apiOrigin, `${target} API URL`);

  return { branch: profile.branch, env };
}

export function parsePublishArgs(args) {
  const parsed = [];
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    const takeValue = (flag, validate) => {
      const value = args[index + 1];
      if (!value || !validate(value)) fail(`${flag} requires a valid value`);
      parsed.push(flag, value);
      index += 1;
    };
    if (argument === '--platform') {
      takeValue('--platform', (value) => ['ios', 'android', 'all'].includes(value));
    } else if (argument.startsWith('--platform=')) {
      const value = argument.slice('--platform='.length);
      if (!['ios', 'android', 'all'].includes(value)) fail('--platform requires ios, android, or all');
      parsed.push(argument);
    } else if (argument === '-m' || argument === '--message') {
      takeValue(argument, (value) => value.length > 0);
    } else if (argument.startsWith('--message=')) {
      if (!argument.slice('--message='.length)) fail('--message requires a value');
      parsed.push(argument);
    } else if (argument === '--rollout-percentage') {
      takeValue(argument, (value) => /^(?:[1-9]|[1-9][0-9])$/.test(value));
    } else if (argument.startsWith('--rollout-percentage=')) {
      const value = argument.slice('--rollout-percentage='.length);
      if (!/^(?:[1-9]|[1-9][0-9])$/.test(value)) fail('--rollout-percentage must be 1-99');
      parsed.push(argument);
    } else if (argument === '--nonInteractive') {
      parsed.push(argument);
    } else {
      fail(`unsupported publish argument ${argument}`);
    }
  }
  return parsed;
}

function run(command, args, env) {
  const result = spawnSync(command, args, { cwd: projectDir, env, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

export function main(args = process.argv.slice(2), environment = process.env) {
  const [target, ...remaining] = args;
  const preflight = remaining.includes('--preflight');
  const doctor = remaining.includes('--doctor');
  const rawPublishArgs = remaining.filter((arg) => arg !== '--preflight' && arg !== '--doctor');
  if (preflight && doctor) fail('choose either --preflight or --doctor');

  const { branch, env } = resolvePublishEnvironment(target, environment);
  const exportEnv = { ...env, EXPO_NO_DOTENV: '1' };
  if (preflight) {
    const outputDir = mkdtempSync(join(tmpdir(), `sauci-ota-${target}-`));
    try {
      run('npx', ['expo', 'export', '--output-dir', outputDir], exportEnv);
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
    }
    console.log(`OTA ${target} export preflight passed`);
    return;
  }

  if (doctor) {
    if (rawPublishArgs.length) fail('--doctor does not accept additional EOAS arguments');
    run('npx', ['eoas', 'doctor', '--channel', branch], exportEnv);
    return;
  }

  run('npx', ['eoas', 'publish', '--branch', branch, ...parsePublishArgs(rawPublishArgs)], exportEnv);
}

// Compare real filesystem paths. A URL pathname percent-encodes spaces, so
// comparing it to process.argv[1] silently skips main() under any checkout
// whose absolute path contains a space, and every ota:* script then exits 0
// having done nothing.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
