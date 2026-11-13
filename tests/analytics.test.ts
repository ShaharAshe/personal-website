// Cloudflare Web Analytics (Task 2.15, design-doc §15). Unit tests on the production-only gate in src/lib/analytics.ts
// (the dev server's output isn't tested; the gate is), then the build: every page, the 404 included, ends its <body>
// with exactly one beacon tag carrying the configured token. That the CSP allows it and the e2e tests block it is in
// tests/csp.test.ts and tests/e2e/analytics.spec.ts.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { CF_BEACON_SCRIPT, listHtmlPages } from '../scripts/csp/csp.mts';
import { CF_BEACON_SRC, CF_BEACON_TOKEN, analyticsBeacon } from '../src/lib/analytics.ts';

const ROOT = path.join(import.meta.dirname, '..');
const DIST = path.join(ROOT, 'dist');
const skip = fs.existsSync(path.join(DIST, 'index.html')) ? false : 'no dist/index.html: run npm run build first';

// --- the gate ---

test('analyticsBeacon: no beacon outside a production build (npm run dev)', () => {
  assert.equal(analyticsBeacon(false), null);
});

test('analyticsBeacon: in a production build, the beacon URL and the token as JSON', () => {
  assert.deepEqual(analyticsBeacon(true), {
    src: 'https://static.cloudflareinsights.com/beacon.min.js',
    config: `{"token":"${CF_BEACON_TOKEN}"}`,
  });
});

test('the token looks like a Web Analytics site token (32 hex characters)', () => {
  assert.match(CF_BEACON_TOKEN, /^[0-9a-f]{32}$/);
});

test('BaseLayout gates the beacon on import.meta.env.PROD', () => {
  const layout = fs.readFileSync(path.join(ROOT, 'src', 'layouts', 'BaseLayout.astro'), 'utf8');
  assert.match(layout, /analyticsBeacon\(import\.meta\.env\.PROD\)/);
  assert.doesNotMatch(layout, /cloudflareinsights/, 'the URL lives in src/lib/analytics.ts only');
});

test('the CSP allows the same beacon URL the pages load', () => {
  assert.equal(CF_BEACON_SCRIPT, CF_BEACON_SRC);
});

// --- the build ---

const decode = (value: string) =>
  value
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
const attr = (tag: string, name: string) => {
  const match = tag.match(new RegExp(`\\s${name}(?:=(?:"([^"]*)"|'([^']*)'|([^\\s>]+)))?`));
  return match ? decode(match[1] ?? match[2] ?? match[3] ?? '') : undefined;
};

const pages = skip ? [] : listHtmlPages(DIST);

test('the build has the three pages, 404 included', { skip }, () => {
  assert.deepEqual(
    pages.map((file) => file.replace(/\\/g, '/')),
    ['404.html', 'index.html', 'resume/index.html'],
  );
});

for (const file of pages) {
  test(`${file}: one beacon tag, a module script with the configured token, last in <body>`, { skip }, () => {
    const html = fs.readFileSync(path.join(DIST, file), 'utf8');
    const tags = [...html.matchAll(/<script\b[^>]*\bdata-cf-beacon\b[^>]*>/g)].map(([tag]) => tag);
    assert.equal(tags.length, 1, 'expected exactly one beacon tag');
    assert.equal([...html.matchAll(/cloudflareinsights/g)].length, 1, 'the beacon URL appears once');
    const tag = tags[0]!;
    assert.equal(attr(tag, 'type'), 'module');
    assert.equal(attr(tag, 'src'), CF_BEACON_SRC);
    assert.deepEqual(JSON.parse(attr(tag, 'data-cf-beacon') ?? ''), { token: CF_BEACON_TOKEN });
    assert.match(html, /<script\b[^>]*\bdata-cf-beacon\b[^>]*><\/script>\s*<\/body>/, 'not last before </body>');
  });
}
