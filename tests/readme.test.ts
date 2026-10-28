// Keeps README.md in step with package.json: every npm script is documented, and every `npm run <name>`
// the README mentions is a real script (so a renamed or removed script fails too).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.join(import.meta.dirname, '..');
const readme = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8');
const scripts = Object.keys(JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).scripts);

// A script name runs on until a character that can't be part of one, so `check` isn't matched by
// `npm run check:site`.
const NAME_END = '(?![\\w:-])';

function escape(name: string): string {
  return name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

test('README.md mentions every npm script', () => {
  const missing = scripts.filter((name) => !new RegExp(`npm (?:run )?${escape(name)}${NAME_END}`).test(readme));
  assert.deepEqual(missing, [], `README.md doesn't mention these npm scripts: ${missing.join(', ')}`);
});

test('every npm run <name> in README.md is a real script', () => {
  const mentioned = new Set([...readme.matchAll(/npm run ([\w:-]+)/g)].map(([, name]) => name));
  const unknown = [...mentioned].filter((name) => !scripts.includes(name));
  assert.deepEqual(unknown, [], `README.md mentions npm scripts that don't exist: ${unknown.join(', ')}`);
});
