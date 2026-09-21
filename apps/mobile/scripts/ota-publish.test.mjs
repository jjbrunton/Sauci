import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  assertProductionExportContainsRevenueCatConfig,
  buildEoasEnvironment,
  buildEoasPublishArgs,
  parsePublishArgs,
  resolvePublishEnvironment,
} from './ota-publish.mjs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const config = {
  build: {
    production: {
      env: {
        EXPO_PUBLIC_API_URL: 'https://api.sauci.app',
        EXPO_PUBLIC_SUPABASE_URL: 'https://ckjcrkjpmhqhiucifukx.supabase.co',
        EXPO_PUBLIC_SUPABASE_ANON_KEY: 'production-anon-key',
        EXPO_PUBLIC_REVENUECAT_IOS_API_KEY: 'appl_test_ios_public_key',
        EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY: 'goog_test_android_public_key',
        EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID: 'Sauci Pro',
      },
    },
    preview: {
      env: {
        EXPO_PUBLIC_API_URL: 'https://api.preprod.sauci.app',
        RELEASE_CHANNEL: 'staging',
      },
    },
  },
};

test('production export uses the checked-in production profile', () => {
  const { branch, env } = resolvePublishEnvironment('production', {}, config);

  assert.equal(branch, 'production');
  assert.equal(env.RELEASE_CHANNEL, 'production');
  assert.equal(env.EXPO_PUBLIC_API_URL, 'https://api.sauci.app');
});

test('production export fails closed without valid RevenueCat public configuration', () => {
  for (const [key, value] of [
    ['EXPO_PUBLIC_REVENUECAT_IOS_API_KEY', ''],
    ['EXPO_PUBLIC_REVENUECAT_IOS_API_KEY', 'goog_wrong_platform_key'],
    ['EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY', ''],
    ['EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY', 'appl_wrong_platform_key'],
    ['EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID', ''],
  ]) {
    const productionEnv = { ...config.build.production.env, [key]: value };
    assert.throws(
      () => resolvePublishEnvironment('production', {}, {
        build: { ...config.build, production: { env: productionEnv } },
      }),
      new RegExp(key),
    );
  }
});

test('production preflight proves the compiled bundle contains RevenueCat configuration', () => {
  const outputDir = mkdtempSync(join(tmpdir(), 'sauci-ota-export-test-'));
  const environment = config.build.production.env;
  try {
    writeFileSync(
      join(outputDir, 'index.js'),
      [
        environment.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY,
        environment.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY,
        environment.EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID,
      ].join(','),
    );
    assert.doesNotThrow(() => assertProductionExportContainsRevenueCatConfig(outputDir, environment));

    writeFileSync(join(outputDir, 'index.js'), environment.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY);
    assert.throws(
      () => assertProductionExportContainsRevenueCatConfig(outputDir, environment),
      /EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY/,
    );
  } finally {
    rmSync(outputDir, { recursive: true, force: true });
  }
});

test('EOAS uses a guarded package runner that receives the resolved production environment', () => {
  const eoasEnvironment = buildEoasEnvironment({ ...config.build.production.env, PATH: process.env.PATH });
  assert.equal(eoasEnvironment.EOAS_PACKAGE_RUNNER, 'sauci-eoas-npx');
  assert.match(eoasEnvironment.PATH, /apps\/mobile\/scripts\/bin/);
  assert.equal(eoasEnvironment.SAUCI_EOAS_EXPECTED_EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID, 'Sauci Pro');

  const runnerPath = fileURLToPath(new URL('./bin/sauci-eoas-npx', import.meta.url));
  const successful = spawnSync(process.execPath, [runnerPath, 'expo', 'export'], {
    env: { ...eoasEnvironment, SAUCI_EOAS_NPX: '/usr/bin/true' },
    encoding: 'utf8',
  });
  assert.equal(successful.status, 0, successful.stderr);

  const missingKey = spawnSync(process.execPath, [runnerPath, 'expo', 'export'], {
    env: { ...eoasEnvironment, EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY: '', SAUCI_EOAS_NPX: '/usr/bin/true' },
    encoding: 'utf8',
  });
  assert.equal(missingKey.status, 1);
  assert.match(missingKey.stderr, /EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY/);
  assert.doesNotMatch(missingKey.stderr, /goog_test_android_public_key/);

  assert.deepEqual(
    buildEoasPublishArgs('production', ['--platform', 'all'], true),
    ['eoas', 'publish', '--branch', 'production', '--packageRunner', 'sauci-eoas-npx', '--platform', 'all'],
  );
  assert.deepEqual(
    buildEoasPublishArgs('staging', ['--platform', 'ios']),
    ['eoas', 'publish', '--branch', 'staging', '--platform', 'ios'],
  );
});

test('staging export requires the designated non-production Auth configuration', () => {
  const environment = {
    EXPO_PUBLIC_SUPABASE_URL: 'https://itbzhrvlgvdmzbnhzhyx.supabase.co',
    EXPO_PUBLIC_SUPABASE_ANON_KEY: 'staging-anon-key',
  };
  const { branch, env } = resolvePublishEnvironment('staging', environment, config);

  assert.equal(branch, 'staging');
  assert.equal(env.RELEASE_CHANNEL, 'staging');
  assert.equal(env.EXPO_PUBLIC_API_URL, 'https://api.preprod.sauci.app');
});

test('staging export rejects production Auth configuration', () => {
  assert.throws(
    () => resolvePublishEnvironment('staging', {
      EXPO_PUBLIC_SUPABASE_URL: 'https://ckjcrkjpmhqhiucifukx.supabase.co',
      EXPO_PUBLIC_SUPABASE_ANON_KEY: 'production-anon-key',
    }, config),
    /canonical HTTPS root/,
  );
});

test('rejects malformed API and Auth roots', () => {
  for (const invalidAuthUrl of [
    'http://itbzhrvlgvdmzbnhzhyx.supabase.co',
    'https://user@itbzhrvlgvdmzbnhzhyx.supabase.co',
    'https://itbzhrvlgvdmzbnhzhyx.supabase.co/auth/v1',
    'https://itbzhrvlgvdmzbnhzhyx.supabase.co?source=test',
    'https://itbzhrvlgvdmzbnhzhyx.supabase.co#fragment',
    'https://itbzhrvlgvdmzbnhzhyx.supabase.co:8443',
  ]) {
    assert.throws(
      () => resolvePublishEnvironment('staging', {
        EXPO_PUBLIC_SUPABASE_URL: invalidAuthUrl,
        EXPO_PUBLIC_SUPABASE_ANON_KEY: 'staging-anon-key',
      }, config),
      /canonical HTTPS root/,
    );
  }
  assert.throws(
    () => resolvePublishEnvironment('staging', {
      EXPO_PUBLIC_SUPABASE_URL: 'https://itbzhrvlgvdmzbnhzhyx.supabase.co',
      EXPO_PUBLIC_SUPABASE_ANON_KEY: 'staging-anon-key',
    }, {
      ...config,
      build: { ...config.build, preview: { env: { ...config.build.preview.env, EXPO_PUBLIC_API_URL: 'https://api.preprod.sauci.app/path' } } },
    }),
    /canonical HTTPS root/,
  );
});

test('permits only documented safe publish arguments', () => {
  assert.deepEqual(
    parsePublishArgs(['--platform', 'ios', '-m', 'Release notes', '--rollout-percentage', '25', '--nonInteractive']),
    ['--platform', 'ios', '-m', 'Release notes', '--rollout-percentage', '25', '--nonInteractive'],
  );
  assert.deepEqual(
    parsePublishArgs(['--platform=all', '--message=Release', '--rollout-percentage=99']),
    ['--platform=all', '--message=Release', '--rollout-percentage=99'],
  );
});

test('rejects EOAS target, server, repository, and unknown overrides', () => {
  for (const unsafe of [
    '--branch',
    '--branch=other',
    '--channel',
    '--channel=other',
    '--serverUrl',
    '--serverUrl=https://other.example',
    '--server-url',
    '--disableRepositoryCheck',
    '--disable-repository-check',
    '--outputDir',
    '--unknown',
  ]) {
    assert.throws(() => parsePublishArgs([unsafe]), /unsupported publish argument/);
  }
});
