// The site icons (Task 2.13a): public/favicon.ico holds exactly 16, 32 and 48 px PNGs, public/apple-touch-icon.png is
// 180×180, and neither is stale (each PNG's tEXt hash matches the template rendered from today's resume.yaml name and
// global.css). Also the initials, the ICO reader/writer, and that the hash doesn't depend on line endings. Needs no
// build. That the apple-touch-icon has no transparent pixel is checked in a real browser (tests/e2e/seo.spec.ts).
//
// public/favicon.svg (Task 2.21): small, well-formed, both color schemes from the tokens, no external reference, no
// CTF text, and not stale. That its colors really switch is checked in a real browser (tests/e2e/seo.spec.ts).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { readIco, writeIco } from '../scripts/og/ico.ts';
import {
  FAVICON_SVG_FILE,
  SVG_GEOMETRY,
  faviconSvg,
  iconSvgSourceHash,
  jetBrainsMonoFile,
  layoutGlyphs,
  readSvgHash,
  svgColors,
  type FontOutlines,
} from '../scripts/og/icon-svg.ts';
import { lightTokens, readLightTokens } from '../scripts/og/tokens.ts';
import { CTF_COMMENT_HTML, CTF_CONSOLE_LINE, CTF_STEPS, CTF_WELL_KNOWN, ctfAnswer, ctfClue } from '../src/lib/ctf.mts';
import { contrast } from './helpers/contrast.ts';
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

// --- favicon.svg (Task 2.21) ---

const svg = fs.readFileSync(FAVICON_SVG_FILE, 'utf8');

test('public/favicon.svg is where SITE_ICONS says, small, and a well-formed SVG of only rect and path', () => {
  assert.equal(FAVICON_SVG_FILE, path.join(ROOT, 'public', 'favicon.svg'));
  assert.deepEqual(SITE_ICONS.svg, { path: '/favicon.svg', type: 'image/svg+xml' });
  assert.ok(Buffer.byteLength(svg) < 4096, `${Buffer.byteLength(svg)} bytes`);
  assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 32 32">\n/);
  assert.match(svg, /\n<\/svg>\n$/);
  // Every element, in order: the root, the style, the tile, one path per initial. Each is closed.
  const tags = [...svg.matchAll(/<(\/?)([a-z]+)\b[^>]*?(\/?)>/g)].map(([, close, name, self]) =>
    close ? `/${name}` : self ? `${name}/` : name,
  );
  const letters = [...initialsOf(getResume().basics.name)].length;
  assert.deepEqual(tags, ['svg', 'style', '/style', 'rect/', ...Array(letters).fill('path/'), '/svg']);
  for (const [, d] of svg.matchAll(/ d="([^"]*)"/g)) assert.match(d, /^M[-\d. MLQCZ]+Z$/);
});

test('favicon.svg has the dark colors as attributes and the light ones in a prefers-color-scheme: light query', () => {
  const c = svgColors(readDarkTokens(), readLightTokens());
  assert.deepEqual(c, {
    dark: { bg: '#0b0d10', fg: '#4f9dff' },
    light: { bg: '#fafafa', fg: '#1f6fd1' },
  });
  assert.match(svg, new RegExp(`<rect class="bg" [^>]*fill="${c.dark.bg}"/>`));
  for (const [element] of svg.matchAll(/<path [^>]*>/g)) {
    assert.match(element, new RegExp(`class="fg" fill="${c.dark.fg}"`));
  }
  assert.equal(
    svg.match(/<style>([^<]*)<\/style>/)?.[1],
    `@media (prefers-color-scheme: light){.bg{fill:${c.light.bg}}.fg{fill:${c.light.fg}}}`,
  );
  // Only these four colors, none typed.
  const allowed = new Set(Object.values(c).flatMap(({ bg, fg }) => [bg, fg]));
  for (const [hex] of svg.matchAll(/#[0-9a-f]{3,8}\b/gi)) assert.ok(allowed.has(hex.toLowerCase()), `raw color ${hex}`);
});

test('favicon.svg contrast: the letters on their tile reach 4.5:1 in both schemes', () => {
  const { dark, light } = svgColors(readDarkTokens(), readLightTokens());
  assert.ok(contrast(dark.fg, dark.bg) >= 4.5, `dark ${contrast(dark.fg, dark.bg)}`);
  assert.ok(contrast(light.fg, light.bg) >= 4.5, `light ${contrast(light.fg, light.bg)}`);
});

test('favicon.svg references nothing outside itself and runs nothing', () => {
  // The xmlns namespace is a name, not a request: it's the only URL allowed.
  const body = svg.replace(' xmlns="http://www.w3.org/2000/svg"', '');
  for (const pattern of [/href/i, /url\(/i, /@import/i, /https?:/i, /<script/i, /\bon[a-z]+=/i, /<text/i, /<image/i]) {
    assert.doesNotMatch(body, pattern);
  }
});

test('favicon.svg carries no CTF clue', () => {
  const texts = [
    ...CTF_STEPS.map((_, i) => ctfClue(i)),
    CTF_COMMENT_HTML,
    CTF_CONSOLE_LINE,
    CTF_WELL_KNOWN.body.trim(),
    ctfAnswer(),
  ];
  for (const text of texts) assert.ok(!svg.includes(text), 'a clue text is in favicon.svg');
  assert.doesNotMatch(svg, /clue|ctf/i);
  for (const { part } of CTF_STEPS) assert.doesNotMatch(svg, new RegExp(`\\b${part}\\b`, 'i'));
});

test("favicon.svg is not stale (its hash is today's name, both token blocks and the template)", () => {
  const expected = iconSvgSourceHash(initialsOf(getResume().basics.name), readDarkTokens(), readLightTokens());
  const stored = readSvgHash(svg);
  assert.ok(stored, `no hash in favicon.svg: ${REFRESH}`);
  assert.equal(stored, expected, `favicon.svg is stale: ${REFRESH}`);
});

test('the SVG hash changes with the initials or any of the four colors, and is the same for CRLF and LF inputs', () => {
  const css = fs.readFileSync(GLOBAL_CSS, 'utf8').replace(/\r\n/g, '\n');
  const [dark, light] = [darkTokens(css), lightTokens(css)];
  const hash = iconSvgSourceHash('SA', dark, light);
  assert.equal(
    iconSvgSourceHash('SA', darkTokens(css.replace(/\n/g, '\r\n')), lightTokens(css.replace(/\n/g, '\r\n'))),
    hash,
  );
  assert.equal(iconSvgSourceHash('SA\r\n', dark, light), hash);
  assert.notEqual(iconSvgSourceHash('SB', dark, light), hash);
  assert.notEqual(iconSvgSourceHash('SA', { ...dark, '--bg': '#000000' }, light), hash);
  assert.notEqual(iconSvgSourceHash('SA', { ...dark, '--accent': '#000000' }, light), hash);
  assert.notEqual(iconSvgSourceHash('SA', dark, { ...light, '--bg': '#000000' }), hash);
  assert.notEqual(iconSvgSourceHash('SA', dark, { ...light, '--accent': '#000000' }), hash);
  // The PNG hash doesn't change with a light token: the PNGs are dark only.
  assert.equal(iconSourceHash('SA', dark), iconSourceHash('SA', darkTokens(css)));
  assert.throws(() => svgColors({ ...dark, '--bg': 'red' }, light), /not a #rrggbb/);
  assert.throws(() => svgColors(dark, {}), /no --bg in its light block/);
});

// A square "glyph" 600 wide in a 1000-unit font, cap height 700: easy to check by hand.
const BOX: FontOutlines = {
  familyName: 'JetBrains Mono',
  unitsPerEm: 1000,
  capHeight: 700,
  glyphs: ['A', 'B'].map((char) => ({
    char,
    advance: 600,
    commands: [
      { command: 'moveTo', args: [0, 0] },
      { command: 'lineTo', args: [600, 0] },
      { command: 'quadraticCurveTo', args: [600, 700, 0, 700] },
      { command: 'bezierCurveTo', args: [0, 500, 0, 200, 0, 0] },
      { command: 'closePath', args: [] },
    ],
  })),
};

test('layoutGlyphs scales to the font size, flips y and centers on the advances and the cap height', () => {
  // Scale 20/1000: each advance is 12, so the pair is 24 wide, from x 4 to 28. Caps 14 high: baseline at 23, top at 9.
  const { paths, box } = layoutGlyphs(BOX);
  assert.equal(SVG_GEOMETRY.fontSize, 20);
  assert.deepEqual(paths, ['M4 23L16 23Q16 9 4 9C4 13 4 19 4 23Z', 'M16 23L28 23Q28 9 16 9C16 13 16 19 16 23Z']);
  assert.deepEqual(box, { left: 4, top: 9, right: 28, bottom: 23 });
  assert.throws(
    () => layoutGlyphs({ ...BOX, glyphs: [{ char: 'A', advance: 1, commands: [{ command: 'arc', args: [] }] }] }),
    /unknown path command/,
  );
});

test('faviconSvg uses the outlines it is given, only for the right initials, and escapes the skeleton', () => {
  const [dark, light] = [readDarkTokens(), readLightTokens()];
  const out = faviconSvg('AB', dark, light, BOX, 'f'.repeat(64));
  assert.ok(out.includes('d="M4 23L16 23Q16 9 4 9C4 13 4 19 4 23Z"'));
  assert.equal(readSvgHash(out), 'f'.repeat(64));
  assert.throws(() => faviconSvg('XY', dark, light, BOX), /outlines are for "AB"/);
  assert.throws(() => faviconSvg('  ', dark, light), /no initials/);
  assert.match(faviconSvg('<&', dark, light), /d="glyph:&lt;"\/>\n<path [^>]*d="glyph:&amp;"/);
  assert.equal(readSvgHash(faviconSvg('AB', dark, light)), undefined);
});

test('jetBrainsMonoFile picks the 400 normal Latin face from the <Font /> CSS', () => {
  const face = (family: string, weight: number, range: string, file: string) =>
    `@font-face{font-family:"${family}";src:url("/_astro/fonts/${file}.woff2") format("woff2");font-display:swap;unicode-range:${range};font-weight:${weight};font-style:normal;}`;
  const css = [
    face('Inter-1', 400, 'U+0000-00FF', 'inter'),
    face('JetBrains Mono-abc', 400, 'U+0100-02BA', 'mono-ext'),
    face('JetBrains Mono-abc', 700, 'U+0000-00FF', 'mono-bold'),
    face('JetBrains Mono-abc', 400, 'U+0000-00FF,U+0131', 'mono-latin'),
  ].join('');
  assert.equal(jetBrainsMonoFile(css, 'dist'), path.join('dist', '/_astro/fonts/mono-latin.woff2'));
  assert.throws(() => jetBrainsMonoFile(face('Inter-1', 400, 'U+0000-00FF', 'inter'), 'dist'), /no JetBrains Mono/);
});
