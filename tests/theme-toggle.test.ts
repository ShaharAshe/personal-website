// Tests for the theme toggle and the terminal view switch (Task F.7): the pure logic in src/lib/theme.ts (current/next
// theme and style, label, saving), then the built pages (dist/): the toggle button in the nav with both icons, the
// icon animation only without reduced motion, the switch in every footer, one script wiring both, and the homepage JS
// budget. The dist/ tests skip without a build.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { CF_BEACON_SRC } from '../src/lib/analytics.ts';
import { SITE_ICONS } from '../src/lib/seo.ts';
import { BEACON_GZIP_BYTES, pageJsGzipBytes, pageScripts } from './helpers/page-js.ts';
import {
  STYLE_STORAGE_KEY,
  STYLES,
  TERMINAL,
  THEME_STORAGE_KEY,
  THEMES,
  currentStyle,
  currentTheme,
  faviconFor,
  isStyle,
  nextStyle,
  nextTheme,
  saveStyle,
  saveTheme,
  toggleLabel,
} from '../src/lib/theme.ts';

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

// --- Terminal view (Task F.7): the style choice ---

test('the style values are regular and terminal, saved under their own key', () => {
  assert.deepEqual([...STYLES], ['regular', 'terminal']);
  assert.equal(TERMINAL, 'terminal');
  assert.equal(STYLE_STORAGE_KEY, 'style');
  assert.notEqual(STYLE_STORAGE_KEY, THEME_STORAGE_KEY);
});

test('isStyle accepts only the two values', () => {
  for (const style of STYLES) assert.equal(isStyle(style), true);
  for (const value of ['Terminal', 'dark', '', null, undefined, 1]) assert.equal(isStyle(value), false);
});

test('the current style is terminal only when data-style says so', () => {
  assert.equal(currentStyle('terminal'), 'terminal');
  for (const value of [undefined, '', 'regular', 'Terminal', 'blue']) assert.equal(currentStyle(value), 'regular');
});

test('next style flips between regular and terminal', () => {
  assert.equal(nextStyle('regular'), 'terminal');
  assert.equal(nextStyle('terminal'), 'regular');
});

for (const style of STYLES) {
  test(`saving "${style}" writes it under the style key`, () => {
    const saved = new Map<string, string>();
    saveStyle(style, () => ({ setItem: (key, value) => void saved.set(key, value) }));
    assert.deepEqual([...saved], [[STYLE_STORAGE_KEY, style]]);
  });
}

test('saving the style with a throwing setItem does not throw', () => {
  const throwing = {
    setItem() {
      throw new Error('QuotaExceededError');
    },
  };
  assert.doesNotThrow(() => saveStyle('terminal', () => throwing));
});

test('saving the style when accessing localStorage itself throws (storage blocked) does not throw', () => {
  assert.doesNotThrow(() =>
    saveStyle('terminal', () => {
      throw new Error('SecurityError: access denied');
    }),
  );
});

// --- The tab icon (Task 2.21a) ---

test('faviconFor: no choice keeps /favicon.svg (it follows the browser)', () => {
  assert.equal(faviconFor(undefined, undefined), SITE_ICONS.svg.path);
  assert.equal(faviconFor(undefined, 'regular'), '/favicon.svg');
  assert.equal(faviconFor('blue', undefined), '/favicon.svg');
});

test('faviconFor: a chosen theme gets its fixed variant', () => {
  assert.equal(faviconFor('light', undefined), '/favicon-light.svg');
  assert.equal(faviconFor('dark', undefined), '/favicon-dark.svg');
  assert.equal(faviconFor('light', 'regular'), SITE_ICONS.svgFixed.light);
});

test('faviconFor: terminal view is always dark, whatever the theme', () => {
  for (const theme of [undefined, 'light', 'dark']) assert.equal(faviconFor(theme, TERMINAL), '/favicon-dark.svg');
});

test('faviconFor: no theme, terminal on then off gives dark, then /favicon.svg again (not a fixed variant)', () => {
  assert.equal(faviconFor(undefined, nextStyle('regular')), SITE_ICONS.svgFixed.dark);
  assert.equal(faviconFor(undefined, nextStyle(TERMINAL)), SITE_ICONS.svg.path);
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

const PAGES = ['index.html', 'resume/index.html', '404.html'];

test(
  'every page has one terminal view switch in the footer: a button with aria-pressed and a fixed name',
  { skip },
  () => {
    for (const file of PAGES) {
      const page = fs.readFileSync(path.join(DIST, file), 'utf8');
      const switches = [...page.matchAll(/<button\b[^>]*data-style-toggle[^>]*>[\s\S]*?<\/button>/g)].map(([b]) => b);
      assert.equal(switches.length, 1, `${file}: style switches`);
      const footer = page.match(/<footer\b[\s\S]*?<\/footer>/)?.[0] ?? '';
      assert.ok(footer.includes(switches[0]), `${file}: the switch is not in the footer`);
      assert.match(switches[0], /^<button\b[^>]*\btype="button"/, file);
      assert.match(switches[0], /^<button\b[^>]*\baria-pressed="false"/, file);
      // The name is the visible text; the >_ prompt is hidden from screen readers.
      assert.doesNotMatch(switches[0], /aria-label=/, file);
      assert.match(
        switches[0],
        /<span aria-hidden="true"[^>]*>\s*&gt;_\s*<\/span>\s*Terminal view\s*<\/button>$/,
        file,
      );
    }
  },
);

test('the page has one toggle script, wiring both switches (no shared chunk files)', { skip }, () => {
  const scripts = [...html.matchAll(/<script type="module">([\s\S]*?)<\/script>/g)].map(([, js]) => js);
  const toggles = scripts.filter((js) => js.includes('[data-theme-toggle]'));
  assert.equal(toggles.length, 1, 'inline scripts wiring the theme toggle');
  assert.ok(toggles[0].includes('[data-style-toggle]'), 'the toggle script does not wire the style switch');
  assert.equal(scripts.filter((js) => js.includes('[data-style-toggle]')).length, 1, 'scripts wiring the switch');
});

test('homepage JS stays under 30KB gzipped (CLAUDE.md quality target), the analytics beacon included', { skip }, () => {
  // The Cloudflare Web Analytics beacon counts (Task 2.15): it's JS every visitor downloads.
  assert.deepEqual(pageScripts(html, DIST).external, [CF_BEACON_SRC]);
  const bytes = pageJsGzipBytes(html, DIST);
  const kb = (n: number) => (n / 1024).toFixed(2);
  console.log(
    `homepage JS: ${kb(bytes)} KB gzipped (site ${kb(bytes - BEACON_GZIP_BYTES)} KB + beacon ${kb(BEACON_GZIP_BYTES)} KB)`,
  );
  assert.ok(bytes < 30 * 1024, `homepage JS is ${bytes} bytes gzipped`);
});
