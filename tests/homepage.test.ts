// Tests for the assembled homepage and the site footer, on the built site (skipped without a build). The
// footer and link-text tests run over every built page, so /resume (2.11) and the 404 page (2.12) are
// covered as soon as they exist. Comparisons with the real email parts only ever report true/false, so a
// failure never prints them.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { listSiteFiles } from '../scripts/checks/dist-files.ts';
import { getEmailParts, getResume } from '../src/lib/resume.ts';

const ROOT = path.join(import.meta.dirname, '..');
const DIST = path.join(ROOT, 'dist');
const htmlPath = path.join(DIST, 'index.html');
const skip = fs.existsSync(htmlPath) ? false : 'no dist/index.html: run npm run build first';
const html = skip ? '' : fs.readFileSync(htmlPath, 'utf8');

const pages = skip
  ? []
  : listSiteFiles(DIST)
      .filter((file) => file.endsWith('.html'))
      .map((file) => ({ file, html: fs.readFileSync(path.join(DIST, file), 'utf8') }));

const footerOf = (page: string) => page.match(/<footer\b[\s\S]*?<\/footer>/)?.[0] ?? '';
const decode = (text: string) =>
  text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&copy;/g, '©')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&amp;/g, '&');
const textOf = (fragment: string) =>
  decode(fragment.replace(/<[^>]+>/g, ''))
    .replace(/\s+/g, ' ')
    .trim();
const anchors = (fragment: string) => [...fragment.matchAll(/<a\b[^>]*>[\s\S]*?<\/a>/g)].map(([a]) => a);
const attr = (tag: string, name: string) => {
  const value = tag.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1];
  return value === undefined ? undefined : decode(value);
};

// --- the homepage ---

test('the homepage has the five sections in order, with their ids', { skip }, () => {
  const at = ['data-hero', 'id="experience"', 'id="projects"', 'id="skills"', 'id="contact"'].map((marker) =>
    html.search(new RegExp(`<section\\b[^>]*${marker}`)),
  );
  assert.ok(
    at.every((index) => index >= 0),
    'a section is missing',
  );
  assert.deepEqual(
    at,
    [...at].sort((a, b) => a - b),
  );
  assert.equal([...html.matchAll(/<section\b/g)].length, 5, 'only these five sections');
});

test('the temporary swatch content is gone', { skip }, () => {
  const main = html.match(/<main\b[\s\S]*<\/main>/)?.[0] ?? '';
  assert.ok(main, 'no <main>');
  assert.doesNotMatch(main, /swatch|Design tokens|Accent button|Outline button|Text on --/i);
  assert.doesNotMatch(main, /--(bg|surface|text|accent|border)\b/);
});

test('the homepage has exactly one <h1>', { skip }, () => {
  assert.equal([...html.matchAll(/<h1\b/g)].length, 1);
});

test('the mail icon is filled, like the GitHub and LinkedIn icons', { skip }, () => {
  const icons = [...html.matchAll(/<svg\b[^>]*data-icon="mail"[^>]*>/g)].map(([tag]) => tag);
  assert.ok(icons.length > 0, 'no mail icon on the homepage');
  for (const icon of icons) {
    assert.equal(attr(icon, 'fill'), 'currentColor');
    assert.equal(attr(icon, 'viewBox'), '0 0 24 24');
    assert.doesNotMatch(icon, /\sstroke=/);
  }
});

// --- the footer, on every built page ---

test('there is at least one built page to check', { skip }, () => {
  assert.ok(pages.some(({ file }) => file === 'index.html'));
});

test('every page has one footer, after <main>, with the name and the build year', { skip }, () => {
  const { name } = getResume().basics;
  for (const { file, html: page } of pages) {
    assert.equal([...page.matchAll(/<footer\b/g)].length, 1, `${file}: footers`);
    assert.ok(page.indexOf('</main>') < page.indexOf('<footer'), `${file}: footer is not after <main>`);
    // The year the file was built, so an old build doesn't fail after New Year.
    const year = fs.statSync(path.join(DIST, file)).mtime.getFullYear();
    const copyright = footerOf(page).match(/<p\b[^>]*data-footer-copyright[^>]*>([\s\S]*?)<\/p>/)?.[1] ?? '';
    assert.equal(textOf(copyright), `© ${year} ${name}`, `${file}: name and year`);
  }
});

test('every footer links to basics.profiles, in order, with the shared icons', { skip }, () => {
  const { profiles } = getResume().basics;
  for (const { file, html: page } of pages) {
    const links = anchors(footerOf(page)).filter((a) => /\sdata-footer-social=/.test(a));
    assert.deepEqual(
      links.map((a) => ({ href: attr(a, 'href'), text: textOf(a) })),
      profiles.map(({ url, network }) => ({ href: url, text: network })),
      `${file}: profile links`,
    );
    for (const link of links) {
      const icon = attr(link.match(/<a\b[^>]*>/)![0], 'data-footer-social');
      assert.match(icon ?? '', /^(github|linkedin)$/);
      assert.match(link, new RegExp(`<svg\\b[^>]*aria-hidden="true"[^>]*data-icon="${icon}"`), `${file}: ${icon} icon`);
    }
  }
});

test('every footer has a Back to top link with an arrow icon, to a focusable #top', { skip }, () => {
  for (const { file, html: page } of pages) {
    const link = anchors(footerOf(page)).find((a) => /\sdata-back-to-top\b/.test(a)) ?? '';
    assert.ok(link, `${file}: no Back to top link`);
    assert.equal(attr(link, 'href'), '#top', `${file}: href`);
    assert.equal(textOf(link), 'Back to top', `${file}: visible text`);
    assert.match(link, /<svg\b[^>]*aria-hidden="true"[^>]*data-icon="arrow-up"/, `${file}: arrow icon`);
    const target = page.match(/<[a-z]+\b[^>]*\sid="top"[^>]*>/)?.[0] ?? '';
    assert.equal(attr(target, 'tabindex'), '-1', `${file}: #top tabindex`);
    const body = page.slice(page.indexOf('<body'));
    assert.ok(body.indexOf('id="top"') < body.indexOf('href="#main"'), `${file}: #top is not before the skip link`);
  }
});

test('no footer has email, script, or accent fill', { skip }, () => {
  const { user, domain } = getEmailParts();
  for (const { file, html: page } of pages) {
    const footer = footerOf(page);
    assert.ok(footer, `${file}: no footer`);
    assert.doesNotMatch(footer, /data-email-/, `${file}: data-email-* in the footer`);
    assert.doesNotMatch(footer, /mailto:/i, `${file}: mailto: in the footer`);
    assert.doesNotMatch(footer, /<script\b/, `${file}: script in the footer`);
    assert.doesNotMatch(footer, /\bbg-accent\b/, `${file}: accent fill in the footer`);
    assert.ok(!footer.includes(user), `${file}: the email user is in the footer`);
    assert.ok(!footer.includes(domain), `${file}: the email domain is in the footer`);
  }
});

// --- arrows that render as emoji on phones ---

test('no link text on any page contains the arrow characters that can render as emoji', { skip }, () => {
  for (const { file, html: page } of pages) {
    for (const link of anchors(page)) {
      assert.doesNotMatch(textOf(link), /[↗↑]/, `${file}: "${textOf(link)}"`);
    }
  }
});
