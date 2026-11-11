// The site icons (Task 2.13a): public/favicon.ico holds exactly 16, 32 and 48 px PNGs, public/apple-touch-icon.png is
// 180×180, and neither is stale (each PNG's tEXt hash matches the template rendered from today's resume.yaml name and
// global.css). Also the initials, the ICO reader/writer, and that the hash doesn't depend on line endings. Needs no
// build. That the apple-touch-icon has no transparent pixel is checked in a real browser (tests/e2e/seo.spec.ts).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { readIco, writeIco } from '../scripts/og/ico.ts';
import {
  APPLE_TOUCH_ICON_FILE,
  FAVICON_FILE,
  ICON_HASH_KEY,
  ICON_SIZES,
  iconHtml,
  iconSourceHash,
  initialsOf,
} from '../scripts/og/icon-html.ts';
import { isPng, pngChunks, readPngSize, readPngText } from '../scripts/og/png.ts';
import { GLOBAL_CSS, darkTokens, readDarkTokens } from '../scripts/og/tokens.ts';
import { getResume } from '../src/lib/resume.ts';
import { SITE_ICONS } from '../src/lib/seo.ts';

const ROOT = path.join(import.meta.dirname, '..');
const ico = fs.readFileSync(FAVICON_FILE);
const apple = fs.readFileSync(APPLE_TOUCH_ICON_FILE);
const REFRESH = 'run npm run build && npm run og, then npm run build again, and commit the icons in public/';

const allPngs = () => [
  ...readIco(ico).map(({ width, png }) => ({ label: `favicon.ico ${width}px`, png })),
  { label: 'apple-touch-icon.png', png: apple },
];

test('the icon files are where SITE_ICONS says', () => {
  assert.equal(FAVICON_FILE, path.join(ROOT, 'public', 'favicon.ico'));
  assert.equal(APPLE_TOUCH_ICON_FILE, path.join(ROOT, 'public', 'apple-touch-icon.png'));
  assert.deepEqual(SITE_ICONS.favicon.sizes, [16, 32, 48]);
  assert.equal(SITE_ICONS.appleTouch.size, 180);
});

test('public/favicon.ico holds exactly 16, 32 and 48 px PNGs, each matching its directory entry', () => {
  const entries = readIco(ico);
  assert.deepEqual(
    entries.map(({ width, height }) => [width, height]),
    [
      [16, 16],
      [32, 32],
      [48, 48],
    ],
  );
  for (const { width, height, png } of entries) {
    assert.ok(isPng(png), `${width}px entry is not a PNG`);
    assert.deepEqual(readPngSize(png), { width, height });
  }
  assert.ok(
    entries.some(({ width }) => width % 48 === 0),
    "Google's search results need a multiple of 48",
  );
});

test('public/apple-touch-icon.png is a PNG of exactly 180×180', () => {
  assert.ok(isPng(apple), 'bad PNG signature');
  assert.deepEqual(readPngSize(apple), { width: 180, height: 180 });
});

test('every icon PNG chunk has a valid CRC', () => {
  for (const { label, png } of allPngs()) {
    for (const { type, crcOk } of pngChunks(png)) assert.ok(crcOk, `bad CRC in ${type} of ${label}`);
  }
});

test("no icon is stale (every PNG carries the hash of resume.yaml's name, global.css and the template)", () => {
  const expected = iconSourceHash(initialsOf(getResume().basics.name), readDarkTokens());
  for (const { label, png } of allPngs()) {
    const stored = readPngText(png, ICON_HASH_KEY);
    assert.ok(stored, `no ${ICON_HASH_KEY} in ${label}: ${REFRESH}`);
    assert.equal(stored, expected, `${label} is stale: ${REFRESH}`);
  }
});

test('initialsOf takes the first letters of the first and last words, uppercased', () => {
  assert.equal(initialsOf('Ada King Lovelace'), 'AL');
  assert.equal(initialsOf('  grace   hopper \r\n'), 'GH');
  assert.equal(initialsOf('Cher'), 'C');
  assert.equal(initialsOf(getResume(path.join(ROOT, 'tests', 'fixtures', 'resume-valid.yaml')).basics.name), 'JE');
  assert.throws(() => initialsOf('   '));
});

test('the template shows the initials of the name in resume.yaml (never typed), escaped', () => {
  const tokens = readDarkTokens();
  const initials = initialsOf(getResume().basics.name);
  for (const size of ICON_SIZES) {
    assert.match(iconHtml(initials, tokens, size), new RegExp(`<span data-icon-text>${initials}</span>`));
  }
  // A different name gives a different icon and hash: nothing is hardcoded.
  assert.match(iconHtml(initialsOf('Ada Lovelace'), tokens, 16), /<span data-icon-text>AL<\/span>/);
  assert.notEqual(iconSourceHash('AL', tokens), iconSourceHash(initials, tokens));
  assert.match(iconHtml('<&>', tokens, 16), /&lt;&amp;&gt;/);
});

test('the template uses only the dark --bg and --accent tokens for colors', () => {
  const tokens = readDarkTokens();
  const allowed = new Set([tokens['--bg'], tokens['--accent']].map((v) => v.toLowerCase()));
  for (const size of ICON_SIZES) {
    const html = iconHtml('SA', tokens, size);
    assert.ok(html.includes(tokens['--bg']) && html.includes(tokens['--accent']), `${size}px`);
    for (const [hex] of html.matchAll(/#[0-9a-f]{3,8}\b/gi))
      assert.ok(allowed.has(hex.toLowerCase()), `raw color ${hex}`);
  }
});

test('the favicon sizes are rounded with a transparent page; the apple-touch-icon is a full square', () => {
  const tokens = readDarkTokens();
  for (const size of SITE_ICONS.favicon.sizes) assert.match(iconHtml('SA', tokens, size), /border-radius: [1-9]\d*px/);
  assert.match(iconHtml('SA', tokens, SITE_ICONS.appleTouch.size), /border-radius: 0px/);
});

test('the hash changes with the initials, a token or a size; and is the same for CRLF and LF inputs', () => {
  const css = fs.readFileSync(GLOBAL_CSS, 'utf8').replace(/\r\n/g, '\n');
  const lf = darkTokens(css);
  const crlf = darkTokens(css.replace(/\n/g, '\r\n'));
  const hash = iconSourceHash('SA', lf);
  assert.equal(iconSourceHash('SA', crlf), hash);
  assert.equal(iconSourceHash(initialsOf('Shahar\r\nAsher'), lf), iconSourceHash(initialsOf('Shahar Asher'), lf));
  assert.notEqual(iconSourceHash('SB', lf), hash);
  assert.notEqual(iconSourceHash('SA', { ...lf, '--accent': '#000000' }), hash);
  assert.notEqual(iconSourceHash('SA', { ...lf, '--bg': '#ffffff' }), hash);
  // A template file checked out with CRLF puts CRs inside the template literal: the hash normalizes them.
  for (const size of ICON_SIZES) assert.doesNotMatch(iconHtml('SA', lf, size), /\r/);
  assert.throws(() => iconHtml('SA', lf, 64), /no icon style/);
});

test('writeIco and readIco round-trip PNGs of any size up to 256', () => {
  const [p16, p32] = readIco(ico).map(({ png }) => Buffer.from(png));
  const written = writeIco([p32, p16]);
  const back = readIco(written);
  assert.deepEqual(
    back.map(({ width, height }) => [width, height]),
    [
      [32, 32],
      [16, 16],
    ],
  );
  assert.ok(back[0].png.equals(p32) && back[1].png.equals(p16));
  // The header: reserved 0, type 1 (icon), count; each entry is 1 plane, 32 bpp.
  assert.deepEqual([written.readUInt16LE(0), written.readUInt16LE(2), written.readUInt16LE(4)], [0, 1, 2]);
  assert.deepEqual([written.readUInt16LE(6 + 4), written.readUInt16LE(6 + 6)], [1, 32]);
  // 256 is stored as 0.
  const big = Buffer.from(apple);
  big.writeUInt32BE(256, 16);
  big.writeUInt32BE(256, 20);
  assert.equal(writeIco([big]).readUInt8(6), 0);
  assert.equal(readIco(writeIco([big]))[0].width, 256);
  big.writeUInt32BE(257, 16);
  assert.throws(() => writeIco([big]), /too large/);
});

test('readIco rejects a file that is not an ICO, or a truncated one', () => {
  assert.throws(() => readIco(Buffer.from('not an icon at all')), /not an ICO/);
  assert.throws(() => readIco(ico.subarray(0, 20)), /truncated/);
  assert.throws(() => readIco(ico.subarray(0, ico.length - 1)), /past the end/);
});
