// The long-lived cache rule (Task 3.4a, design-doc §12): dist/_headers caches /_astro/* for a year without
// revalidation (immutable), every file there has a content hash in its name (a change is a new URL), and no other
// path gets a Cache-Control rule, so og-image.png, favicon.ico, apple-touch-icon.png, resume.pdf and the pages keep
// Cloudflare's default (revalidate every time). The served header is checked by tests/e2e/fonts.spec.ts, locally and
// live. Skipped, with a message, when there's no build.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { headersRuleMatches, parseHeaders } from '../scripts/csp/csp.mts';

const ROOT = path.join(import.meta.dirname, '..');
const DIST = path.join(ROOT, 'dist');
const skip = fs.existsSync(path.join(DIST, '_headers')) ? false : 'no dist/_headers: run npm run build first';

const IMMUTABLE = 'public, max-age=31536000, immutable';

// Astro's names: "<name>.<8-character hash>.<ext>" for bundles, a 16-hex-digit hash for the font files.
const HASHED_NAME = /^(?:.+\.[A-Za-z0-9_-]{8}|[0-9a-f]{16})\.[a-z0-9]+$/;

/** Every file under dir, as URL paths ("/_astro/x.js"). */
function urlPaths(dir: string): string[] {
  return fs
    .readdirSync(dir, { recursive: true, encoding: 'utf8' })
    .filter((file) => fs.statSync(path.join(dir, file)).isFile())
    .map((file) => `/${file.split(path.sep).join('/')}`)
    .sort();
}

/** The Cache-Control values every rule matching urlPath sets (Cloudflare applies every matching rule). */
function cacheControlFor(rules: ReturnType<typeof parseHeaders>, urlPath: string): string[] {
  return rules
    .filter((rule) => headersRuleMatches(rule.path, urlPath))
    .flatMap((rule) => rule.headers.filter(({ name }) => name.toLowerCase() === 'cache-control'))
    .map(({ value }) => value);
}

test('headersRuleMatches: splats match any run of characters, placeholders one segment, the rest exactly', () => {
  assert.ok(headersRuleMatches('/_astro/*', '/_astro/fonts/abc.woff2'));
  assert.ok(headersRuleMatches('/_astro/*', '/_astro/x.css'));
  assert.ok(headersRuleMatches('/*', '/'));
  assert.ok(headersRuleMatches('/resume.pdf', '/resume.pdf'));
  assert.ok(headersRuleMatches('/blog/:slug', '/blog/hello'));
  assert.ok(!headersRuleMatches('/blog/:slug', '/blog/hello/more'));
  assert.ok(!headersRuleMatches('/_astro/*', '/_astrox/a.js'));
  assert.ok(!headersRuleMatches('/_astro/*', '/og-image.png'));
  assert.ok(!headersRuleMatches('/resume.pdf', '/resumexpdf'), 'a dot is literal');
  assert.ok(!headersRuleMatches('/resume.pdf', '/resume.pdf/x'));
});

const rules = skip ? [] : parseHeaders(fs.readFileSync(path.join(DIST, '_headers'), 'utf8'));

test(
  'dist/_headers: /_astro/* is cached for a year without revalidation, and is the only Cache-Control rule',
  { skip },
  () => {
    const withCacheControl = rules.filter((rule) =>
      rule.headers.some(({ name }) => name.toLowerCase() === 'cache-control'),
    );
    assert.deepEqual(
      withCacheControl.map((rule) => [rule.path, rule.headers.map(({ name, value }) => `${name}: ${value}`)]),
      [['/_astro/*', [`Cache-Control: ${IMMUTABLE}`]]],
    );
    assert.ok(!rules.some((rule) => rule.detached.some((name) => name.toLowerCase() === 'cache-control')));
  },
);

test('every file under dist/_astro/ has a content hash in its name, and gets the immutable header', { skip }, () => {
  const files = urlPaths(path.join(DIST, '_astro')).map((file) => `/_astro${file}`);
  assert.ok(
    files.some((file) => file.endsWith('.woff2')),
    'no fonts under /_astro/',
  );
  for (const file of files) {
    assert.match(path.posix.basename(file), HASHED_NAME, `${file} has no content hash in its name`);
    assert.deepEqual(cacheControlFor(rules, file), [IMMUTABLE], file);
  }
});

test(
  'no file outside /_astro/ gets a Cache-Control rule (pages, PDF, OG image, icons, robots, sitemap)',
  { skip },
  () => {
    const files = urlPaths(DIST).filter((file) => !file.startsWith('/_astro/'));
    // The paths pages are served at, besides their files, and an unknown path (the 404 page).
    const served = ['/', '/resume', '/no-such-page'];
    for (const name of [
      '/og-image.png',
      '/favicon.ico',
      '/favicon.svg',
      '/apple-touch-icon.png',
      '/resume.pdf',
      '/robots.txt',
    ]) {
      assert.ok(files.includes(name), `${name} is not in dist/`);
    }
    for (const file of [...files, ...served]) assert.deepEqual(cacheControlFor(rules, file), [], file);
  },
);
