// URLs have no trailing slash (design-doc §13.1): the Cloudflare and Astro settings that make it so, and the
// internal links in the built HTML (skipped without a build). The settings are matched as text, anchored to the
// start of the line so a commented-out setting doesn't count.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { listSiteFiles } from '../scripts/checks/dist-files.ts';

const ROOT = path.join(import.meta.dirname, '..');
const DIST = path.join(ROOT, 'dist');
const skip = fs.existsSync(path.join(DIST, 'index.html')) ? false : 'no build: run npm run build first';

// Hrefs in the HTML that stay on this site and whose path ends in a slash. "/" is the homepage, so it's fine.
function internalHrefsWithTrailingSlash(html: string): string[] {
  const hrefs = [...html.matchAll(/\shref=(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)].map((m) => m[1] ?? m[2] ?? m[3] ?? '');
  return hrefs.filter((href) => {
    if (/^([a-z][a-z\d+.-]*:|\/\/)/i.test(href)) return false; // another site, mailto:, ...
    const pathOnly = href.split(/[?#]/)[0] ?? '';
    return pathOnly !== '/' && pathOnly.endsWith('/');
  });
}

test('wrangler.jsonc sets assets.html_handling to drop-trailing-slash', () => {
  const config = fs.readFileSync(path.join(ROOT, 'wrangler.jsonc'), 'utf8');
  assert.match(config, /^\s*"html_handling":\s*"drop-trailing-slash"/m);
});

test("astro.config.mjs sets trailingSlash to 'never'", () => {
  const config = fs.readFileSync(path.join(ROOT, 'astro.config.mjs'), 'utf8');
  assert.match(config, /^\s*trailingSlash:\s*'never'/m);
});

test('the href check finds internal trailing slashes and nothing else', () => {
  const html = `
    <a href="/resume/">a</a> <a href='/projects/x/#top'>b</a> <a href=/resume/?a=1>c</a> <a href="docs/">d</a>
    <a href="/">ok</a> <a href="/#contact">ok</a> <a href="#main">ok</a> <a href="/resume">ok</a>
    <a href="https://github.com/someone/">ok</a> <a href="//example.com/">ok</a> <a href="mailto:a@example.com">ok</a>
    <a data-href="/not-a-link/">ok</a>`;
  assert.deepEqual(internalHrefsWithTrailingSlash(html), ['/resume/', '/projects/x/#top', '/resume/?a=1', 'docs/']);
});

test('no internal href in the built HTML ends with a trailing slash', { skip }, () => {
  const pages = listSiteFiles(DIST).filter((file) => file.endsWith('.html'));
  assert.ok(pages.includes('index.html') && pages.includes(path.join('resume', 'index.html')));
  for (const page of pages) {
    const html = fs.readFileSync(path.join(DIST, page), 'utf8');
    assert.deepEqual(internalHrefsWithTrailingSlash(html), [], page);
  }
});
