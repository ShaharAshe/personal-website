// Tests for BaseLayout, on the built homepage (dist/index.html): the no-flash theme script is inlined
// as-is at the top of <head> before any stylesheet, the skip link is the first focusable element, the
// landmarks exist, and fonts are self-hosted. Skipped, with a message, when there's no build.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { getResume } from '../src/lib/resume.ts';
import { themeInitScript } from '../src/lib/theme-init.ts';

const ROOT = path.join(import.meta.dirname, '..');
const htmlPath = path.join(ROOT, 'dist', 'index.html');
const skip = fs.existsSync(htmlPath) ? false : 'no dist/index.html: run npm run build first';
const html = skip ? '' : fs.readFileSync(htmlPath, 'utf8');
const head = html.slice(html.indexOf('<head>'), html.indexOf('</head>'));
const body = html.slice(html.indexOf('<body'));

test('the page is in English', { skip }, () => {
  assert.match(html, /<html lang="en"/);
});

test('the theme script is inlined unchanged (not bundled or deferred)', { skip }, () => {
  const scripts = [...head.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)];
  const theme = scripts.find(([, , text]) => text.includes('localStorage'));
  assert.ok(theme, 'no inline theme script in <head>');
  const [, attrs, text] = theme;
  assert.equal(attrs.trim(), '', `unexpected attributes on the theme script: ${attrs}`);
  assert.equal(text, themeInitScript);
});

test('the theme script runs before any stylesheet or style in <head>', { skip }, () => {
  const script = head.indexOf('<script');
  const firstStyle = head.search(/<style|<link[^>]*rel="stylesheet"/);
  assert.notEqual(firstStyle, -1, 'no stylesheet in <head>');
  assert.ok(script < firstStyle, 'theme script comes after a stylesheet');
  // Only the charset and viewport metas, the two icon links whose SVG href it sets (Task 2.21a), and the inert Inter
  // preload template it reads (Task 3.4a), come before it.
  const before = head.slice(0, script);
  assert.deepEqual(before.match(/<[a-z]+/g), [
    '<head',
    '<meta',
    '<meta',
    '<link',
    '<link',
    '<template',
    '<link',
    '<link',
    '<link',
  ]);
  const [ico, svg] = [...before.matchAll(/<link [^>]*>/g)].map(([tag]) => tag);
  assert.match(ico, /rel="icon" href="\/favicon\.ico"/);
  assert.match(svg, /rel="icon" href="\/favicon\.svg" type="image\/svg\+xml"/);
});

test('every page has a title and meta description', { skip }, () => {
  assert.match(head, /<title>[^<]+<\/title>/);
  assert.match(head, /<meta name="description" content="[^"]+"/);
});

test('the skip link is the first focusable element and targets <main id="main">', { skip }, () => {
  const first = body.match(/<(a|button|input|select|textarea)\b[^>]*>|<[a-z]+\b[^>]*tabindex="0"[^>]*>/);
  assert.ok(first, 'nothing focusable in <body>');
  assert.match(first[0], /^<a [^>]*href="#main"/);
  assert.match(body, /<main id="main"/);
});

test('the nav has the home link (the name) and the four section links, and there is a footer', { skip }, () => {
  const nav = body.match(/<nav aria-label="Main"[\s\S]*?<\/nav>/)?.[0] ?? '';
  const labels = [...nav.matchAll(/<a [^>]*>([^<]+)<\/a>/g)].map(([, label]) => label.trim());
  assert.deepEqual(labels, [getResume().basics.name, 'Experience', 'Projects', 'Resume', 'Contact']);
  assert.match(body, /<footer\b/);
});

// Which faces are preloaded, and how: tests/font-preloads.test.ts.
test('fonts are self-hosted', { skip }, () => {
  const urls = [...head.matchAll(/url\("([^"]+)"\)|href="([^"]+\.woff2)"/g)].map(([, a, b]) => a ?? b);
  assert.ok(urls.length > 0, 'no font URLs in <head>');
  for (const url of urls) assert.match(url, /^\/_astro\/fonts\/[\w-]+\.woff2$/);
  assert.match(head, /font-family:Inter-/);
  assert.match(head, /font-family:"JetBrains Mono-/);
});
