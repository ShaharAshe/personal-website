// Tests for src/lib/seo.ts (Task 2.13): absolute URLs, the sitemap and robots.txt text, and the Person JSON-LD.
// Also checks the one base URL: `site` in astro.config.mjs is the only place the host is written. The built
// pages, sitemap.xml and robots.txt are checked in tests/seo-dist.test.ts.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { getEmailParts, getResume } from '../src/lib/resume.ts';
import {
  MissingSiteError,
  SITEMAP_PATHS,
  absoluteUrl,
  jsonLdScript,
  personJsonLd,
  robotsTxt,
  sitemapXml,
} from '../src/lib/seo.ts';

const ROOT = path.join(import.meta.dirname, '..');
const config = fs.readFileSync(path.join(ROOT, 'astro.config.mjs'), 'utf8');
const SITE = config.match(/^\s*site:\s*'([^']+)'/m)?.[1] ?? '';

/** Every key at any depth of a JSON value. */
function keysOf(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(keysOf);
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, child]) => [key, ...keysOf(child)]);
  }
  return [];
}

test('astro.config.mjs sets site to an https origin with no trailing slash', () => {
  assert.ok(SITE, 'no `site:` in astro.config.mjs');
  const url = new URL(SITE);
  assert.equal(url.protocol, 'https:');
  assert.equal(SITE, url.origin, 'site must be a bare origin, without a path or trailing slash');
});

test('the site host is written only in astro.config.mjs (not in src/ or public/)', () => {
  const host = new URL(SITE).host;
  const hits = ['src', 'public'].flatMap((dir) =>
    fs
      .readdirSync(path.join(ROOT, dir), { recursive: true, encoding: 'utf8' })
      .map((file) => path.join(dir, file))
      .filter((file) => fs.statSync(path.join(ROOT, file)).isFile())
      .filter((file) => fs.readFileSync(path.join(ROOT, file)).includes(host)),
  );
  assert.deepEqual(hits, []);
});

test('absoluteUrl keeps the root slash and drops every other trailing slash', () => {
  assert.equal(absoluteUrl('/', SITE), `${SITE}/`);
  assert.equal(absoluteUrl('', SITE), `${SITE}/`);
  assert.equal(absoluteUrl('/resume', SITE), `${SITE}/resume`);
  assert.equal(absoluteUrl('/resume/', SITE), `${SITE}/resume`);
  assert.equal(absoluteUrl('/resume//', new URL(SITE)), `${SITE}/resume`);
  assert.equal(absoluteUrl('/og-image.png', `${SITE}/`), `${SITE}/og-image.png`);
});

test('absoluteUrl fails clearly without a site', () => {
  assert.throws(() => absoluteUrl('/', undefined), MissingSiteError);
});

test('the sitemap lists the homepage and /resume only', () => {
  assert.deepEqual([...SITEMAP_PATHS], ['/', '/resume']);
});

test('sitemapXml is a well-formed urlset of absolute URLs', () => {
  const xml = sitemapXml(SITE);
  // The whole document matches the sitemap grammar: declaration, urlset, then only <url><loc>…</loc></url>.
  assert.match(
    xml,
    /^<\?xml version="1\.0" encoding="UTF-8"\?>\n<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">\n(  <url>\n    <loc>[^<>&"]+<\/loc>\n  <\/url>\n)+<\/urlset>\n$/,
  );
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(([, loc]) => loc);
  assert.deepEqual(locs, [`${SITE}/`, `${SITE}/resume`]);
});

test('robotsTxt allows everything and points to the absolute sitemap URL', () => {
  const robots = robotsTxt(SITE);
  assert.doesNotMatch(robots, /disallow/i);
  assert.match(robots, /^User-agent: \*$/m);
  assert.match(robots, new RegExp(`^Sitemap: ${SITE.replace(/[.]/g, '\\.')}/sitemap\\.xml$`, 'm'));
});

test('personJsonLd is a schema.org Person built from resume.yaml', () => {
  const resume = getResume();
  const person = personJsonLd(resume, SITE);
  assert.equal(person['@context'], 'https://schema.org');
  assert.equal(person['@type'], 'Person');
  assert.equal(person.name, resume.basics.name);
  assert.equal(person.jobTitle, resume.basics.label);
  assert.equal(person.url, `${SITE}/`);
  assert.deepEqual(
    person.sameAs,
    resume.basics.profiles.map(({ url }) => url),
  );
  assert.ok(Array.isArray(person.knowsAbout) && person.knowsAbout.length > 0);
});

test('personJsonLd has no email, telephone or address, as keys or values (true/false only)', () => {
  const person = personJsonLd(getResume(), SITE);
  const keys = keysOf(person).map((key) => key.toLowerCase());
  for (const forbidden of ['email', 'telephone', 'phone', 'address', 'faxnumber']) {
    assert.equal(keys.includes(forbidden), false, `JSON-LD has a "${forbidden}" key`);
  }
  const { user, domain } = getEmailParts();
  const text = JSON.stringify(person);
  assert.equal(text.includes(`${user}@${domain}`), false, 'the email is in the JSON-LD');
  assert.equal(text.includes(domain) && text.includes(user), false, 'the email parts are in the JSON-LD');
});

test('jsonLdScript escapes "<", so the text can never close the <script>', () => {
  const text = jsonLdScript({ name: '</script><script>alert(1)</script>' });
  assert.doesNotMatch(text, /</);
  assert.deepEqual(JSON.parse(text), { name: '</script><script>alert(1)</script>' });
});
