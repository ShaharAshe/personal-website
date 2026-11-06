// The 404 page (Task 2.12): the Cloudflare setting that serves it, matched as text and anchored to the start of the
// line so a commented-out setting doesn't count, and the built dist/404.html (skipped without a build). The status
// and the behavior in a browser are in tests/e2e/not-found.spec.ts. The footer and link-text tests in
// tests/homepage.test.ts and the trailing-slash test run over this page too.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { listSiteFiles } from '../scripts/checks/dist-files.ts';

const ROOT = path.join(import.meta.dirname, '..');
const DIST = path.join(ROOT, 'dist');
const skip = fs.existsSync(path.join(DIST, '404.html')) ? false : 'no dist/404.html: run npm run build first';

const read = (...parts: string[]) => (skip ? '' : fs.readFileSync(path.join(DIST, ...parts), 'utf8'));
const html = read('404.html');
const home = read('index.html');
const resume = read('resume', 'index.html');

const titleOf = (page: string) => page.match(/<title>([^<]+)<\/title>/)?.[1];
const descriptionOf = (page: string) => page.match(/<meta name="description" content="([^"]+)"/)?.[1];
const ROBOTS_NOINDEX = /<meta name="robots" content="noindex"/;
const main = html.match(/<main\b[\s\S]*<\/main>/)?.[0] ?? '';

test('wrangler.jsonc sets assets.not_found_handling to 404-page', () => {
  const config = fs.readFileSync(path.join(ROOT, 'wrangler.jsonc'), 'utf8');
  assert.match(config, /^\s*"not_found_handling":\s*"404-page"/m);
});

test('the no-phone and no-email checks scan 404.html', { skip }, () => {
  assert.ok(listSiteFiles(DIST).includes('404.html'));
});

test('the 404 page has exactly one <h1>', { skip }, () => {
  assert.deepEqual(
    [...html.matchAll(/<h1\b[^>]*>([^<]*)<\/h1>/g)].map(([, text]) => text),
    ['Page not found'],
  );
});

test('the 404 title and description are unique', { skip }, () => {
  for (const describe of [titleOf, descriptionOf]) {
    const value = describe(html);
    assert.ok(value);
    assert.notEqual(value, describe(home));
    assert.notEqual(value, describe(resume));
  }
});

test('only the 404 page is noindex', { skip }, () => {
  assert.match(html, ROBOTS_NOINDEX);
  assert.doesNotMatch(home, ROBOTS_NOINDEX);
  assert.doesNotMatch(resume, ROBOTS_NOINDEX);
});

test('no nav item is marked as the current page', { skip }, () => {
  assert.doesNotMatch(html, /aria-current/);
});

test('the back link goes to the homepage, with its arrow as text hidden from screen readers', { skip }, () => {
  const link = main.match(/<a\b[^>]*data-not-found-home[\s\S]*?<\/a>/)?.[0] ?? '';
  assert.match(link, /\shref="\/"/);
  assert.match(link, /<span[^>]*aria-hidden="true"[^>]*>←<\/span>/);
  assert.match(link, /Back to home/);
});

test('the 404 footer has no Back to top link: the page is too short to scroll', { skip }, () => {
  assert.match(html, /<footer\b/);
  assert.doesNotMatch(html, /data-back-to-top/);
});

test('<main> has one accent-filled element at most', { skip }, () => {
  assert.ok(main, 'no <main>');
  assert.ok([...main.matchAll(/\bbg-accent\b/g)].length <= 1);
});

test('the 404 page ships only the theme scripts: no email or clipboard code', { skip }, () => {
  assert.doesNotMatch(html, /data-email-/);
  const scripts = [...html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)].map(([, attrs, text]) => {
    const src = attrs.match(/\bsrc="([^"]+)"/)?.[1];
    return src ? fs.readFileSync(path.join(DIST, src)).toString() : text;
  });
  assert.ok(scripts.length > 0);
  for (const code of scripts) assert.doesNotMatch(code, /clipboard/i);
  const bytes = scripts.reduce((sum, code) => sum + zlib.gzipSync(code).length, 0);
  console.log(`404 JS: ${(bytes / 1024).toFixed(2)} KB gzipped, ${scripts.length} scripts`);
});
