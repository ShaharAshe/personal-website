// The OG image (Task 2.13): public/og-image.png is a 1200×630 PNG under 300 KB, and it isn't stale. Its tEXt hash
// must match the hash of the template rendered from today's resume.yaml and global.css. Also the PNG helpers, and
// that the hash doesn't depend on line endings (generated on Windows, checked on Linux). Needs no build.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import {
  OG_HASH_KEY,
  OG_HEIGHT,
  OG_IMAGE_FILE,
  OG_MAX_BYTES,
  OG_WIDTH,
  ogImageHtml,
  ogSourceHash,
} from '../scripts/og/og-image-html.ts';
import { isPng, pngChunks, readPngSize, readPngText, withPngText } from '../scripts/og/png.ts';
import { GLOBAL_CSS, darkTokens, readDarkTokens } from '../scripts/og/tokens.ts';
import { heroContent } from '../src/lib/hero.ts';
import { getEmailParts, getResume } from '../src/lib/resume.ts';

const ROOT = path.join(import.meta.dirname, '..');
const png = fs.readFileSync(OG_IMAGE_FILE);
const contentOf = (resumePath?: string) => {
  const { name, title, tagline } = heroContent(getResume(resumePath));
  return { name, title, tagline };
};

test('public/og-image.png is a PNG of exactly 1200×630', () => {
  assert.ok(isPng(png), 'bad PNG signature');
  assert.deepEqual(readPngSize(png), { width: 1200, height: 630 });
  assert.deepEqual({ width: OG_WIDTH, height: OG_HEIGHT }, { width: 1200, height: 630 });
});

test('public/og-image.png is under 300 KB (WhatsApp skips larger preview images)', () => {
  assert.ok(png.length < OG_MAX_BYTES, `og-image.png is ${png.length} bytes`);
  assert.equal(OG_MAX_BYTES, 300 * 1024);
});

test('public/og-image.png is not stale (its hash matches resume.yaml, global.css and the template)', () => {
  const stored = readPngText(png, OG_HASH_KEY);
  assert.ok(stored, `no ${OG_HASH_KEY} in og-image.png: regenerate it with npm run build && npm run og`);
  assert.equal(
    stored,
    ogSourceHash(contentOf(), readDarkTokens()),
    'OG image is stale: run npm run build && npm run og, then npm run build again, and commit public/og-image.png',
  );
});

test('every chunk of public/og-image.png has a valid CRC', () => {
  for (const { type, crcOk } of pngChunks(png)) assert.ok(crcOk, `bad CRC in ${type}`);
});

test('the template shows the name, title and tagline from resume.yaml, escaped', () => {
  const content = contentOf();
  const html = ogImageHtml(content, readDarkTokens());
  const escape = (t: string) => t.trim().replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  for (const text of [content.name, content.title, content.tagline]) assert.ok(html.includes(escape(text)), text);
  const injected = ogImageHtml({ name: '<b>x</b>', title: 'a & b', tagline: '"t"' }, readDarkTokens());
  assert.ok(injected.includes('&lt;b&gt;x&lt;/b&gt;') && injected.includes('a &amp; b'));
});

test('the template has no email (true/false only)', () => {
  const html = ogImageHtml(contentOf(), readDarkTokens());
  const { user, domain } = getEmailParts();
  assert.equal(html.includes(`${user}@${domain}`), false);
  assert.equal(html.includes('mailto:'), false);
});

test('the template uses only the dark tokens from global.css for colors', () => {
  const tokens = readDarkTokens();
  const html = ogImageHtml(contentOf(), tokens);
  for (const name of ['--bg', '--text', '--text-muted', '--accent']) assert.ok(html.includes(tokens[name]), name);
  const allowed = new Set(Object.values(tokens).map((v) => v.toLowerCase()));
  for (const [hex] of html.matchAll(/#[0-9a-f]{3,8}\b/gi))
    assert.ok(allowed.has(hex.toLowerCase()), `raw color ${hex}`);
});

test('the hash is the same for CRLF and LF inputs (resume.yaml, global.css, template)', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'og-hash-'));
  try {
    const yamlText = fs
      .readFileSync(path.join(ROOT, 'tests', 'fixtures', 'resume-valid.yaml'), 'utf8')
      .replace(/\r\n/g, '\n');
    const lfPath = path.join(dir, 'lf.yaml');
    const crlfPath = path.join(dir, 'crlf.yaml');
    fs.writeFileSync(lfPath, yamlText);
    fs.writeFileSync(crlfPath, yamlText.replace(/\n/g, '\r\n'));

    const cssText = fs.readFileSync(GLOBAL_CSS, 'utf8').replace(/\r\n/g, '\n');
    const lfTokens = darkTokens(cssText);
    const crlfTokens = darkTokens(cssText.replace(/\n/g, '\r\n'));
    assert.deepEqual(crlfTokens, lfTokens);

    const lf = ogSourceHash(contentOf(lfPath), lfTokens);
    assert.equal(ogSourceHash(contentOf(crlfPath), crlfTokens), lf);
    // A token value or text that carries a stray CR hashes the same too.
    const withCr = Object.fromEntries(Object.entries(lfTokens).map(([k, v]) => [k, `${v}\r`]));
    const content = contentOf(lfPath);
    assert.equal(
      ogSourceHash({ ...content, tagline: content.tagline.replace(/ /, '\r\n') }, withCr),
      ogSourceHash({ ...content, tagline: content.tagline.replace(/ /, '\n') }, lfTokens),
    );
    // A template file checked out with CRLF puts CRs inside the template literal: the hash normalizes them.
    assert.doesNotMatch(ogImageHtml(content, lfTokens), /\r/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('the hash changes when the text or a token changes', () => {
  const content = contentOf();
  const tokens = readDarkTokens();
  const hash = ogSourceHash(content, tokens);
  assert.notEqual(ogSourceHash({ ...content, title: `${content.title}!` }, tokens), hash);
  assert.notEqual(ogSourceHash(content, { ...tokens, '--accent': '#000000' }), hash);
});

test('withPngText adds a readable tEXt chunk with a valid CRC, and replaces an older one', () => {
  const once = withPngText(png, 'test-key', 'one');
  const twice = withPngText(once, 'test-key', 'two');
  assert.equal(readPngText(twice, 'test-key'), 'two');
  assert.equal(
    pngChunks(twice).filter(({ type, data }) => type === 'tEXt' && data.toString('latin1').startsWith('test-key\0'))
      .length,
    1,
  );
  for (const { type, crcOk } of pngChunks(twice)) assert.ok(crcOk, `bad CRC in ${type}`);
  assert.deepEqual(readPngSize(twice), readPngSize(png));
  assert.equal(pngChunks(twice)[0].type, 'IHDR');
  // The image data is untouched.
  const idat = (p: Buffer) =>
    Buffer.concat(
      pngChunks(p)
        .filter(({ type }) => type === 'IDAT')
        .map(({ data }) => data),
    );
  assert.ok(zlib.inflateSync(idat(twice)).equals(zlib.inflateSync(idat(png))));
});

test('readPngSize rejects a file that is not a PNG', () => {
  assert.throws(() => readPngSize(Buffer.from('GIF89a not a png at all')));
});
