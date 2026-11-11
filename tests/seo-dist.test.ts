// SEO in the build (Task 2.13), on dist/ (skipped without a build): titles and descriptions, canonical links, Open
// Graph and Twitter tags, sitemap.xml, robots.txt and the homepage's Person JSON-LD. The email and phone checks
// compare as true/false only, so a failure never prints them. The pure helpers are tested in tests/seo.test.ts.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { listSiteFiles } from '../scripts/checks/dist-files.ts';
import { findPhone, phonePattern, readPhone } from '../scripts/checks/phone.ts';
import { getEmailParts, getResume } from '../src/lib/resume.ts';
import { readIco } from '../scripts/og/ico.ts';
import { OG_IMAGE, SITE_ICONS } from '../src/lib/seo.ts';

const ROOT = path.join(import.meta.dirname, '..');
const DIST = path.join(ROOT, 'dist');
const skip = fs.existsSync(path.join(DIST, 'sitemap.xml')) ? false : 'no dist/sitemap.xml: run npm run build first';
const SITE = fs.readFileSync(path.join(ROOT, 'astro.config.mjs'), 'utf8').match(/^\s*site:\s*'([^']+)'/m)?.[1] ?? '';

const read = (file: string) => (skip ? '' : fs.readFileSync(path.join(DIST, file), 'utf8'));

// Every built HTML page, by its URL path.
const PAGES = skip
  ? []
  : listSiteFiles(DIST)
      .filter((file) => file.endsWith('.html'))
      .map((file) => {
        const url = `/${file
          .replace(/\\/g, '/')
          .replace(/(^|\/)index\.html$/, '')
          .replace(/\.html$/, '')}`;
        return { file, url, html: read(file) };
      });
const page = (url: string) => PAGES.find((p) => p.url === url)?.html ?? '';
const INDEXABLE = PAGES.filter(({ html }) => !/<meta name="robots" content="noindex"/.test(html));

const headOf = (html: string) => html.slice(html.indexOf('<head>'), html.indexOf('</head>'));
const meta = (html: string, key: string) =>
  headOf(html).match(new RegExp(`<meta (?:property|name)="${key}" content="([^"]*)"`))?.[1];
const canonicalOf = (html: string) => headOf(html).match(/<link rel="canonical" href="([^"]+)"/)?.[1];
const jsonLdOf = (html: string) =>
  [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(([, text]) => text);

const sitemap = read('sitemap.xml');
const robots = read('robots.txt');

test('the build has the homepage, /resume and the 404 page', { skip }, () => {
  assert.deepEqual(PAGES.map(({ url }) => url).sort(), ['/', '/404', '/resume']);
});

test('every page has a unique title and a unique meta description', { skip }, () => {
  for (const describe of [
    (h: string) => h.match(/<title>([^<]+)<\/title>/)?.[1],
    (h: string) => meta(h, 'description'),
  ]) {
    const values = PAGES.map(({ html }) => describe(html));
    for (const value of values) assert.ok(value, 'missing title or description');
    assert.equal(new Set(values).size, values.length, `duplicate: ${values.join(' | ')}`);
  }
});

test(
  'every page except 404 has an absolute canonical on `site`, with no trailing slash except the root',
  { skip },
  () => {
    for (const { url, html } of PAGES) {
      const canonical = canonicalOf(html);
      if (url === '/404') {
        assert.equal(canonical, undefined, '404 must have no canonical');
        continue;
      }
      assert.equal(canonical, url === '/' ? `${SITE}/` : `${SITE}${url}`);
      assert.equal([...headOf(html).matchAll(/rel="canonical"/g)].length, 1);
    }
  },
);

test('the homepage title is "name – label" and its description is the tagline, from resume.yaml', { skip }, () => {
  const { name, label, tagline } = getResume().basics;
  const html = page('/');
  const decode = (text = '') =>
    text
      .replace(/&amp;/g, '&')
      .replace(/&#39;/g, "'")
      .replace(/&quot;/g, '"');
  assert.equal(decode(meta(html, 'og:title')), `${name} – ${label}`);
  assert.equal(decode(html.match(/<title>([^<]+)<\/title>/)?.[1]), `${name} – ${label}`);
  assert.equal(decode(meta(html, 'description')), tagline.trim());
  assert.equal(decode(meta(html, 'og:description')), tagline.trim());
});

test('the 404 page is noindex, with no canonical and no og:url', { skip }, () => {
  const html = page('/404');
  assert.match(headOf(html), /<meta name="robots" content="noindex">/);
  assert.equal(canonicalOf(html), undefined);
  assert.equal(meta(html, 'og:url'), undefined);
});

test('every page has the Open Graph and Twitter tags, with absolute URLs', { skip }, () => {
  const { name, label } = getResume().basics;
  for (const { url, html } of PAGES) {
    assert.equal(meta(html, 'og:type'), 'website', url);
    assert.equal(meta(html, 'og:title'), html.match(/<title>([^<]+)<\/title>/)?.[1], url);
    assert.equal(meta(html, 'og:description'), meta(html, 'description'), url);
    assert.equal(meta(html, 'og:image'), `${SITE}${OG_IMAGE.path}`, url);
    assert.equal(meta(html, 'og:image:width'), String(OG_IMAGE.width), url);
    assert.equal(meta(html, 'og:image:height'), String(OG_IMAGE.height), url);
    assert.equal(meta(html, 'og:image:type'), 'image/png', url);
    assert.equal(meta(html, 'og:image:alt'), `${name} – ${label}`.replace(/&/g, '&amp;'), url);
    assert.equal(meta(html, 'twitter:card'), 'summary_large_image', url);
    if (url !== '/404') assert.equal(meta(html, 'og:url'), canonicalOf(html), url);
  }
});

test('the noindex robots meta is only on the 404 page', { skip }, () => {
  assert.deepEqual(
    PAGES.filter((p) => !INDEXABLE.includes(p)).map(({ url }) => url),
    ['/404'],
  );
});

test('sitemap.xml lists exactly the indexable pages as absolute URLs: no /404, no trailing slashes', { skip }, () => {
  const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(([, loc]) => loc);
  assert.deepEqual(locs, [`${SITE}/`, `${SITE}/resume`]);
  assert.deepEqual(locs.sort(), INDEXABLE.map(({ html }) => canonicalOf(html)).sort());
  assert.doesNotMatch(sitemap, /404/);
  for (const loc of locs.slice(1)) assert.doesNotMatch(loc, /\/$/);
  assert.match(
    sitemap,
    /^<\?xml version="1\.0" encoding="UTF-8"\?>\n<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/,
  );
  assert.match(sitemap, /<\/urlset>\n$/);
});

test('robots.txt has no Disallow and an absolute Sitemap line', { skip }, () => {
  assert.doesNotMatch(robots, /disallow/i);
  assert.match(robots, /^User-agent: \*$/m);
  assert.ok(robots.split('\n').includes(`Sitemap: ${SITE}/sitemap.xml`));
});

test('the no-phone and no-email checks scan sitemap.xml and robots.txt', { skip }, () => {
  const files = listSiteFiles(DIST);
  assert.ok(files.includes('sitemap.xml'));
  assert.ok(files.includes('robots.txt'));
});

test('the Person JSON-LD is only on the homepage, once', { skip }, () => {
  assert.equal(jsonLdOf(page('/')).length, 1);
  for (const { url, html } of PAGES) if (url !== '/') assert.equal(jsonLdOf(html).length, 0, url);
  assert.ok(headOf(page('/')).includes('application/ld+json'), 'the JSON-LD is not in <head>');
});

test('the JSON-LD parses, is a Person, and its name matches resume.yaml', { skip }, () => {
  const person = JSON.parse(jsonLdOf(page('/'))[0]);
  assert.equal(person['@type'], 'Person');
  assert.equal(person.name, getResume().basics.name);
  assert.equal(person.url, `${SITE}/`);
});

test(
  'the JSON-LD has no email or telephone key, and neither the email nor the phone (true/false only)',
  { skip },
  () => {
    const text = jsonLdOf(page('/'))[0];
    assert.equal(/"(email|telephone|phone|address)"\s*:/i.test(text), false, 'a forbidden key is in the JSON-LD');
    const { user, domain } = getEmailParts();
    assert.equal(text.includes(`${user}@${domain}`), false, 'the email is in the JSON-LD');
    // Without CV_PHONE (locally, no .env) only check:site's no-phone-in-dist covers it.
    const phone = process.env.CV_PHONE ? readPhone() : undefined;
    if (phone && 'phone' in phone) {
      assert.equal(findPhone(text, phonePattern(phone.phone)).length, 0, 'the phone is in the JSON-LD');
    }
  },
);

test('dist/og-image.png is the committed public/og-image.png', { skip }, () => {
  const built = fs.readFileSync(path.join(DIST, 'og-image.png'));
  assert.ok(built.equals(fs.readFileSync(path.join(ROOT, 'public', 'og-image.png'))), 'rebuild after npm run og');
});

// The site icons (Task 2.13a).
const linksOf = (html: string, rel: string) =>
  [...headOf(html).matchAll(/<link ([^>]*)>/g)]
    .map(([, attrs]) => Object.fromEntries([...attrs.matchAll(/([\w-]+)="([^"]*)"/g)].map(([, k, v]) => [k, v])))
    .filter((attrs) => attrs.rel === rel);

test('every page links favicon.ico, with sizes equal to the real ICO directory', { skip }, () => {
  const sizes = readIco(fs.readFileSync(path.join(DIST, 'favicon.ico')))
    .map(({ width, height }) => `${width}x${height}`)
    .join(' ');
  assert.equal(sizes, '16x16 32x32 48x48');
  for (const { url, html } of PAGES) {
    const links = linksOf(html, 'icon');
    assert.equal(links.length, 1, `${url}: one rel="icon"`);
    assert.equal(links[0].href, '/favicon.ico', url);
    assert.equal(links[0].sizes, sizes, url);
  }
});

test('every page links apple-touch-icon.png at 180x180', { skip }, () => {
  for (const { url, html } of PAGES) {
    const links = linksOf(html, 'apple-touch-icon');
    assert.equal(links.length, 1, `${url}: one rel="apple-touch-icon"`);
    assert.equal(links[0].href, SITE_ICONS.appleTouch.path, url);
    assert.equal(links[0].href, '/apple-touch-icon.png', url);
    assert.equal(links[0].sizes, '180x180', url);
  }
});

test('the dist/ icons are the committed ones in public/', { skip }, () => {
  for (const file of ['favicon.ico', 'apple-touch-icon.png']) {
    const built = fs.readFileSync(path.join(DIST, file));
    assert.ok(built.equals(fs.readFileSync(path.join(ROOT, 'public', file))), `${file}: rebuild after npm run og`);
  }
});
