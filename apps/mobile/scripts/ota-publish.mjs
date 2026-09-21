#!/usr/bin/env node

import { accessSync, constants, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join, resolve } from 'node:path';
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
const requiredProductionRevenueCatConfig = [
  ['EXPO_PUBLIC_REVENUECAT_IOS_API_KEY', 'appl_'],
  ['EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY', 'goog_'],
  ['EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID', null],
];
const EOAS_PACKAGE_RUNNER = 'sauci-eoas-npx';
const EOAS_RUNNER_BIN_DIR = join(projectDir, 'scripts', 'bin');

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

  if (target === 'production') {
    for (const [key, prefix] of requiredProductionRevenueCatConfig) {
      const value = env[key];
      if (typeof value !== 'string' || !value.trim()) fail(`${key} is required for production export`);
      if (prefix && !value.startsWith(prefix)) {
        fail(`${key} must be a valid ${prefix} RevenueCat public key`);
      }
    }
  }

  return { branch: profile.branch, env };
}

function exportFiles(outputDir) {
  return readdirSync(outputDir, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = join(outputDir, entry.name);
    return entry.isDirectory() ? exportFiles(entryPath) : [entryPath];
  });
}

/**
 * Expo inlines EXPO_PUBLIC_* values into the JavaScript bundle. Verify the
 * isolated production export rather than trusting only the process environment:
 * a missing key otherwise becomes an empty string on installed devices.
 */
export function assertProductionExportContainsRevenueCatConfig(outputDir, environment) {
  const files = exportFiles(outputDir).filter((filePath) => statSync(filePath).isFile());
  for (const [key] of requiredProductionRevenueCatConfig) {
    const expectedValue = environment[key];
    const present = files.some((filePath) => readFileSync(filePath).includes(expectedValue));
    if (!present) fail(`production export does not contain ${key}`);
  }
}

function resolveExecutable(command, pathValue) {
  for (const directory of pathValue.split(delimiter)) {
    if (!directory) continue;
    const candidate = join(directory, command);
    try {
      accessSync(candidate, constants.X_OK);
      return candidate;
    } catch {
      // Continue looking through PATH.
    }
  }
  fail(`could not resolve ${command} before configuring the EOAS package runner`);
}

/**
 * EOAS starts its own Expo subprocess with EXPO_NO_DOTENV=1. Pin its package
 * runner to our checked-in wrapper so the actual EOAS export fails before it
 * starts if its inherited RevenueCat configuration differs from this profile.
 */
export function buildEoasEnvironment(environment) {
  const originalPath = environment.PATH || process.env.PATH || '';
  const expected = Object.fromEntries(requiredProductionRevenueCatConfig.map(([key]) => [
    `SAUCI_EOAS_EXPECTED_${key}`,
    environment[key],
  ]));
  return {
    ...environment,
    EXPO_NO_DOTENV: '1',
    EOAS_PACKAGE_RUNNER,
    PATH: `${EOAS_RUNNER_BIN_DIR}${delimiter}${originalPath}`,
    SAUCI_EOAS_NPX: resolveExecutable('npx', originalPath),
    ...expected,
  };
}

export function buildEoasPublishArgs(branch, rawPublishArgs, useProductionGuard = false) {
  const args = [
    'eoas',
    'publish',
    '--branch',
    branch,
    ...parsePublishArgs(rawPublishArgs),
  ];
  if (useProductionGuard) args.splice(4, 0, '--packageRunner', EOAS_PACKAGE_RUNNER);
  return args;
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

function exportAndVerify(target, environment) {
  const outputDir = mkdtempSync(join(tmpdir(), `sauci-ota-${target}-`));
  try {
    run('npx', ['expo', 'export', '--output-dir', outputDir], environment);
    if (target === 'production') {
      assertProductionExportContainsRevenueCatConfig(outputDir, environment);
    }
  } finally {
    rmSync(outputDir, { recursive: true, force: true });
  }
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
    exportAndVerify(target, exportEnv);
    console.log(`OTA ${target} export preflight passed`);
    return;
  }

  if (doctor) {
    if (rawPublishArgs.length) fail('--doctor does not accept additional EOAS arguments');
    run('npx', ['eoas', 'doctor', '--channel', branch], exportEnv);
    return;
  }

  exportAndVerify(target, exportEnv);
  const eoasEnvironment = target === 'production' ? buildEoasEnvironment(exportEnv) : exportEnv;
  run('npx', buildEoasPublishArgs(branch, rawPublishArgs, target === 'production'), eoasEnvironment);
}

// Compare real filesystem paths. A URL pathname percent-encodes spaces, so
// comparing it to process.argv[1] silently skips main() under any checkout
// whose absolute path contains a space, and every ota:* script then exits 0
// having done nothing.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
