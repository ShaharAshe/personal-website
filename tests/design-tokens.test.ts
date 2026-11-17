// Tests for the design tokens in src/styles/global.css: both themes define every token, the values match
// design-doc §9.2, the prefers-color-scheme fallback matches the light theme, Tailwind's @theme maps to
// the tokens, and every text/background pair meets WCAG AA (4.5:1).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { contrast } from './helpers/contrast.ts';

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
    // Table row: | `--token` | `#dark` | light cell (first hex in it, e.g. "... (for example `#1F6FD1`) ...") |
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

// --- terminal view (Task F.7, design-doc §9.5) ---

const terminal = readBlock(":root[data-style='terminal']");

test('terminal view defines exactly the six tokens, as 6-digit hex, in its first block', () => {
  assert.deepEqual(Object.keys(terminal).sort(), [...TOKENS].sort());
  for (const token of TOKENS) assert.match(terminal[token], /^#[0-9a-f]{6}$/i, token);
});

test('terminal token values match design-doc §9.5', () => {
  const doc = fs.readFileSync(path.join(ROOT, 'docs', 'design-doc.md'), 'utf8');
  const section = doc.slice(doc.indexOf('### 9.5 '), doc.indexOf('\n---', doc.indexOf('### 9.5 ')));
  for (const token of TOKENS) {
    // The --bg / --surface row holds both.
    const row = section.match(new RegExp(`^\\|[^|\\n]*\`${token}\`[^|\\n]*\\|([^|]+)\\|`, 'm'));
    assert.ok(row, `no ${token} row in design-doc §9.5`);
    assert.equal(terminal[token].toLowerCase(), row[1].match(/#[0-9a-f]{6}/i)?.[0].toLowerCase(), token);
  }
});

for (const [fg, bg] of pairs) {
  test(`terminal: ${fg} on ${bg} meets WCAG AA (${AA}:1)`, () => {
    const ratio = contrast(terminal[fg], terminal[bg]);
    assert.ok(ratio >= AA, `${fg} ${terminal[fg]} on ${bg} ${terminal[bg]}: ${ratio.toFixed(2)}:1`);
  });
}

test('terminal: a control whose only edge is its border draws it in --text-muted, at least 3:1 (WCAG 1.4.11)', () => {
  assert.match(
    css,
    /:root\[data-style='terminal'\] :is\(a, button, canvas\)\.border \{\s*border-color: var\(--text-muted\);/,
  );
  const ratio = contrast(terminal['--text-muted'], terminal['--bg']);
  assert.ok(ratio >= 3, `--text-muted on --bg: ${ratio.toFixed(2)}:1`);
});

/** `color` at `percent` strength over a terminal background token (default --bg), as the browser paints it. */
function mixTerminal(color: string, percent: number, under = '--bg'): string {
  const channels = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const bg = channels(terminal[under]);
  const mixed = channels(color).map((value, i) => Math.round((value * percent + bg[i] * (100 - percent)) / 100));
  return `#${mixed.map((value) => value.toString(16).padStart(2, '0')).join('')}`;
}

const glow = css.match(/text-shadow: 0 0 ([\d.]+)em color-mix\(in srgb, currentColor ([\d.]+)%, transparent\);/);

test('terminal: the glow is one subtle text-shadow in each element’s own color', () => {
  assert.ok(glow, 'no terminal text-shadow glow in global.css');
  const [, blur, percent] = glow.map(Number);
  assert.ok(blur > 0 && blur <= 0.5, `glow blur: ${blur}em`);
  assert.ok(percent > 0 && percent <= 30, `glow strength: ${percent}%`);
});

// The worst case: the glow at full strength right behind the text (a blur is weaker than this). Text on the --border
// fill (topic chips) has no glow: it would fail there (3.3:1), so it's turned off, and the test below holds that.
for (const [fg, bg] of [
  ['--text', '--bg'],
  ['--text-muted', '--bg'],
  ['--accent', '--bg'],
] as const) {
  test(`terminal: ${fg} on ${bg} still meets AA under its own glow at full strength`, () => {
    const percent = Number(glow?.[2]);
    const ratio = contrast(terminal[fg], mixTerminal(terminal[fg], percent, bg));
    console.log(`terminal: ${fg} on ${bg} under the glow ${ratio.toFixed(2)}:1`);
    assert.ok(ratio >= AA, `${fg} under the glow: ${ratio.toFixed(2)}:1`);
  });
}

test('terminal: text on a --border fill (the topic chips) has no glow', () => {
  assert.match(css, /:root\[data-style='terminal'\] \.bg-border \{\s*text-shadow: none;\s*\}/);
});

test('terminal: the Hero dots are visible (at least 1.5:1 on --bg)', () => {
  const percent = Number(
    css.match(/--hero-dot:\s*color-mix\(in srgb, var\(--text-muted\) (\d+)%, transparent\);/)?.[1],
  );
  const ratio = contrast(mixTerminal(terminal['--text-muted'], percent), terminal['--bg']);
  console.log(`terminal: hero dot on --bg ${ratio.toFixed(2)}:1`);
  assert.ok(ratio >= 1.5, `dot on --bg: ${ratio.toFixed(2)}:1`);
});

test('terminal view is screen only (print never sees it) and comes after every theme block', () => {
  const first = css.indexOf("[data-style='terminal']");
  assert.ok(first > css.indexOf(':root:not([data-theme]) {'), 'terminal rules come before the light fallback');
  // Every terminal rule sits inside an @media screen block.
  for (const match of css.matchAll(/\[data-style='terminal'\]/g)) {
    const before = css.slice(0, match.index);
    assert.match(before.slice(before.lastIndexOf('@media')), /^@media screen\b/, `rule at ${match.index}`);
  }
  // And print, last in the file, names none of them.
  assert.doesNotMatch(css.slice(css.indexOf('@media print')), /data-style/);
});

test('terminal: prefers-contrast: more removes the glow', () => {
  assert.match(
    css,
    /@media screen and \(prefers-contrast: more\) \{\s*:root\[data-style='terminal'\],\s*:root\[data-style='terminal'\] \* \{\s*text-shadow: none;/,
  );
});

// --- the Hero background layers ---

/** `token` at `percent` strength over --bg, as the browser paints it. */
function mixOnBg(tokens: Tokens, token: string, percent: number): string {
  const channels = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const bg = channels(tokens['--bg']);
  const mixed = channels(tokens[token]).map((value, i) =>
    Math.round((value * percent + bg[i] * (100 - percent)) / 100),
  );
  return `#${mixed.map((value) => value.toString(16).padStart(2, '0')).join('')}`;
}

const dotPercent = Number(
  css.match(/--hero-dot:\s*color-mix\(in srgb, var\(--text-muted\) (\d+)%, transparent\);/)?.[1],
);
const dotOn = (tokens: Tokens) => mixOnBg(tokens, '--text-muted', dotPercent);

const glowPercents = [
  ...css.matchAll(/--hero-glow:\s*color-mix\(in srgb, var\(--accent\) ([\d.]+)%, transparent\);/g),
].map(([, percent]) => Number(percent));

test('--hero-dot is --text-muted at a set strength', () => {
  assert.ok(dotPercent > 0 && dotPercent < 100, `--hero-dot strength: ${dotPercent}`);
});

test('the Hero dots are visible, and about the same strength in both themes', () => {
  const dark = contrast(dotOn(themes.dark), themes.dark['--bg']);
  const light = contrast(dotOn(themes.light), themes.light['--bg']);
  console.log(`hero dot on --bg: dark ${dark.toFixed(2)}:1, light ${light.toFixed(2)}:1`);
  for (const ratio of [dark, light]) assert.ok(ratio >= 1.5, `dot on --bg: ${ratio.toFixed(2)}:1`);
  assert.ok(Math.abs(dark - light) <= 0.2, `dark ${dark.toFixed(2)}:1, light ${light.toFixed(2)}:1`);
});

test('--hero-glow is --accent in dark only', () => {
  assert.equal(glowPercents.length, 1, `--hero-glow color-mix declarations: ${glowPercents.length}`);
  assert.ok(glowPercents[0] > 0 && glowPercents[0] < 100, `--hero-glow strength: ${glowPercents[0]}`);
});

test('--hero-glow is transparent in light, saved and OS fallback, so light text is on plain --bg', () => {
  assert.match(css, /:root\[data-theme='light'\] \{\s*--hero-glow: transparent;\s*\}/);
  assert.match(css, /:root:not\(\[data-theme\]\) \{\s*--hero-glow: transparent;\s*\}/);
});

// --text: the title and View Projects. --text-muted: the tagline and the profile icons (4.5:1 here also
// covers the icons' 3:1 minimum). --accent: the role line.
for (const token of ['--text', '--text-muted', '--accent']) {
  test(`dark: ${token} meets AA on the strongest point of the Hero glow`, () => {
    const ratio = contrast(themes.dark[token], mixOnBg(themes.dark, '--accent', glowPercents[0]));
    console.log(`dark: ${token} on the hero glow ${ratio.toFixed(2)}:1`);
    assert.ok(ratio >= AA, `${token} on the glow: ${ratio.toFixed(2)}:1`);
  });
}
