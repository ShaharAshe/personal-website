// Font preloads in the built pages (Task 3.4a, src/lib/font-preloads.ts): on /, /resume and the 404, JetBrains Mono
// 400 is a plain <link rel="preload">, and Inter 400/500/600 sit in the <template data-font-preloads> before the
// no-flash script, which moves them into <head> unless terminal view is on (tests/theme-init.test.ts runs that part).
// Each link is a CORS font preload whose href is the src of that weight's @font-face on the page, and nothing else is
// preloaded. Whether each page really uses every face it preloads, above the fold, is checked in a browser by
// tests/e2e/fonts.spec.ts. Skipped, with a message, when there's no build.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { FONT_PRELOADS_ATTR, INTER_PRELOAD_WEIGHTS, MONO_PRELOAD_WEIGHTS } from '../src/lib/font-preloads.ts';
import { themeInitScript } from '../src/lib/theme-init.ts';

const DIST = path.join(import.meta.dirname, '..', 'dist');
const PAGES = ['index.html', path.join('resume', 'index.html'), '404.html'];
const skip = fs.existsSync(path.join(DIST, 'index.html')) ? false : 'no dist/index.html: run npm run build first';

type Attrs = Record<string, string>;

const attrsOf = (tag: string): Attrs =>
  Object.fromEntries(
    [...tag.matchAll(/([\w-]+)(?:="([^"]*)")?/g)].slice(1).map(([, name, value]) => [name!, value ?? '']),
  );

/** weight → URL, from the page's @font-face rules for the family whose name starts with `family`. */
function faceUrls(head: string, family: string): Map<string, string> {
  const urls = new Map<string, string>();
  for (const [rule = ''] of head.matchAll(/@font-face\{[^}]*\}/g)) {
    if (!rule.replace(/"/g, '').includes(`font-family:${family}-`)) continue;
    const url = rule.match(/url\("([^"]+)"\)/)?.[1];
    const weight = rule.match(/font-weight:(\d+)/)?.[1];
    if (url && weight) urls.set(weight, url);
  }
  return urls;
}

const preload = (href: string) => ({ rel: 'preload', href, as: 'font', type: 'font/woff2', crossorigin: '' });
const preloadsIn = (text: string) =>
  [...text.matchAll(/<link\b[^>]*>/g)].map(([tag]) => attrsOf(tag)).filter((attrs) => attrs.rel === 'preload');

for (const page of PAGES) {
  const html = skip ? '' : fs.readFileSync(path.join(DIST, page), 'utf8');
  const head = html.slice(html.indexOf('<head>'), html.indexOf('</head>'));
  const template = head.match(new RegExp(`<template ${FONT_PRELOADS_ATTR}>([\\s\\S]*?)</template>`));
  const outside = template ? head.replace(template[0], '') : head;

  test(
    `${page}: JetBrains Mono ${MONO_PRELOAD_WEIGHTS.join('/')} is a plain font preload, and nothing else is`,
    { skip },
    () => {
      const mono = faceUrls(head, 'JetBrains Mono');
      assert.deepEqual(
        preloadsIn(outside),
        MONO_PRELOAD_WEIGHTS.map((weight) => preload(mono.get(weight) ?? `no JetBrains Mono ${weight} face`)),
      );
    },
  );

  test(
    `${page}: the template holds the Inter ${INTER_PRELOAD_WEIGHTS.join('/')} preloads, before the no-flash script`,
    { skip },
    () => {
      assert.ok(template, `no <template ${FONT_PRELOADS_ATTR}> in <head>`);
      const inter = faceUrls(head, 'Inter');
      assert.deepEqual(
        preloadsIn(template[1] ?? ''),
        INTER_PRELOAD_WEIGHTS.map((weight) => preload(inter.get(weight) ?? `no Inter ${weight} face`)),
      );
      assert.equal(
        (template[1] ?? '').replace(/<link\b[^>]*>/g, '').trim(),
        '',
        'the template holds more than preloads',
      );
      assert.ok(
        head.indexOf(template[0]) < head.indexOf(themeInitScript),
        'the template comes after the no-flash script',
      );
    },
  );

  test(`${page}: the preload lists cover every font face the page declares`, { skip }, () => {
    // Guards the lists in src/lib/font-preloads.ts against a face added to astro.config.mjs and forgotten here.
    assert.deepEqual([...faceUrls(head, 'Inter').keys()].sort(), [...INTER_PRELOAD_WEIGHTS]);
    assert.deepEqual([...faceUrls(head, 'JetBrains Mono').keys()].sort(), [...MONO_PRELOAD_WEIGHTS]);
  });
}
