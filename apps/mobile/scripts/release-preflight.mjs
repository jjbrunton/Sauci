#!/usr/bin/env node

import { existsSync, readFileSync, statSync, statfsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve, join } from 'node:path';

const projectDir = resolve(import.meta.dirname, '..');
const repoRoot = resolve(projectDir, '../..');
const certificatePath = 'apps/mobile/certs/certificate.pem';
const semverPattern = /^\d+\.\d+\.\d+$/;
const minimumFreeBuildBytes = 20 * 1024 ** 3;

function fail(message) {
  throw new Error(`Mobile release preflight: ${message}`);
}

function plistValue(source, key, label) {
  const values = [...source.matchAll(new RegExp(`<key>${key}</key>\\s*<string>([^<]+)</string>`, 'g'))].map((match) => match[1]);
  if (values.length !== 1) fail(`expected one ${label} ${key}`);
  return values[0];
}

function allMatches(source, expression, label) {
  const values = [...source.matchAll(expression)].map((match) => match[1].trim());
  if (!values.length) fail(`found no ${label}`);
  return values;
}

function gitStatus(args, root = repoRoot) {
  const result = spawnSync('git', ['-C', root, ...args], { encoding: 'utf8' });
  if (result.error) fail(`could not run git ${args.join(' ')}: ${result.error.message}`);
  return result.status;
}

export function validateReleaseSources({ root = repoRoot, isTracked } = {}) {
  const file = (relative) => readFileSync(join(root, relative), 'utf8');
  const app = JSON.parse(file('apps/mobile/app.json')).expo;
  const appConfig = file('apps/mobile/app.config.js');
  const androidGradle = file('apps/mobile/android/app/build.gradle');
  const androidStrings = file('apps/mobile/android/app/src/main/res/values/strings.xml');
  const xcode = file('apps/mobile/ios/Sauci.xcodeproj/project.pbxproj');
  const androidManifest = file('apps/mobile/android/app/src/main/AndroidManifest.xml');
  const iosInfo = file('apps/mobile/ios/Sauci/Info.plist');
  const widgetInfo = file('apps/mobile/targets/widget/Info.plist');
  const iosExpo = file('apps/mobile/ios/Sauci/Supporting/Expo.plist');
  const publicVersion = app.version;
  const appConfigRuntime = allMatches(appConfig, /runtimeVersion:\s*['"]([^'"]+)['"]/g, 'explicit app.config.js runtimeVersion');
  const androidVersion = allMatches(androidGradle, /\bversionName\s+["']([^"']+)["']/g, 'Android versionName');
  const androidRuntime = allMatches(androidStrings, /<string name="expo_runtime_version">([^<]+)<\/string>/g, 'Android Expo runtime version');
  const xcodeMarketing = allMatches(xcode, /\bMARKETING_VERSION\s*=\s*([^;]+);/g, 'iOS MARKETING_VERSION settings');
  const widgetBuildSettings = [...xcode.matchAll(/CURRENT_PROJECT_VERSION\s*=\s*([^;]+);[\s\S]{0,900}?PRODUCT_BUNDLE_IDENTIFIER\s*=\s*com\.sauci\.app\.LiveDrawWidget;/g)].map((match) => match[1].trim());
  if (widgetBuildSettings.length !== 2) fail('expected Debug and Release LiveDrawWidget CURRENT_PROJECT_VERSION settings');

  const versions = [
    publicVersion,
    ...appConfigRuntime,
    ...androidVersion,
    ...androidRuntime,
    ...xcodeMarketing,
    plistValue(iosInfo, 'CFBundleShortVersionString', 'iOS app Info.plist'),
    plistValue(widgetInfo, 'CFBundleShortVersionString', 'widget Info.plist'),
    plistValue(iosExpo, 'EXUpdatesRuntimeVersion', 'iOS Expo.plist'),
  ];
  if (!versions.every((version) => semverPattern.test(version))) fail(`versions must be numeric SemVer: ${versions.join(', ')}`);
  if (new Set(versions).size !== 1) fail(`public or OTA runtime versions disagree: ${versions.join(', ')}`);

  const appBuild = plistValue(iosInfo, 'CFBundleVersion', 'iOS app Info.plist');
  const widgetBuild = plistValue(widgetInfo, 'CFBundleVersion', 'widget Info.plist');
  if (!/^\d+$/.test(appBuild) || !/^\d+$/.test(widgetBuild)) fail('iOS build numbers must be positive integers');
  if (appBuild !== widgetBuild || widgetBuildSettings.some((build) => build !== appBuild)) {
    fail(`iOS app, widget, and effective widget Xcode build numbers disagree: app ${appBuild}; widget plist ${widgetBuild}; widget settings ${widgetBuildSettings.join(', ')}`);
  }

  for (const permission of ['READ_MEDIA_IMAGES', 'READ_MEDIA_VIDEO']) {
    const removed = new RegExp(`<uses-permission[^>]*android:name="android\\.permission\\.${permission}"[^>]*tools:node="remove"`).test(androidManifest);
    if (!removed) fail(`AndroidManifest.xml must keep tools:node="remove" on ${permission} (expo prebuild regresses this)`);
  }

  const forbiddenPlistKeys = ['NSBonjourServices', 'NSLocalNetworkUsageDescription', 'RCTMetroPort'];
  const foundDevLauncherKeys = forbiddenPlistKeys.filter((key) => iosInfo.includes(key));
  if (foundDevLauncherKeys.length) {
    fail(`ios/Sauci/Info.plist must not contain dev-launcher-only keys reintroduced by expo prebuild: ${foundDevLauncherKeys.join(', ')}`);
  }

  const tracked = isTracked ?? ((relative) => gitStatus(['ls-files', '--error-unmatch', relative], root) === 0);
  if (!tracked(certificatePath)) fail(`${certificatePath} must be tracked`);
  const archiveIgnore = existsSync(join(root, '.easignore')) ? '.easignore' : '.gitignore';
  if (!existsSync(join(root, archiveIgnore))) fail(`missing root ${archiveIgnore} archive rules`);
  const archiveRules = file(archiveIgnore).split(/\r?\n/).map((line) => line.trim());
  const pemRules = archiveRules.map((line, index) => line === '*.pem' ? index : -1).filter((index) => index >= 0);
  const certificateAllowlist = archiveRules.lastIndexOf(`!${certificatePath}`);
  if (!pemRules.length) fail(`${archiveIgnore} must retain the private-key-safe *.pem archive rule`);
  if (certificateAllowlist <= Math.max(...pemRules)) {
    fail(`${archiveIgnore} must later allowlist !${certificatePath} for the public OTA certificate`);
  }
  if (!file(certificatePath).trim()) fail(`${certificatePath} is empty`);

  return { publicVersion, iosBuild: appBuild };
}

export function validateLocalEas(environment = process.env) {
  const pluginPath = environment.EAS_LOCAL_BUILD_PLUGIN_PATH;
  if (!pluginPath) fail('EAS_LOCAL_BUILD_PLUGIN_PATH must name the matching local-build plugin executable bin/run');
  if (!pluginPath.endsWith('/bin/run') || !existsSync(pluginPath) || !statSync(pluginPath).isFile()) {
    fail('EAS_LOCAL_BUILD_PLUGIN_PATH must point to an existing executable bin/run, not a package directory');
  }
  if (!statSync(pluginPath).mode.toString(8).match(/[1357][0-7][0-7]$/)) fail('EAS_LOCAL_BUILD_PLUGIN_PATH bin/run is not executable');
}

export function validateFreeDisk(root = repoRoot, readStats = statfsSync) {
  const stats = readStats(root);
  const freeBytes = Number(stats.bavail) * Number(stats.bsize);
  if (freeBytes < minimumFreeBuildBytes) {
    fail(`need at least 20 GiB free before a local build; found ${(freeBytes / 1024 ** 3).toFixed(1)} GiB`);
  }
}

export function main(args = process.argv.slice(2), environment = process.env) {
  if (args.length > 1 || (args.length === 1 && args[0] !== '--local-eas')) {
    fail('usage: node scripts/release-preflight.mjs [--local-eas]');
  }
  const result = validateReleaseSources();
  validateFreeDisk();
  if (args.includes('--local-eas')) validateLocalEas(environment);
  console.log(`Mobile release source preflight passed for v${result.publicVersion}, iOS build ${result.iosBuild}`);
}

if (process.argv[1] === new URL(import.meta.url).pathname) main();
