// Tests for scripts/cv/publish-pdf.ts (last step of npm run build) and the public/_headers rule that
// gives /resume.pdf its published file name. Runs the CLI as a child process against temp dirs, with a
// hand-built PDF, so no LibreOffice or CV_PHONE is needed.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { RESUME_BASENAME } from '../scripts/cv/paths.js';
import { writeTextPdf } from './helpers/pdf.ts';

const ROOT = path.join(import.meta.dirname, '..');
const script = path.join(ROOT, 'scripts', 'cv', 'publish-pdf.ts');

function run(args: string[]) {
  return spawnSync(process.execPath, ['--disable-warning=MODULE_TYPELESS_PACKAGE_JSON', script, ...args], {
    encoding: 'utf8',
  });
}

function tempDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'publish-pdf-test-'));
  test.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

test('copies the resume PDF to dist/resume.pdf unchanged', () => {
  const dir = tempDir();
  const pdf = path.join(dir, `${RESUME_BASENAME}.pdf`);
  writeTextPdf(pdf, ['Test Resume']);
  const dist = path.join(dir, 'dist');
  fs.mkdirSync(dist);

  const result = run([pdf, dist]);

  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(fs.readFileSync(path.join(dist, 'resume.pdf')), fs.readFileSync(pdf));
});

test('fails without writing anything if the PDF is missing', () => {
  const dir = tempDir();
  const dist = path.join(dir, 'dist');
  fs.mkdirSync(dist);

  const result = run([path.join(dir, 'missing.pdf'), dist]);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /PDF not found/);
  assert.deepEqual(fs.readdirSync(dist), []);
});

test('fails if dist/ does not exist', () => {
  const dir = tempDir();
  const pdf = path.join(dir, 'resume.pdf');
  writeTextPdf(pdf, ['Test Resume']);

  const result = run([pdf, path.join(dir, 'dist')]);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /not found: run astro build first/);
});

test('public/_headers serves /resume.pdf inline with the published file name', () => {
  const headers = fs.readFileSync(path.join(ROOT, 'public', '_headers'), 'utf8');
  // The rule block: the "/resume.pdf" line and the indented header lines under it.
  const block = headers.match(/^\/resume\.pdf[ \t]*\r?\n((?:[ \t]+.+\r?\n?)+)/m);
  assert.ok(block, 'no /resume.pdf rule in public/_headers');
  assert.match(block[1], new RegExp(`^\\s+Content-Disposition: inline; filename="${RESUME_BASENAME}\\.pdf"$`, 'm'));
});
