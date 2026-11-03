// Tests for the homepage Contact section: the helper in src/lib/contact.ts, then the built site in dist/
// (skipped without a build). The email must never appear joined in a built file: no-email-in-dist (npm
// run check:site) scans for it; here we check the parts are there separately and nothing has a mailto:
// href before the browser sets it. Comparisons with the real email parts only ever report true/false, so
// a failure never prints them.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ContactDataError, contactContent } from '../src/lib/contact.ts';
import { getEmailParts, getResume } from '../src/lib/resume.ts';
import { listSiteFiles } from '../scripts/checks/dist-files.ts';

const ROOT = path.join(import.meta.dirname, '..');
const DIST = path.join(ROOT, 'dist');
const validFixture = path.join(ROOT, 'tests', 'fixtures', 'resume-valid.yaml');
const htmlPath = path.join(DIST, 'index.html');
const skip = fs.existsSync(htmlPath) ? false : 'no dist/index.html: run npm run build first';
const html = skip ? '' : fs.readFileSync(htmlPath, 'utf8');
const section = html.match(/<section\b[^>]*\bdata-contact\b[^>]*>[\s\S]*?<\/section>/)?.[0] ?? '';
const hero = html.match(/<section\b[^>]*\bdata-hero\b[^>]*>[\s\S]*?<\/section>/)?.[0] ?? '';

const decode = (text: string) =>
  text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&amp;/g, '&');
const textOf = (fragment: string) =>
  decode(fragment.replace(/<[^>]+>/g, ''))
    .replace(/\s+/g, ' ')
    .trim();
const attr = (tag: string, name: string) => {
  const value = tag.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1];
  return value === undefined ? undefined : decode(value);
};
const openTags = (fragment: string, marker: string) =>
  [...fragment.matchAll(new RegExp(`<[a-z]+\\b[^>]*\\s${marker}\\b[^>]*>`, 'g'))].map(([tag]) => tag);
const anchor = (fragment: string, marker: string) =>
  fragment.match(new RegExp(`<a\\b[^>]*\\s${marker}\\b[^>]*>[\\s\\S]*?<\\/a>`))?.[0] ?? '';

// --- contactContent ---

test('contactContent takes the LinkedIn and GitHub URLs from basics.profiles', () => {
  assert.deepEqual(contactContent(getResume(validFixture)), {
    linkedin: 'https://www.linkedin.com/in/jane-example',
    github: 'https://github.com/jane-example',
  });
});

test('contactContent fails without a LinkedIn or a GitHub profile', () => {
  const resume = getResume(validFixture);
  const without = (network: string) => ({
    ...resume,
    basics: { ...resume.basics, profiles: resume.basics.profiles.filter((p) => p.network !== network) },
  });
  assert.throws(() => contactContent(without('LinkedIn')), ContactDataError);
  assert.throws(() => contactContent(without('LinkedIn')), /needs a LinkedIn profile/);
  assert.throws(() => contactContent(without('GitHub')), /needs a GitHub profile/);
});

test('the real resume has both profiles', () => {
  assert.doesNotThrow(() => contactContent(getResume()));
});

// --- the built Contact section (dist/index.html) ---

test('Contact is a section with id="contact", labelled by its <h2> "Let\'s talk"', { skip }, () => {
  assert.ok(section, 'no <section data-contact> in dist/index.html');
  const open = section.match(/^<section\b[^>]*>/)![0];
  assert.equal(attr(open, 'id'), 'contact');
  const labelledBy = attr(open, 'aria-labelledby');
  const h2 = section.match(new RegExp(`<h2\\b[^>]*\\sid="${labelledBy}"[^>]*>([\\s\\S]*?)<\\/h2>`));
  assert.ok(h2, 'aria-labelledby does not point at an <h2> in the section');
  assert.equal(textOf(h2[1]), "Let's talk");
});

test('the intro line is "Open to backend and distributed systems roles."', { skip }, () => {
  const intro = section.match(/<p\b[^>]*data-contact-intro[^>]*>([\s\S]*?)<\/p>/)?.[1];
  assert.equal(textOf(intro ?? ''), 'Open to backend and distributed systems roles.');
});

test('section order: Hero, Experience, Projects, Skills, Contact', { skip }, () => {
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
});

test('every email element carries the parts as separate attributes, equal to getEmailParts()', { skip }, () => {
  const { user, domain } = getEmailParts();
  const tags = openTags(html, 'data-email-user');
  // CopyEmail's row and its mailto link in Contact, plus the Hero email icon.
  assert.ok(tags.length >= 3, `expected at least 3 email elements, found ${tags.length}`);
  for (const tag of tags) {
    assert.ok(attr(tag, 'data-email-user') === user, 'data-email-user does not match getEmailParts().user');
    assert.ok(attr(tag, 'data-email-domain') === domain, 'data-email-domain does not match getEmailParts().domain');
  }
});

test('no mailto: href in any built file, and email links have no href at all', { skip }, () => {
  for (const file of listSiteFiles(DIST)) {
    const text = fs.readFileSync(path.join(DIST, file), 'utf8');
    assert.doesNotMatch(text, /href\s*=\s*["']?mailto:/i, `${file} has a mailto: href`);
  }
  const links = openTags(html, 'data-email-link');
  assert.equal(links.length, 2, 'expected the Hero icon and the Contact mailto link');
  for (const link of links) {
    assert.match(link, /^<a\b/);
    assert.equal(attr(link, 'href'), undefined, 'an email link has an href in the HTML');
  }
});

test('the email row is hidden until the script reveals it, with the address left empty', { skip }, () => {
  const row = openTags(section, 'data-copy-email');
  assert.equal(row.length, 1);
  assert.match(row[0], /\shidden[\s>]/);
  assert.match(row[0], /\sdata-email-reveal\b/);
  assert.match(section, /<p\b[^>]*data-email-address[^>]*><\/p>/);
});

test('Copy is a <button type="button"> and the only accent-filled element in the section', { skip }, () => {
  const button = section.match(/<button\b[^>]*data-email-copy[^>]*>[\s\S]*?<\/button>/)?.[0] ?? '';
  assert.ok(button, 'no Copy <button>');
  assert.equal(attr(button, 'type'), 'button');
  assert.match(textOf(button), /^Copy email address/);
  const filled = [...section.matchAll(/<[a-z]+\b[^>]*\sclass="([^"]*)"[^>]*>/g)].filter(([, cls]) =>
    cls.split(/\s+/).includes('bg-accent'),
  );
  assert.equal(filled.length, 1);
  assert.match(filled[0][0], /^<button\b[^>]*data-email-copy/);
});

test('copy feedback is announced politely', { skip }, () => {
  const status = openTags(section, 'data-copy-status')[0] ?? '';
  assert.equal(attr(status, 'role'), 'status');
  assert.equal(attr(status, 'aria-live'), 'polite');
});

test('the LinkedIn card and the GitHub link use basics.profiles, their icons, and the same tab', { skip }, () => {
  const { linkedin, github } = contactContent(getResume());
  const li = anchor(section, 'data-contact-linkedin');
  const gh = anchor(section, 'data-contact-github');
  assert.equal(attr(li, 'href'), linkedin);
  assert.equal(attr(gh, 'href'), github);
  assert.match(li, /<svg\b[^>]*aria-hidden="true"[^>]*data-icon="linkedin"/);
  assert.match(gh, /<svg\b[^>]*aria-hidden="true"[^>]*data-icon="github"/);
  assert.equal(textOf(gh), 'GitHub');
  assert.match(textOf(li), /LinkedIn/);
  assert.doesNotMatch(section, /\starget=/);
});

test('the LinkedIn icon path lives in one source file, used by the Hero and Contact', { skip }, () => {
  const LINKEDIN_PATH = 'M20.447 20.452h-3.554';
  const srcDir = path.join(ROOT, 'src');
  const withPath = fs
    .readdirSync(srcDir, { recursive: true, encoding: 'utf8' })
    .map((file) => path.join(srcDir, file))
    .filter((file) => fs.statSync(file).isFile() && !file.endsWith('.json'))
    .filter((file) => fs.readFileSync(file, 'utf8').includes(LINKEDIN_PATH));
  assert.deepEqual(
    withPath.map((file) => path.relative(ROOT, file).replaceAll('\\', '/')),
    ['src/components/LinkedInIcon.astro'],
  );
  assert.equal([...hero.matchAll(/data-icon="linkedin"/g)].length, 1, 'Hero LinkedIn icon');
  assert.equal([...section.matchAll(/data-icon="linkedin"/g)].length, 1, 'Contact LinkedIn icon');
});

test('without JavaScript, a <noscript> line points to LinkedIn', { skip }, () => {
  const noscript = section.match(/<noscript>([\s\S]*?)<\/noscript>/)?.[1] ?? '';
  assert.match(textOf(noscript), /LinkedIn/);
});

test('the page still has exactly one <h1>, and it is not in this section', { skip }, () => {
  assert.equal([...html.matchAll(/<h1\b/g)].length, 1);
  assert.doesNotMatch(section, /<h1\b/);
});
