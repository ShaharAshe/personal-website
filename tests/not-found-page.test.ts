// The 404 page (Task 2.12): the Cloudflare setting that serves it, matched as text and anchored to the start of the
// line so a commented-out setting doesn't count, and the built dist/404.html (skipped without a build). The status
// and the behavior in a browser are in tests/e2e/not-found.spec.ts. The footer and link-text tests in
// tests/homepage.test.ts and the trailing-slash test run over this page too.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { CF_BEACON_SRC } from '../src/lib/analytics.ts';
import { pageJsGzipBytes, pageScripts } from './helpers/page-js.ts';
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

test('the 404 page ships only the theme scripts and the analytics beacon: no email or clipboard code', { skip }, () => {
  assert.doesNotMatch(html, /data-email-/);
  // The site's own scripts; the beacon is the one external script (it counts in the size below).
  const { local: scripts, external } = pageScripts(html, DIST);
  assert.ok(scripts.length > 0);
  assert.deepEqual(external, [CF_BEACON_SRC]);
  for (const code of scripts) assert.doesNotMatch(code, /clipboard/i);
  const bytes = pageJsGzipBytes(html, DIST);
  console.log(`404 JS: ${(bytes / 1024).toFixed(2)} KB gzipped (beacon included), ${scripts.length + 1} scripts`);
});

// --- The lost page game (Task F.3) ---

const GAME_CHUNK_GZIP_LIMIT = 8 * 1024;

/** The page's own module scripts (src under /_astro/), with their code. */
const astroScripts = (page: string) =>
  [...page.matchAll(/<script\b[^>]*\bsrc="(\/_astro\/[^"]+\.js)"/g)].map(([, src = '']) => ({
    src,
    code: fs.readFileSync(path.join(DIST, src), 'utf8'),
  }));

/** The game's loader on the 404 page, and the file it imports on Play. */
function gameFiles() {
  const loader = astroScripts(html).find(({ code }) => code.includes('[data-game]'));
  assert.ok(loader, 'no game loader script on the 404 page');
  const chunk = loader.code.match(/import\(`\.\/([^`]+\.js)`\)|import\("\.\/([^"]+\.js)"\)/);
  const file = chunk?.[1] ?? chunk?.[2];
  assert.ok(file, 'the loader has no dynamic import of the game');
  return { loader, chunk: `/_astro/${file}`, chunkCode: fs.readFileSync(path.join(DIST, '_astro', file), 'utf8') };
}

const gameSection = main.match(/<section\b[^>]*data-game[\s\S]*?<\/section>/)?.[0] ?? '';

test("the game comes after the page's own content: heading, text and Back to home first", { skip }, () => {
  assert.ok(gameSection, 'no game section in <main>');
  const order = ['<h1', 'nothing at this address', 'data-not-found-home', 'data-game'].map((s) => main.indexOf(s));
  for (const i of order) assert.ok(i >= 0);
  assert.deepEqual(
    [...order].sort((a, b) => a - b),
    order,
  );
});

test('the game canvas has a name, keyboard focus and points to the visible controls line', { skip }, () => {
  const canvas = gameSection.match(/<canvas\b[^>]*>/)?.[0] ?? '';
  assert.match(canvas, /\baria-label="[^"]+"/);
  assert.match(canvas, /\brole="application"/);
  assert.match(canvas, /\btabindex="0"/);
  assert.match(canvas, /\bdata-game-state="idle"/);
  const describedBy = canvas.match(/\baria-describedby="([^"]+)"/)?.[1];
  assert.ok(describedBy);
  const controls = gameSection.match(new RegExp(`<p [^>]*id="${describedBy}"[^>]*>([^<]+)</p>`))?.[1] ?? '';
  assert.match(controls, /Space/);
  assert.match(controls, /tap/);
  assert.match(controls, /Enter/);
});

test(
  'the game has a Play button (outline: the only accent-filled one stays Back to home) and its words',
  { skip },
  () => {
    const play = gameSection.match(/<button\b[^>]*data-game-play[^>]*>([\s\S]*?)<\/button>/);
    assert.ok(play);
    assert.match(play[0], /\btype="button"/);
    assert.doesNotMatch(play[0], /\bbg-accent\b/);
    assert.equal(play[1]!.trim(), 'Play');
    assert.doesNotMatch(gameSection, /\baccent\b/, 'no accent anywhere in the game (accent means clickable)');
    // The score line isn't live (it changes all the time); only the game-over line is.
    assert.doesNotMatch(gameSection.match(/<p\b[^>]*data-game-score[^>]*>/)?.[0] ?? 'x', /aria-live/);
    assert.match(gameSection, /<p\b[^>]*data-game-status[^>]*aria-live="polite"[^>]*><\/p>/);
  },
);

test('the still picture before Play is inline SVG, hidden from screen readers: nothing to download', { skip }, () => {
  const poster = gameSection.match(/<div\b[^>]*data-game-poster[\s\S]*?<\/svg>/)?.[0] ?? '';
  assert.match(poster, /<svg\b[^>]*aria-hidden="true"/);
  assert.doesNotMatch(gameSection, /<img\b|url\(/);
});

test(
  `the game itself is loaded only on Play, and stays under ${GAME_CHUNK_GZIP_LIMIT / 1024} KB gzipped`,
  { skip },
  () => {
    const { loader, chunk, chunkCode } = gameFiles();
    assert.ok(!html.includes(chunk), 'the game file is not linked from the page (no preload either)');
    const loaderBytes = zlib.gzipSync(loader.code).length;
    const chunkBytes = zlib.gzipSync(chunkCode).length;
    console.log(
      `404 game: loader ${(loaderBytes / 1024).toFixed(2)} KB up front, game ${(chunkBytes / 1024).toFixed(2)} KB on Play (gzipped)`,
    );
    assert.ok(chunkBytes < GAME_CHUNK_GZIP_LIMIT, `the game is ${chunkBytes} bytes gzipped`);
  },
);

test('no game on / or /resume: no markup, no loader, no game file', { skip }, () => {
  const { loader, chunk } = gameFiles();
  for (const page of [home, resume]) {
    assert.doesNotMatch(page, /data-game/);
    const srcs = astroScripts(page).map(({ src }) => src);
    assert.ok(!srcs.includes(loader.src));
    assert.ok(!page.includes(chunk));
    for (const { code } of astroScripts(page)) assert.ok(!code.includes(chunk.replace('/_astro/', '')));
  }
});
