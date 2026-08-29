#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "../../../..");
const files = {
  app: path.join(repoRoot, "apps/mobile/app.json"),
  android: path.join(repoRoot, "apps/mobile/android/app/build.gradle"),
  ios: path.join(repoRoot, "apps/mobile/ios/Sauci.xcodeproj/project.pbxproj"),
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

function readState() {
  const appRaw = fs.readFileSync(files.app, "utf8");
  const androidRaw = fs.readFileSync(files.android, "utf8");
  const iosRaw = fs.readFileSync(files.ios, "utf8");
  const appVersion = JSON.parse(appRaw).expo?.version;
  const androidVersions = [...androidRaw.matchAll(/\bversionName\s+["']([^"']+)["']/g)].map(
    (match) => match[1],
  );
  const iosVersions = [...iosRaw.matchAll(/\bMARKETING_VERSION\s*=\s*([^;]+);/g)].map(
    (match) => match[1].trim(),
  );

  if (typeof appVersion !== "string") fail("apps/mobile/app.json has no expo.version");
  if (androidVersions.length !== 1) fail("expected exactly one Android versionName");
  if (iosVersions.length === 0) fail("found no iOS MARKETING_VERSION values");

  const versions = [appVersion, ...androidVersions, ...iosVersions];
  versions.forEach((version) => parseVersion(version, `configured version ${version}`));
  if (new Set(versions).size !== 1) {
    fail(`public versions disagree: ${versions.join(", ")}`);
  }

  return { appRaw, androidRaw, iosRaw, current: appVersion, iosCount: iosVersions.length };
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
  console.log(`public version ${state.current} is consistent across app.json, Android, and ${state.iosCount} iOS settings`);
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
const iosRaw = state.iosRaw.replace(
  /(\bMARKETING_VERSION\s*=\s*)([^;]+)(;)/g,
  `$1${desired}$3`,
);

fs.writeFileSync(files.app, appRaw);
fs.writeFileSync(files.android, androidRaw);
fs.writeFileSync(files.ios, iosRaw);
console.log(`updated public version ${state.current} -> ${desired}`);
