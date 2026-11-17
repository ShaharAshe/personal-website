// The doodles (Task F.4) in the built site:
// - dist/ (the build that deploys): no doodle markup or code on any page unless the build's date was a doodle day,
//   and then only on the homepage. Skipped without a build.
// - dist-doodle/ (npm run doodle:build, a forced doodle): the doodle on the homepage only, the CSP, the JS sizes.
//   Skipped locally without it; CI builds it before npm run check (deploy.yml), so there it must exist.
// - Deploy safety: dist-doodle/ is never deployed.
// The browser behavior is in tests/e2e/doodle.spec.ts; the rules in tests/doodles.test.ts.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { DOODLE_IDS, dotsOf, doodleById } from '../src/lib/doodles/doodles.ts';
import { extractInline, findUnhashable, listHtmlPages, parseHeaders, sha256Source } from '../scripts/csp/csp.mts';
import { DOODLE_DIR } from '../scripts/doodles/doodle-server.ts';
import { pageJsGzipBytes } from './helpers/page-js.ts';

const ROOT = path.join(import.meta.dirname, '..');
const DIST = path.join(ROOT, 'dist');
const DOODLE_DIST = path.join(ROOT, DOODLE_DIR);

const distSkip = fs.existsSync(path.join(DIST, 'index.html')) ? false : 'no dist/index.html: run npm run build first';
const doodleMissing = !fs.existsSync(path.join(DOODLE_DIST, 'index.html'));
// In CI the doodle build is a workflow step before npm run check: a missing one is a failure, not a skip.
const doodleSkip = doodleMissing && !process.env.CI ? `no ${DOODLE_DIR}/: run npm run doodle:build first` : false;

const LOADER_GZIP_LIMIT = 2.5 * 1024;
const PLAY_GZIP_LIMIT = 3 * 1024;

const read = (dir: string, ...parts: string[]) => fs.readFileSync(path.join(dir, ...parts), 'utf8');

/** Every text file in a build (HTML, JS, CSS, ...), relative paths. */
function textFiles(dir: string): string[] {
  return fs
    .readdirSync(dir, { recursive: true, encoding: 'utf8' })
    .filter((file) => /\.(html|js|css|txt|xml|json)$/.test(file) || path.basename(file) === '_headers');
}

/** The page's own module scripts (src under /_astro/), with their code. */
const astroScripts = (html: string, dist: string) =>
  [...html.matchAll(/<script\b[^>]*\bsrc="(\/_astro\/[^"]+\.js)"/g)].map(([, src = '']) => ({
    src,
    code: read(dist, src),
  }));

// --- dist/: what deploys ---

test(
  'dist/: no doodle on any page unless the build was on a doodle day, and then on the homepage only',
  { skip: distSkip },
  () => {
    const home = read(DIST, 'index.html');
    const id = home.match(/\bdata-doodle="([^"]+)"/)?.[1];
    const others = listHtmlPages(DIST).filter((page) => page !== 'index.html');
    assert.ok(others.includes('404.html'));
    for (const page of others) assert.doesNotMatch(read(DIST, page), /data-doodle/, page);
    if (id) {
      // The deploy build ran on a doodle day (CI's daily build): that day's doodle, and nowhere else.
      assert.ok((DOODLE_IDS as readonly string[]).includes(id), id);
      console.log(`dist/ was built on a doodle day: ${id}`);
      return;
    }
    // Zero cost on other days: no doodle markup or style in any page, and no page loads the doodle's code. (Vite still
    // writes the component's two script files to _astro/, because Hero.astro imports it, but nothing references them,
    // so no visitor downloads them.)
    // The doodle's loader, and its play.*.js (told apart from the 404 game's play.*.js by its content).
    const doodleFiles = fs
      .readdirSync(path.join(DIST, '_astro'))
      .filter((file) => file.endsWith('.js'))
      .filter((file) => file.startsWith('Doodle.astro') || read(DIST, '_astro', file).includes('doodleState'));
    for (const file of textFiles(DIST)) {
      if (doodleFiles.includes(path.basename(file))) continue;
      const text = read(DIST, file);
      assert.doesNotMatch(text, /data-doodle|doodle-bubble/, file);
      for (const name of doodleFiles) assert.ok(!text.includes(name), `${file} references ${name}`);
    }
  },
);

// --- dist-doodle/: a forced doodle ---

const doodleHome = doodleSkip || doodleMissing ? '' : read(DOODLE_DIST, 'index.html');
const forcedId = doodleHome.match(/\bdata-doodle="([^"]+)"/)?.[1] ?? '';

test(`${DOODLE_DIR}/ exists (CI builds it before npm run check)`, { skip: doodleSkip }, () => {
  assert.ok(!doodleMissing, `no ${DOODLE_DIR}/index.html: run npm run doodle:build`);
});

test(
  'dist-doodle/: one doodle, on the homepage only, a link named for the day to its Wikipedia article',
  { skip: doodleSkip },
  () => {
    const doodle = doodleById(forcedId);
    assert.ok(doodle, `unknown doodle "${forcedId}"`);
    assert.equal([...doodleHome.matchAll(/\bdata-doodle="/g)].length, 1);
    for (const page of ['404.html', path.join('resume', 'index.html')]) {
      assert.doesNotMatch(read(DOODLE_DIST, page), /data-doodle/, page);
    }
    const root = doodleHome.match(/<div\b[^>]*data-doodle="[\s\S]*?<\/svg>\s*<\/a>/)?.[0] ?? '';
    const link = root.match(/<a\b[^>]*>/)?.[0] ?? '';
    assert.match(link, new RegExp(`\\shref="${doodle.wikipedia.replace(/[.?*+^$()[\]{}|\\]/g, '\\$&')}"`));
    assert.match(link, /\shref="https:\/\/en\.wikipedia\.org\/wiki\//);
    assert.ok(link.includes(`aria-label="${doodle.label.replace(/"/g, '&quot;')}"`), link);
    assert.match(link, /\saria-describedby="doodle-bubble-text"/);
    assert.doesNotMatch(link, /\starget=/, 'same tab, like the profile links');
    assert.doesNotMatch(link, /\baccent\b/, 'no accent: the dots are --text-muted');
    assert.match(root, /<svg\b[^>]*aria-hidden="true"/);
    assert.equal([...root.matchAll(/<circle\b[^>]*\br="2"/g)].length, dotsOf(doodle.shape).length, 'one 2px dot each');
    // The bubble: hidden until hover, focus or a tap, with the day's text.
    const bubble = doodleHome.match(/<div\b[^>]*data-doodle-bubble[^>]*>/)?.[0] ?? '';
    assert.match(bubble, /\shidden\b/);
    assert.match(
      doodleHome,
      new RegExp(`<p id="doodle-bubble-text"[^>]*>${doodle.bubble.replace(/[.?*+^$()[\]{}|\\]/g, '\\$&')}</p>`),
    );
  },
);

test("dist-doodle/: the doodle comes after the Hero's name, buttons and profile links", { skip: doodleSkip }, () => {
  const order = ['<h1', 'Download Resume', 'View Projects', 'aria-label="Profiles"', 'data-doodle='].map((s) =>
    doodleHome.indexOf(s),
  );
  for (const i of order) assert.ok(i >= 0);
  assert.deepEqual(
    [...order].sort((a, b) => a - b),
    order,
  );
});

test(
  'dist-doodle/: nothing the CSP would block, and every inline script and style hashed',
  { skip: doodleSkip },
  () => {
    assert.deepEqual(findUnhashable(doodleHome), []);
    const all = parseHeaders(read(DOODLE_DIST, '_headers')).find((rule) => rule.path === '/*');
    const policy = all?.headers.find(({ name }) => name.toLowerCase() === 'content-security-policy')?.value ?? '';
    assert.match(policy, /script-src 'self'/);
    const { scripts, styles } = extractInline(doodleHome);
    for (const text of [...scripts, ...styles]) assert.ok(policy.includes(`'${sha256Source(text)}'`));
    console.log(`dist-doodle/ CSP line: ${`Content-Security-Policy: ${policy}`.length}/2000 characters`);
  },
);

test(
  'dist-doodle/: a small loader up front; the animation loads only on interaction; under the JS budget',
  { skip: doodleSkip },
  () => {
    const loader = astroScripts(doodleHome, DOODLE_DIST).find(({ code }) => code.includes('[data-doodle]'));
    assert.ok(loader, 'no doodle loader on the homepage');
    const chunk = loader.code.match(/import\("\.\/(play\.[^"]+\.js)"\)|import\(`\.\/(play\.[^`]+\.js)`\)/);
    const file = chunk?.[1] ?? chunk?.[2];
    assert.ok(file, 'the loader has no dynamic import of play');
    assert.ok(!doodleHome.includes(file), 'the animation file is not linked from the page (no preload either)');
    const loaderBytes = zlib.gzipSync(loader.code).length;
    const playBytes = zlib.gzipSync(read(DOODLE_DIST, '_astro', file)).length;
    const pageBytes = pageJsGzipBytes(doodleHome, DOODLE_DIST);
    console.log(
      `doodle: loader ${(loaderBytes / 1024).toFixed(2)} KB up front, animation ${(playBytes / 1024).toFixed(2)} KB on first interaction; homepage JS ${(pageBytes / 1024).toFixed(2)} KB (gzipped, beacon included)`,
    );
    assert.ok(loaderBytes < LOADER_GZIP_LIMIT, `loader ${loaderBytes} bytes`);
    assert.ok(playBytes < PLAY_GZIP_LIMIT, `animation ${playBytes} bytes`);
    assert.ok(pageBytes < 30 * 1024, `homepage JS ${pageBytes} bytes`);
    // Not on the other pages.
    for (const page of ['404.html', path.join('resume', 'index.html')]) {
      assert.ok(!read(DOODLE_DIST, page).includes(loader.src), page);
    }
  },
);

// --- Deploy safety: dist-doodle/ never deploys ---

test('the deploy serves dist/ only: wrangler.jsonc, the deploy step, and no DOODLE in the workflow', () => {
  const wrangler = read(ROOT, 'wrangler.jsonc');
  assert.match(wrangler, /^\s*"directory":\s*"\.\/dist",?\s*$/m);
  assert.doesNotMatch(wrangler, /dist-doodle/);
  const workflow = read(ROOT, '.github', 'workflows', 'deploy.yml');
  const deployStep = workflow.match(/- name: Deploy to Cloudflare[\s\S]*?run: (.+)/)?.[1]?.trim();
  assert.equal(deployStep, 'npx wrangler deploy', 'no --assets or other directory');
  assert.doesNotMatch(workflow, /\bDOODLE\s*:/, 'no step sets DOODLE; only npm run doodle:build forces one');
  assert.match(workflow, /run: npm run doodle:build\b/);
  // The doodle build runs after the real one, and the deploy reads what that one wrote.
  assert.ok(workflow.indexOf('run: npm run build') < workflow.indexOf('run: npm run doodle:build'));
  assert.match(read(ROOT, '.gitignore'), /^dist-doodle\/$/m);
  assert.match(read(ROOT, 'package.json'), /"doodle:build": "[^"]*scripts\/doodles\/build\.ts"/);
});
