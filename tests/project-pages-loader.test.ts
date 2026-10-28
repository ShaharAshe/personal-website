// Tests for the `projects` collection loader's decision logic (src/lib/project-pages-loader.ts).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  ProjectPagesError,
  listProjectPageFiles,
  projectPagesAction,
  readableExtensions,
} from '../src/lib/project-pages-loader.ts';

const MD_ONLY = ['.md'];
const MD_AND_MDX = ['.md', '.mdx'];

test('readableExtensions: no integrations → .md only', () => {
  assert.deepEqual(readableExtensions([]), ['.md']);
});

test('readableExtensions: with @astrojs/mdx → .md and .mdx', () => {
  assert.deepEqual(readableExtensions(['@astrojs/react', '@astrojs/mdx']), ['.md', '.mdx']);
});

test('readableExtensions: other integrations only → no .mdx', () => {
  assert.deepEqual(readableExtensions(['@astrojs/react']), ['.md']);
});

test('no files: empty collection, glob() not called', () => {
  assert.equal(projectPagesAction([], MD_ONLY), 'empty');
  assert.equal(projectPagesAction([], MD_AND_MDX), 'empty');
});

test('a .md page: hand off to glob()', () => {
  assert.equal(projectPagesAction(['log-analytics-platform.md'], MD_ONLY), 'glob');
});

test('a .mdx page with the mdx entry type registered: hand off to glob()', () => {
  assert.equal(projectPagesAction(['log-analytics-platform.mdx', 'other.md'], MD_AND_MDX), 'glob');
});

test('a .mdx page without @astrojs/mdx: fails, naming the file', () => {
  assert.throws(
    () => projectPagesAction(['ok.md', 'log-analytics-platform.mdx'], MD_ONLY),
    (error: Error) =>
      error instanceof ProjectPagesError &&
      error.message.includes('log-analytics-platform.mdx') &&
      !error.message.includes('ok.md') &&
      error.message.includes('@astrojs/mdx'),
  );
});

test('listProjectPageFiles: a missing folder is no files', () => {
  assert.deepEqual(listProjectPageFiles(path.join(os.tmpdir(), 'no-such-project-pages-dir')), []);
});

test('listProjectPageFiles: only .md/.mdx files, including nested ones', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'project-pages-test-'));
  test.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  for (const file of ['a.md', 'b.MDX', 'notes.txt', '.gitkeep', 'nested/c.mdx']) {
    fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
    fs.writeFileSync(path.join(dir, file), '');
  }
  fs.mkdirSync(path.join(dir, 'folder.md'));
  assert.deepEqual(
    listProjectPageFiles(dir)
      .map((file) => file.replaceAll('\\', '/'))
      .sort(),
    ['a.md', 'b.MDX', 'nested/c.mdx'],
  );
});
