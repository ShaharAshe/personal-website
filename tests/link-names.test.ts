// Link names in the build (Task 2.16), on dist/ (skipped without a build). On every page, two links with the same
// accessible name must go to the same URL (WCAG 2.4.9; Lighthouse's "Identical links have the same purpose"). It
// flagged /resume, where the project's "GitHub" link went to a repo and the profile's "GitHub" links to the profile.
//
// The accessible name here is what browsers compute for these links: aria-label when present, otherwise the text
// content without aria-hidden parts (the site's icons are aria-hidden SVGs). Links with no href (the mail link,
// whose href is set in the browser) aren't links yet in the HTML, so they're skipped.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const DIST = path.join(import.meta.dirname, '..', 'dist');
const PAGES = { '/': 'index.html', '/resume': 'resume/index.html', '/no-such-page (404)': '404.html' };
const skip = Object.values(PAGES).every((file) => fs.existsSync(path.join(DIST, file)))
  ? false
  : 'no build in dist/: run npm run build first';

const decode = (text: string) =>
  text
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');

const attr = (tag: string, name: string) => {
  const value = tag.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1];
  return value === undefined ? undefined : decode(value);
};

/** Every link with an href, with its accessible name. */
function linkNames(html: string): { name: string; href: string }[] {
  return [...html.matchAll(/(<a\b[^>]*>)([\s\S]*?)<\/a>/g)].flatMap(([, open, content]) => {
    const href = attr(open, 'href');
    if (href === undefined) return [];
    const label = attr(open, 'aria-label');
    const text = content
      .replace(/<(svg|span)\b[^>]*\saria-hidden="true"[^>]*>[\s\S]*?<\/\1>/g, '')
      .replace(/<[^>]+>/g, ' ');
    const name = (label ?? decode(text)).replace(/\s+/g, ' ').trim();
    return [{ name, href }];
  });
}

/** Names shared by links to different URLs, as "name → href, href". */
function ambiguousNames(links: { name: string; href: string }[]): string[] {
  const byName = new Map<string, Set<string>>();
  for (const { name, href } of links) byName.set(name, (byName.get(name) ?? new Set()).add(href));
  return [...byName].filter(([, hrefs]) => hrefs.size > 1).map(([name, hrefs]) => `${name} → ${[...hrefs].join(', ')}`);
}

test('linkNames: aria-label wins, aria-hidden icons are left out, links without href are skipped', () => {
  const html = `
    <a href="/a" aria-label="Repo on GitHub"><svg aria-hidden="true"><path/></svg> GitHub</a>
    <a href="/b"><svg aria-hidden="true" data-icon="github"><path/></svg>
      GitHub</a>
    <a href="/c">Back <span aria-hidden="true">↑</span> &amp; top</a>
    <a data-email-link><span data-email-address></span></a>`;
  assert.deepEqual(linkNames(html), [
    { name: 'Repo on GitHub', href: '/a' },
    { name: 'GitHub', href: '/b' },
    { name: 'Back & top', href: '/c' },
  ]);
});

test('ambiguousNames: the same name to different URLs is reported, to the same URL is fine', () => {
  assert.deepEqual(
    ambiguousNames([
      { name: 'GitHub', href: 'https://github.com/x' },
      { name: 'GitHub', href: 'https://github.com/x' },
      { name: 'GitHub', href: 'https://github.com/x/repo' },
      { name: 'Resume', href: '/resume' },
    ]),
    ['GitHub → https://github.com/x, https://github.com/x/repo'],
  );
});

for (const [url, file] of Object.entries(PAGES)) {
  test(`${url}: no two links share an accessible name while pointing to different URLs`, { skip }, () => {
    const links = linkNames(fs.readFileSync(path.join(DIST, file), 'utf8'));
    assert.ok(links.length > 3, `only ${links.length} links found`);
    assert.ok(
      links.every(({ name }) => name.length > 0),
      'a link has an empty name',
    );
    assert.deepEqual(ambiguousNames(links), []);
  });
}
