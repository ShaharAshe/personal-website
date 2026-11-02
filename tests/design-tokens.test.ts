// Tests for the design tokens in src/styles/global.css: both themes define every token, the values match
// design-doc §9.2, the prefers-color-scheme fallback matches the light theme, Tailwind's @theme maps to
// the tokens, and every text/background pair meets WCAG AA (4.5:1).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.join(import.meta.dirname, '..');
const css = fs.readFileSync(path.join(ROOT, 'src', 'styles', 'global.css'), 'utf8');

const TOKENS = ['--bg', '--surface', '--text', '--text-muted', '--accent', '--border'];
const AA = 4.5;

type Tokens = Record<string, string>;

/** Custom properties declared directly in the block opened by `selector {` (first match). */
function readBlock(selector: string): Tokens {
  const start = css.indexOf(`${selector} {`);
  assert.notEqual(start, -1, `no "${selector} {" block in global.css`);
  const body = css.slice(start, css.indexOf('}', start));
  return Object.fromEntries(
    [...body.matchAll(/(--[\w*-]+)\s*:\s*([^;]+);/g)].map(([, name, value]) => [name, value.trim()]),
  );
}

const themes: Record<'dark' | 'light', Tokens> = {
  dark: readBlock(":root,\n:root[data-theme='dark']"),
  light: readBlock(":root[data-theme='light']"),
};
const fallback = readBlock(':root:not([data-theme])');
const theme = readBlock('@theme inline');

// WCAG 2.x relative luminance and contrast ratio.
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

test('contrast formula matches known WCAG values', () => {
  assert.equal(contrast('#000000', '#ffffff'), 21);
  assert.equal(contrast('#777777', '#777777'), 1);
  assert.equal(contrast('#ffffff', '#767676').toFixed(2), '4.54');
});

for (const [name, tokens] of Object.entries(themes)) {
  test(`${name} theme defines exactly the six tokens, as 6-digit hex`, () => {
    assert.deepEqual(Object.keys(tokens).sort(), [...TOKENS].sort());
    for (const token of TOKENS) assert.match(tokens[token], /^#[0-9a-f]{6}$/i, token);
  });
}

test('every token has a different value in light and dark (toggling data-theme swaps all of them)', () => {
  for (const token of TOKENS) {
    assert.notEqual(themes.dark[token].toLowerCase(), themes.light[token].toLowerCase(), token);
  }
});

test('the prefers-color-scheme: light fallback matches the light theme', () => {
  assert.deepEqual(fallback, themes.light);
  assert.match(css, /@media \(prefers-color-scheme: light\) \{\s*:root:not\(\[data-theme\]\)/);
});

test('token values match design-doc §9.2', () => {
  const doc = fs.readFileSync(path.join(ROOT, 'docs', 'design-doc.md'), 'utf8');
  for (const token of TOKENS) {
    // Table row: | `--token` | `#dark` | light cell (first hex in it, e.g. "... (למשל `#1F6FD1`) ...") |
    const row = doc.match(new RegExp(`^\\| \`${token}\` \\|([^|]+)\\|([^|]+)\\|`, 'm'));
    assert.ok(row, `no ${token} row in design-doc §9.2`);
    const [dark, light] = [row[1], row[2]].map((cell) => cell.match(/#[0-9a-f]{6}/i)?.[0].toLowerCase());
    assert.equal(themes.dark[token].toLowerCase(), dark, `dark ${token}`);
    assert.equal(themes.light[token].toLowerCase(), light, `light ${token}`);
  }
});

test('Tailwind @theme maps a color to each token and removes the default palette', () => {
  assert.equal(theme['--color-*'], 'initial');
  for (const token of TOKENS) assert.equal(theme[`--color-${token.slice(2)}`], `var(${token})`);
  assert.match(theme['--color-on-accent'], /^var\(--[\w-]+\)$/);
});

test('Tailwind @theme maps the fonts to the Astro Fonts API variables', () => {
  assert.equal(theme['--font-sans'], 'var(--font-inter)');
  assert.equal(theme['--font-mono'], 'var(--font-jetbrains-mono)');
});

test('the type scale has exactly the six design-doc §9.3 sizes, each with a line-height', () => {
  assert.equal(theme['--text-*'], 'initial');
  const sizes = Object.keys(theme).filter((name) => /^--text-[\w]+$/.test(name) && name !== '--text-*');
  assert.deepEqual(sizes, ['--text-xs', '--text-sm', '--text-base', '--text-lg', '--text-xl', '--text-display']);
  for (const size of sizes) assert.ok(theme[`${size}--line-height`], `${size} has no line-height`);
  assert.match(theme['--text-display'], /^clamp\(/);
});

test('Tailwind scans only src/ for class names', () => {
  assert.match(css, /^@import 'tailwindcss' source\('\.\.\/'\);$/m);
});

// The token used for text on accent-filled buttons, via the text-on-accent utility.
const onAccent = theme['--color-on-accent'].slice(4, -1);

const pairs: [fg: string, bg: string][] = [
  ['--text', '--bg'],
  ['--text', '--surface'],
  ['--text-muted', '--bg'],
  ['--text-muted', '--surface'],
  // Topic chips on project cards (bg-border fill, text-text-muted).
  ['--text-muted', '--border'],
  ['--accent', '--bg'],
  ['--accent', '--surface'],
  [onAccent, '--accent'],
];

for (const [name, tokens] of Object.entries(themes)) {
  for (const [fg, bg] of pairs) {
    test(`${name}: ${fg} on ${bg} meets WCAG AA (${AA}:1)`, () => {
      const ratio = contrast(tokens[fg], tokens[bg]);
      assert.ok(ratio >= AA, `${fg} ${tokens[fg]} on ${bg} ${tokens[bg]}: ${ratio.toFixed(2)}:1`);
    });
  }
}
