// Tests for the homepage Hero: the pure helpers in src/lib/hero.ts, the resume PDF file name staying in
// sync with scripts/cv/paths.js, and the built Hero in dist/index.html (skipped without a build).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { RESUME_BASENAME } from '../scripts/cv/paths.js';
import { UnknownNetworkError, heroContent, socialIcon } from '../src/lib/hero.ts';
import { getResume } from '../src/lib/resume.ts';
import { RESUME_PDF_FILENAME, RESUME_PDF_URL } from '../src/lib/resume-pdf.ts';

const ROOT = path.join(import.meta.dirname, '..');
const validFixture = path.join(ROOT, 'tests', 'fixtures', 'resume-valid.yaml');
const htmlPath = path.join(ROOT, 'dist', 'index.html');
const skip = fs.existsSync(htmlPath) ? false : 'no dist/index.html: run npm run build first';
const html = skip ? '' : fs.readFileSync(htmlPath, 'utf8');
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
const anchors = (fragment: string) => [...fragment.matchAll(/<a\b[^>]*>[\s\S]*?<\/a>/g)].map(([a]) => a);

// --- pure helpers ---

test('socialIcon maps GitHub and LinkedIn, ignoring case and spaces', () => {
  assert.equal(socialIcon('GitHub'), 'github');
  assert.equal(socialIcon('github'), 'github');
  assert.equal(socialIcon(' LinkedIn '), 'linkedin');
});

test('socialIcon fails for a network with no icon', () => {
  assert.throws(() => socialIcon('Mastodon'), UnknownNetworkError);
  assert.throws(() => socialIcon('Mastodon'), /No Hero icon for profile network "Mastodon"/);
});

test('heroContent takes name, label, tagline and profiles from the resume', () => {
  const resume = getResume(validFixture);
  assert.deepEqual(heroContent(resume), {
    name: 'Jane Example',
    title: 'Software Engineer',
    tagline: 'Example.',
    socials: [
      { network: 'LinkedIn', url: 'https://www.linkedin.com/in/jane-example', icon: 'linkedin' },
      { network: 'GitHub', url: 'https://github.com/jane-example', icon: 'github' },
    ],
  });
});

test('the real resume has an icon for every profile', () => {
  assert.doesNotThrow(() => heroContent(getResume()));
});

test('the download file name matches RESUME_BASENAME in scripts/cv/paths.js', () => {
  assert.equal(RESUME_PDF_FILENAME, `${RESUME_BASENAME}.pdf`);
  assert.equal(RESUME_PDF_URL, '/resume.pdf');
});

// --- the built Hero (dist/index.html) ---

test('the Hero is in the built homepage', { skip }, () => {
  assert.ok(hero, 'no <section data-hero> in dist/index.html');
});

test('the page has exactly one <h1>, the name, inside the Hero', { skip }, () => {
  const h1s = [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/g)];
  assert.equal(h1s.length, 1, `expected one <h1>, found ${h1s.length}`);
  assert.equal(textOf(h1s[0][1]), getResume().basics.name);
  assert.ok(hero.includes(h1s[0][0]), 'the <h1> is not in the Hero');
});

test('the title and tagline come from resume.yaml', { skip }, () => {
  const { label, tagline } = getResume().basics;
  const role = hero.match(/<p\b[^>]*data-hero-role[^>]*>([\s\S]*?)<\/p>/)?.[1];
  const line = hero.match(/<p\b[^>]*data-hero-tagline[^>]*>([\s\S]*?)<\/p>/)?.[1];
  assert.equal(textOf(role ?? ''), label);
  assert.equal(textOf(line ?? ''), tagline);
});

test('Download Resume links to /resume.pdf and downloads with the published file name', { skip }, () => {
  const link = anchors(hero).find((a) => textOf(a) === 'Download Resume');
  assert.ok(link, 'no "Download Resume" link');
  assert.equal(attr(link, 'href'), '/resume.pdf');
  assert.equal(attr(link, 'download'), `${RESUME_BASENAME}.pdf`);
});

test('Download Resume is the only accent-filled element in the Hero', { skip }, () => {
  const filled = [...hero.matchAll(/<[a-z]+\b[^>]*\sclass="([^"]*)"[^>]*>/g)].filter(([, cls]) =>
    cls.split(/\s+/).includes('bg-accent'),
  );
  assert.equal(filled.length, 1);
  assert.match(filled[0][0], /href="\/resume\.pdf"/);
});

test('View Projects links to /#projects', { skip }, () => {
  const link = anchors(hero).find((a) => textOf(a) === 'View Projects');
  assert.ok(link, 'no "View Projects" link');
  assert.equal(attr(link, 'href'), '/#projects');
});

test('the profile links match basics.profiles, in order, each with an aria-label', { skip }, () => {
  const links = anchors(hero).filter((a) => /\sdata-social="/.test(a));
  const { profiles } = getResume().basics;
  assert.deepEqual(
    links.map((a) => attr(a, 'href')),
    profiles.map((p) => p.url),
  );
  assert.deepEqual(
    links.map((a) => attr(a, 'aria-label')),
    profiles.map((p) => p.network),
  );
  for (const a of links) assert.match(a, /<svg\b[^>]*aria-hidden="true"/);
});

test('the Hero ships no script, and any new-tab link has rel="noopener noreferrer"', { skip }, () => {
  assert.doesNotMatch(hero, /<script\b/);
  for (const a of anchors(hero).filter((a) => /\starget="_blank"/.test(a))) {
    assert.equal(attr(a, 'rel'), 'noopener noreferrer');
  }
});
