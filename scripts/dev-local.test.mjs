import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const launcherPath = fileURLToPath(new URL('./dev-local.sh', import.meta.url));

test('native launcher retains a UTF-8 locale after sanitizing its environment', async () => {
  const launcher = await readFile(launcherPath, 'utf8');
  const nativeCommand = launcher.slice(launcher.indexOf('cmd_native() {'), launcher.indexOf('\ncase "${1:-up}" in'));

  assert.match(nativeCommand, /env -i[\s\S]*LANG=en_US\.UTF-8 LC_ALL=en_US\.UTF-8/);
});
