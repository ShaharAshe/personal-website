// The size-adjusted local font fallbacks (Task 3.4a, src/lib/font-fallbacks.mts): the formula matches Capsize's (the one
// Astro used), every fallback @font-face hand-written in src/styles/global.css equals the one computed from the metrics
// table, the built pages list the fallback families in order, and none of Astro's own generated fallbacks are left.
// How well they match in a browser (and the swap's layout shift) is checked by tests/e2e/fonts.spec.ts.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  INTER_FALLBACK_STACK,
  LOCAL_FONT_METRICS,
  MONO_FALLBACK_STACK,
  WEB_FONT_METRICS,
  allFallbackFaces,
  fallbackFace,
  type FontMetrics,
} from '../src/lib/font-fallbacks.mts';

const ROOT = path.join(import.meta.dirname, '..');
const DIST = path.join(ROOT, 'dist');
const skip = fs.existsSync(path.join(DIST, 'index.html')) ? false : 'no dist/index.html: run npm run build first';

/** A metrics row without its source note. */
const numbers = ({ unitsPerEm, ascent, descent, lineGap, xWidthAvg }: FontMetrics) => ({
  unitsPerEm,
  ascent,
  descent,
  lineGap,
  xWidthAvg,
});

test("the formula reproduces Astro's own Inter 400 / Arial numbers (Capsize's createFontStack)", () => {
  // From Astro 7.4's generated CSS before this task: size-adjust 107.1194%, ascent 90.4365%, descent 22.518%.
  const face = fallbackFace('x', 400, WEB_FONT_METRICS['Inter 400'], LOCAL_FONT_METRICS.Arial, ['Arial']);
  assert.equal(face['size-adjust'], '107.1194%');
  assert.equal(face['ascent-override'], '90.4365%');
  assert.equal(face['descent-override'], '22.518%');
  assert.equal(face['line-gap-override'], '0%');
  // And JetBrains Mono / Courier New: 99.9837%, 102.0166%, 30.0049%.
  const mono = fallbackFace('x', 400, WEB_FONT_METRICS['JetBrains Mono 400'], LOCAL_FONT_METRICS['Courier New'], []);
  assert.deepEqual(
    [mono['size-adjust'], mono['ascent-override'], mono['descent-override']],
    ['99.9837%', '102.0166%', '30.0049%'],
  );
});

test('Liberation Sans and Liberation Mono share Arial and Courier New metrics (so each pair is one @font-face)', () => {
  assert.deepEqual(numbers(LOCAL_FONT_METRICS['Liberation Sans']), numbers(LOCAL_FONT_METRICS.Arial));
  assert.deepEqual(numbers(LOCAL_FONT_METRICS['Liberation Sans Bold']), numbers(LOCAL_FONT_METRICS['Arial Bold']));
  assert.deepEqual(numbers(LOCAL_FONT_METRICS['Liberation Mono']), numbers(LOCAL_FONT_METRICS['Courier New']));
});

test('every metrics row names its source file and version', () => {
  for (const [name, { source }] of Object.entries({ ...WEB_FONT_METRICS, ...LOCAL_FONT_METRICS })) {
    assert.match(source, /\S+\.(ttf|woff2)\b|woff2/, `${name}: no file in its source`);
    assert.match(source, /Version \S+/, `${name}: no version in its source`);
  }
});

/** The fallback @font-face rules in global.css, as descriptor objects, whitespace collapsed. */
function cssFallbackFaces(css: string): Record<string, string>[] {
  return [...css.matchAll(/@font-face\s*\{([^}]*)\}/g)]
    .map(([, body = '']) =>
      Object.fromEntries(
        body
          .replace(/\/\*[\s\S]*?\*\//g, '')
          .split(';')
          .map((declaration) => declaration.trim())
          .filter(Boolean)
          .map((declaration) => {
            const colon = declaration.indexOf(':');
            return [
              declaration.slice(0, colon).trim(),
              declaration
                .slice(colon + 1)
                .replace(/\s+/g, ' ')
                .trim(),
            ];
          }),
      ),
    )
    .filter((face) => / fallback/.test(face['font-family'] ?? ''));
}

test('global.css declares exactly the computed fallback faces, in order', () => {
  const css = fs.readFileSync(path.join(ROOT, 'src', 'styles', 'global.css'), 'utf8');
  assert.deepEqual(cssFallbackFaces(css), allFallbackFaces());
});

test('weight 600 falls back to a bold local face, 400 and 500 to a regular one', () => {
  for (const face of allFallbackFaces().filter(({ 'font-family': family }) => family.startsWith("'Inter"))) {
    const bold = /Bold/.test(face.src);
    assert.equal(bold, face['font-weight'] === '600', `${face['font-family']} ${face['font-weight']}: ${face.src}`);
  }
});

/** A custom property's font stack in the built page's font CSS, names unquoted. */
function stack(html: string, property: string): string[] {
  const value = html.match(new RegExp(`${property}:([^;}]+)`))?.[1] ?? '';
  return value.split(',').map((name) => name.trim().replace(/^"|"$/g, ''));
}

for (const page of ['index.html', path.join('resume', 'index.html'), '404.html']) {
  test(`${page}: the font stacks list the web font, then the fallback families in order`, { skip }, () => {
    const html = fs.readFileSync(path.join(DIST, page), 'utf8');
    const inter = stack(html, '--font-inter');
    assert.match(inter[0] ?? '', /^Inter-/);
    assert.deepEqual(inter.slice(1), INTER_FALLBACK_STACK);
    const mono = stack(html, '--font-jetbrains-mono');
    assert.match(mono[0] ?? '', /^JetBrains Mono-/);
    assert.deepEqual(mono.slice(1), MONO_FALLBACK_STACK);
    assert.doesNotMatch(html, /fallback: (Arial|Courier New)/, "Astro's own generated fallbacks are still there");
  });
}
