import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { dependency } from './dependencies.mjs';
const root = path.resolve(import.meta.dirname, '..');
const manifest = JSON.parse(await fs.readFile(path.join(root, 'extension/manifest.json')));
const filename = path.join(root, `release/MailWeave-v${manifest.version}.zip`);
const before = await fs.readFile(filename);
execFileSync(process.execPath, [path.join(root, 'tools/package.mjs')]);
assert.deepEqual(await fs.readFile(filename), before, 'Repeated build must be byte-identical');
const zip = await dependency('jszip').loadAsync(before);
const expected = ['LICENSE', 'manifest.json', 'core.js', 'source.js', 'clean.js', 'view.js', 'app.js', 'options.html', 'options.css', 'options.js'].sort();
assert.deepEqual(Object.keys(zip.files).sort(), expected, 'ZIP runtime allowlist');
const packed = JSON.parse(await zip.file('manifest.json').async('string'));
assert.equal(packed.version, JSON.parse(await fs.readFile(path.join(root, 'package.json'))).version);
assert.equal(packed.manifest_version, 3);
assert.deepEqual(packed.permissions, ['storage', 'clipboardWrite']);
for (const file of expected.filter(f => f.endsWith('.js'))) {
  execFileSync(process.execPath, ['--check', path.join(root, 'extension', file)]);
  assert.equal(await zip.file(file).async('string'), await fs.readFile(path.join(root, 'extension', file), 'utf8'));
}
console.log(`PASS release allowlist, V${packed.version}, Manifest V3, JavaScript syntax, byte-identical rebuild (${before.length} bytes)`);
