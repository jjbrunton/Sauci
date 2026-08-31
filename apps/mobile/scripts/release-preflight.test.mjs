import assert from 'node:assert/strict';
import test from 'node:test';
import { chmodSync, cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validateFreeDisk, validateLocalEas, validateReleaseSources } from './release-preflight.mjs';

const repoRoot = join(import.meta.dirname, '..', '..', '..');

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'sauci-release-preflight-'));
  cpSync(join(repoRoot, 'apps', 'mobile'), join(root, 'apps', 'mobile'), { recursive: true });
  cpSync(join(repoRoot, '.gitignore'), join(root, '.gitignore'));
  return root;
}

function replace(root, relative, from, to) {
  const file = join(root, relative);
  writeFileSync(file, readFileSync(file, 'utf8').replace(from, to));
}

function validate(root) {
  return validateReleaseSources({ root, isTracked: () => true });
}

test('accepts current checked-in mobile release sources', () => {
  const root = fixture();
  try {
    const result = validate(root);
    assert.match(result.publicVersion, /^\d+\.\d+\.\d+$/);
    assert.match(result.iosBuild, /^\d+$/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('rejects a widget Xcode build setting that overrides its plist', () => {
  const root = fixture();
  try {
    const { iosBuild } = validate(root);
    const project = 'apps/mobile/ios/Sauci.xcodeproj/project.pbxproj';
    const source = readFileSync(join(root, project), 'utf8');
    const expected = `CURRENT_PROJECT_VERSION = ${iosBuild};`;
    const replacement = `CURRENT_PROJECT_VERSION = ${Number(iosBuild) + 1};`;
    assert.ok(source.includes(expected));
    replace(root, project, expected, replacement);
    assert.ok(readFileSync(join(root, project), 'utf8').includes(replacement));
    assert.throws(() => validate(root), /iOS app, widget, and effective widget Xcode build numbers disagree/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('rejects an OTA certificate without its root archive allowlist', () => {
  const root = fixture();
  try {
    const archiveRules = readFileSync(join(root, '.gitignore'), 'utf8');
    assert.ok(archiveRules.includes('!apps/mobile/certs/certificate.pem'));
    replace(root, '.gitignore', '!apps/mobile/certs/certificate.pem', '');
    assert.ok(!readFileSync(join(root, '.gitignore'), 'utf8').includes('!apps/mobile/certs/certificate.pem'));
    assert.throws(
      () => validate(root),
      /must later allowlist !apps\/mobile\/certs\/certificate\.pem/,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('rejects an Android manifest that lost the media permission removal (expo prebuild regression)', () => {
  const root = fixture();
  try {
    const manifest = 'apps/mobile/android/app/src/main/AndroidManifest.xml';
    replace(
      root,
      manifest,
      '<uses-permission android:name="android.permission.READ_MEDIA_IMAGES" tools:node="remove"/>',
      '<uses-permission android:name="android.permission.READ_MEDIA_IMAGES"/>',
    );
    assert.throws(() => validate(root), /READ_MEDIA_IMAGES \(expo prebuild regresses this\)/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('rejects an iOS Info.plist that regained dev-launcher-only keys (expo prebuild regression)', () => {
  const root = fixture();
  try {
    const infoPlist = 'apps/mobile/ios/Sauci/Info.plist';
    replace(
      root,
      infoPlist,
      '</dict>\n</plist>',
      '<key>NSBonjourServices</key>\n<array><string>_expo._tcp</string></array>\n</dict>\n</plist>',
    );
    assert.throws(() => validate(root), /dev-launcher-only keys reintroduced by expo prebuild: NSBonjourServices/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('requires the local EAS plugin executable rather than its package directory', () => {
  const root = mkdtempSync(join(tmpdir(), 'sauci-eas-plugin-'));
  const executable = join(root, 'bin-run');
  try {
    writeFileSync(executable, '#!/bin/sh\n');
    chmodSync(executable, 0o755);
    assert.throws(
      () => validateLocalEas({ EAS_LOCAL_BUILD_PLUGIN_PATH: root }),
      /executable bin\/run, not a package directory/,
    );
    const bin = join(root, 'bin');
    mkdirSync(bin);
    const run = join(bin, 'run');
    cpSync(executable, run);
    chmodSync(run, 0o755);
    validateLocalEas({ EAS_LOCAL_BUILD_PLUGIN_PATH: run });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('requires enough disk before an expensive local build', () => {
  assert.throws(
    () => validateFreeDisk('/fixture', () => ({ bavail: 19, bsize: 1024 ** 3 })),
    /need at least 20 GiB free/,
  );
  validateFreeDisk('/fixture', () => ({ bavail: 20, bsize: 1024 ** 3 }));
});
