#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "../../../..");
const files = {
  app: path.join(repoRoot, "apps/mobile/app.json"),
  appConfig: path.join(repoRoot, "apps/mobile/app.config.js"),
  android: path.join(repoRoot, "apps/mobile/android/app/build.gradle"),
  androidExpo: path.join(repoRoot, "apps/mobile/android/app/src/main/res/values/strings.xml"),
  ios: path.join(repoRoot, "apps/mobile/ios/Sauci.xcodeproj/project.pbxproj"),
  iosInfo: path.join(repoRoot, "apps/mobile/ios/Sauci/Info.plist"),
  iosExpo: path.join(repoRoot, "apps/mobile/ios/Sauci/Supporting/Expo.plist"),
  widgetInfo: path.join(repoRoot, "apps/mobile/targets/widget/Info.plist"),
};

const semverPattern = /^([0-9]+)\.([0-9]+)\.([0-9]+)$/;

function fail(message) {
  console.error(`set_version: ${message}`);
  process.exit(1);
}

function parseVersion(value, label) {
  const match = semverPattern.exec(value);
  if (!match) fail(`${label} must be an exact numeric SemVer version (x.y.z)`);
  return match.slice(1).map(Number);
}

function writePreservingFinalNewline(file, contents, previous) {
  fs.writeFileSync(file, previous.endsWith("\n") ? contents : contents.replace(/\n$/, ""));
}

function readState() {
  const appRaw = fs.readFileSync(files.app, "utf8");
  const appConfigRaw = fs.readFileSync(files.appConfig, "utf8");
  const androidRaw = fs.readFileSync(files.android, "utf8");
  const androidExpoRaw = fs.readFileSync(files.androidExpo, "utf8");
  const iosRaw = fs.readFileSync(files.ios, "utf8");
  const iosInfoRaw = fs.readFileSync(files.iosInfo, "utf8");
  const iosExpoRaw = fs.readFileSync(files.iosExpo, "utf8");
  const widgetInfoRaw = fs.readFileSync(files.widgetInfo, "utf8");
  const appVersion = JSON.parse(appRaw).expo?.version;
  const androidVersions = [...androidRaw.matchAll(/\bversionName\s+["']([^"']+)["']/g)].map(
    (match) => match[1],
  );
  const iosVersions = [...iosRaw.matchAll(/\bMARKETING_VERSION\s*=\s*([^;]+);/g)].map(
    (match) => match[1].trim(),
  );
  const plistVersion = (raw, label) => {
    const versions = [...raw.matchAll(/<key>CFBundleShortVersionString<\/key>\s*<string>([^<]+)<\/string>/g)].map(
      (match) => match[1],
    );
    if (versions.length !== 1) fail(`expected exactly one ${label} CFBundleShortVersionString`);
    return versions[0];
  };
  const iosInfoVersion = plistVersion(iosInfoRaw, "iOS app Info.plist");
  const widgetInfoVersion = plistVersion(widgetInfoRaw, "iOS widget Info.plist");
  const expoRuntimeVersion = (raw, label) => {
    const versions = [...raw.matchAll(/<key>EXUpdatesRuntimeVersion<\/key>\s*<string>([^<]+)<\/string>/g)].map(
      (match) => match[1],
    );
    if (versions.length !== 1) fail(`expected exactly one ${label} Expo runtime version`);
    return versions[0];
  };
  const appConfigRuntimeVersions = [...appConfigRaw.matchAll(/runtimeVersion:\s*['"]([^'"]+)['"]/g)].map(
    (match) => match[1],
  );
  const androidRuntimeVersions = [...androidExpoRaw.matchAll(/<string name="expo_runtime_version">([^<]+)<\/string>/g)].map(
    (match) => match[1],
  );
  if (appConfigRuntimeVersions.length !== 1) fail("expected exactly one explicit app.config.js runtimeVersion");
  if (androidRuntimeVersions.length !== 1) fail("expected exactly one Android Expo runtime version");
  const iosExpoVersion = expoRuntimeVersion(iosExpoRaw, "iOS");

  if (typeof appVersion !== "string") fail("apps/mobile/app.json has no expo.version");
  if (androidVersions.length !== 1) fail("expected exactly one Android versionName");
  if (iosVersions.length === 0) fail("found no iOS MARKETING_VERSION values");

  const versions = [
    appVersion,
    ...androidVersions,
    ...iosVersions,
    iosInfoVersion,
    widgetInfoVersion,
    appConfigRuntimeVersions[0],
    androidRuntimeVersions[0],
    iosExpoVersion,
  ];
  versions.forEach((version) => parseVersion(version, `configured version ${version}`));
  if (new Set(versions).size !== 1) {
    fail(`public versions disagree: ${versions.join(", ")}`);
  }

  return {
    appRaw,
    appConfigRaw,
    androidRaw,
    androidExpoRaw,
    iosRaw,
    iosInfoRaw,
    iosExpoRaw,
    widgetInfoRaw,
    current: appVersion,
    iosCount: iosVersions.length,
  };
}

function nextVersion(current, bump) {
  const [major, minor, patch] = parseVersion(current, "current version");
  if (bump === "major") return `${major + 1}.0.0`;
  if (bump === "minor") return `${major}.${minor + 1}.0`;
  if (bump === "patch") return `${major}.${minor}.${patch + 1}`;
  fail("--bump must be patch, minor, or major");
}

const args = process.argv.slice(2);
const check = args.length === 1 && args[0] === "--check";
const bumpIndex = args.indexOf("--bump");
const versionIndex = args.indexOf("--version");

if (!check && (bumpIndex === -1) === (versionIndex === -1)) {
  fail("use --check, --bump patch|minor|major, or --version x.y.z");
}

const state = readState();
if (check) {
  console.log(`public and OTA runtime version ${state.current} is consistent across app.json, Android, and ${state.iosCount} iOS settings`);
  process.exit(0);
}

const desired =
  bumpIndex !== -1
    ? nextVersion(state.current, args[bumpIndex + 1])
    : (parseVersion(args[versionIndex + 1], "--version"), args[versionIndex + 1]);

if (desired === state.current) fail(`requested version is already ${state.current}`);
const currentParts = parseVersion(state.current, "current version");
const desiredParts = parseVersion(desired, "requested version");
const increases = desiredParts.some(
  (part, index) => part > currentParts[index] && desiredParts.slice(0, index).every((value, prior) => value === currentParts[prior]),
);
if (!increases) fail(`requested version ${desired} must be greater than ${state.current}`);

const appRaw = state.appRaw.replace(
  /(\"version\"\s*:\s*\")([^\"]+)(\")/,
  `$1${desired}$3`,
);
const androidRaw = state.androidRaw.replace(
  /(\bversionName\s+["'])([^"']+)(["'])/,
  `$1${desired}$3`,
);
const appConfigRaw = state.appConfigRaw.replace(
  /(runtimeVersion:\s*['"])([^'"]+)(['"])/,
  `$1${desired}$3`,
);
const androidExpoRaw = state.androidExpoRaw.replace(
  /(<string name="expo_runtime_version">)([^<]+)(<\/string>)/,
  `$1${desired}$3`,
);
const iosRaw = state.iosRaw.replace(
  /(\bMARKETING_VERSION\s*=\s*)([^;]+)(;)/g,
  `$1${desired}$3`,
);
const iosInfoRaw = state.iosInfoRaw.replace(
  /(<key>CFBundleShortVersionString<\/key>\s*<string>)([^<]+)(<\/string>)/,
  `$1${desired}$3`,
);
const iosExpoRaw = state.iosExpoRaw.replace(
  /(<key>EXUpdatesRuntimeVersion<\/key>\s*<string>)([^<]+)(<\/string>)/,
  `$1${desired}$3`,
);
const widgetInfoRaw = state.widgetInfoRaw.replace(
  /(<key>CFBundleShortVersionString<\/key>\s*<string>)([^<]+)(<\/string>)/,
  `$1${desired}$3`,
);

writePreservingFinalNewline(files.app, appRaw, state.appRaw);
writePreservingFinalNewline(files.appConfig, appConfigRaw, state.appConfigRaw);
writePreservingFinalNewline(files.android, androidRaw, state.androidRaw);
writePreservingFinalNewline(files.androidExpo, androidExpoRaw, state.androidExpoRaw);
writePreservingFinalNewline(files.ios, iosRaw, state.iosRaw);
writePreservingFinalNewline(files.iosInfo, iosInfoRaw, state.iosInfoRaw);
writePreservingFinalNewline(files.iosExpo, iosExpoRaw, state.iosExpoRaw);
writePreservingFinalNewline(files.widgetInfo, widgetInfoRaw, state.widgetInfoRaw);
console.log(`updated public version ${state.current} -> ${desired}`);
