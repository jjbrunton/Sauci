import assert from 'node:assert/strict';
import test from 'node:test';
import { parsePublishArgs, resolvePublishEnvironment } from './ota-publish.mjs';

const config = {
  build: {
    production: {
      env: {
        EXPO_PUBLIC_API_URL: 'https://api.sauci.app',
        EXPO_PUBLIC_SUPABASE_URL: 'https://ckjcrkjpmhqhiucifukx.supabase.co',
        EXPO_PUBLIC_SUPABASE_ANON_KEY: 'production-anon-key',
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
