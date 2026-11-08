// Tests for the theme toggle: the pure logic in src/lib/theme.ts (current/next theme, label, saving),
// then the built homepage (dist/): the toggle button in the nav with both icons, the icon animation
// only without reduced motion, and the homepage JS budget. The dist/ tests skip without a build.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { THEME_STORAGE_KEY, THEMES, currentTheme, nextTheme, saveTheme, toggleLabel } from '../src/lib/theme.ts';

// --- Pure logic ---

for (const theme of THEMES) {
  for (const osPrefersLight of [true, false]) {
    test(`data-theme="${theme}" wins over the OS (OS light: ${osPrefersLight})`, () => {
      assert.equal(currentTheme(theme, osPrefersLight), theme);
    });
  }
}

test('no data-theme (first visit): the current theme is the OS one', () => {
  assert.equal(currentTheme(undefined, true), 'light');
  assert.equal(currentTheme(undefined, false), 'dark');
});

test('an invalid data-theme is treated like none', () => {
  assert.equal(currentTheme('blue', true), 'light');
  assert.equal(currentTheme('', false), 'dark');
});

test('next theme from light is dark, from dark is light', () => {
  assert.equal(nextTheme('light'), 'dark');
  assert.equal(nextTheme('dark'), 'light');
});

test('next theme with no data-theme: the opposite of the OS', () => {
  assert.equal(nextTheme(currentTheme(undefined, true)), 'dark');
  assert.equal(nextTheme(currentTheme(undefined, false)), 'light');
});

test('the label says what a click will do', () => {
  assert.equal(toggleLabel('dark'), 'Switch to light theme');
  assert.equal(toggleLabel('light'), 'Switch to dark theme');
});

test('saving writes the theme under the storage key', () => {
  const saved = new Map<string, string>();
  saveTheme('light', () => ({ setItem: (key, value) => void saved.set(key, value) }));
  assert.deepEqual([...saved], [[THEME_STORAGE_KEY, 'light']]);
});

test('saving with a throwing setItem does not throw', () => {
  const throwing = {
    setItem() {
      throw new Error('QuotaExceededError');
    },
  };
  assert.doesNotThrow(() => saveTheme('dark', () => throwing));
});

test('saving when accessing localStorage itself throws (storage blocked) does not throw', () => {
  assert.doesNotThrow(() =>
    saveTheme('dark', () => {
      throw new Error('SecurityError: access denied');
    }),
  );
});

// --- Built homepage ---

const ROOT = path.join(import.meta.dirname, '..');
const DIST = path.join(ROOT, 'dist');
const htmlPath = path.join(DIST, 'index.html');
const skip = fs.existsSync(htmlPath) ? false : 'no dist/index.html: run npm run build first';
const html = skip ? '' : fs.readFileSync(htmlPath, 'utf8');
const nav = html.match(/<nav aria-label="Main"[\s\S]*?<\/nav>/)?.[0] ?? '';
const button = nav.match(/<button\b[^>]*data-theme-toggle[^>]*>[\s\S]*?<\/button>/)?.[0] ?? '';

/** The built CSS: <style> blocks plus linked stylesheets. */
function builtCss(): string {
  const inline = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(([, css]) => css);
  const linked = [...html.matchAll(/<link[^>]*rel="stylesheet"[^>]*href="([^"]+)"/g)].map(([, href]) =>
    fs.readFileSync(path.join(DIST, href), 'utf8'),
  );
  return [...inline, ...linked].join('\n');
}

test('the toggle is a <button type="button"> inside the main nav', { skip }, () => {
  assert.ok(button, 'no [data-theme-toggle] button in <nav aria-label="Main">');
  assert.match(button, /^<button\b[^>]*\btype="button"/);
});

test('the toggle has a non-empty aria-label', { skip }, () => {
  assert.match(button, /^<button\b[^>]*\baria-label="[^"]+"/);
});

test('both icons are in the markup, hidden from screen readers', { skip }, () => {
  for (const theme of THEMES) {
    const icon = button.match(new RegExp(`<svg\\b[^>]*data-theme-icon="${theme}"[^>]*>`))?.[0];
    assert.ok(icon, `no ${theme} icon`);
    assert.match(icon, /aria-hidden="true"/);
  }
});

test('the icon animation only exists without reduced motion', { skip }, () => {
  const css = builtCss();
  // Minified shorthand reorders values (e.g. `animation:.2s ease-out theme-icon-in`).
  const uses = [...css.matchAll(/animation:[^;}]*\btheme-icon-in\b/g)];
  assert.ok(uses.length > 0, 'no theme-icon-in animation in the built CSS');
  for (const use of uses) {
    const before = css.slice(0, use.index);
    const media = before.lastIndexOf('@media');
    assert.match(before.slice(media), /^@media\s*\(prefers-reduced-motion:\s*no-preference\)\s*\{[^}]*$/);
  }
});

test('homepage JS stays under 30KB gzipped (CLAUDE.md quality target)', { skip }, () => {
  let bytes = 0;
  for (const [, attrs, text] of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)) {
    // JSON-LD (type="application/ld+json") is data the browser never runs, so it isn't JS.
    if (attrs.includes('application/ld+json')) continue;
    const src = attrs.match(/\bsrc="([^"]+)"/)?.[1];
    const code = src ? fs.readFileSync(path.join(DIST, src)) : Buffer.from(text);
    bytes += zlib.gzipSync(code).length;
  }
  console.log(`homepage JS: ${(bytes / 1024).toFixed(2)} KB gzipped`);
  assert.ok(bytes < 30 * 1024, `homepage JS is ${bytes} bytes gzipped`);
});
