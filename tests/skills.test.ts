// Tests for the homepage Skills section: the pure helper in src/lib/skills.ts and the built section in
// dist/index.html (skipped without a build). Expected content always comes from the resume, so editing
// skills in src/data/resume.yaml needs no test change.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { getResume } from '../src/lib/resume.ts';
import { skillsContent } from '../src/lib/skills.ts';

const ROOT = path.join(import.meta.dirname, '..');
const validFixture = path.join(ROOT, 'tests', 'fixtures', 'resume-valid.yaml');
const htmlPath = path.join(ROOT, 'dist', 'index.html');
const skip = fs.existsSync(htmlPath) ? false : 'no dist/index.html: run npm run build first';
const html = skip ? '' : fs.readFileSync(htmlPath, 'utf8');
const section = html.match(/<section\b[^>]*\bdata-skills\b[^>]*>[\s\S]*?<\/section>/)?.[0] ?? '';

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
const categoryBlocks = (fragment: string) =>
  [...fragment.matchAll(/<div\b[^>]*\sdata-skill-category\b[^>]*>[\s\S]*?<\/ul>/g)].map(([block]) => block);

// --- skillsContent ---

test('skillsContent returns the fixture categories and items, in YAML order', () => {
  assert.deepEqual(skillsContent(getResume(validFixture)), [
    { category: 'Languages', items: ['Java', 'SQL'] },
    { category: 'Tools', items: ['Docker', 'Git'] },
  ]);
});

test('skillsContent keeps every category and item of the real resume, in order, nothing added', () => {
  const resume = getResume();
  assert.deepEqual(
    skillsContent(resume),
    resume.skills.map(({ category, items }) => ({ category, items })),
  );
});

test('skillsContent returns copies: changing the result does not change the resume', () => {
  const resume = getResume(validFixture);
  const content = skillsContent(resume);
  content[0].items.push('Extra');
  assert.deepEqual(resume.skills[0].items, ['Java', 'SQL']);
});

// --- the built section (dist/index.html) ---

test('the Skills section is in the built homepage, with id="skills" and a labelled <h2>', { skip }, () => {
  assert.ok(section, 'no <section data-skills> in dist/index.html');
  const open = section.match(/<section\b[^>]*>/)![0];
  assert.equal(attr(open, 'id'), 'skills');
  const h2 = section.match(/<h2\b[^>]*>([\s\S]*?)<\/h2>/);
  assert.ok(h2, 'no <h2> in the Skills section');
  assert.equal(textOf(h2[1]), 'Skills');
  assert.equal(attr(open, 'aria-labelledby'), attr(h2[0], 'id'));
});

test('every category (as <h3>) and every item (as a list item) appears, in YAML order', { skip }, () => {
  const blocks = categoryBlocks(section);
  const skills = getResume().skills;
  assert.equal(blocks.length, skills.length, 'category count');
  skills.forEach(({ category, items }, i) => {
    const h3 = blocks[i].match(/<h3\b[^>]*>([\s\S]*?)<\/h3>/);
    assert.ok(h3, `no <h3> for category ${i}`);
    assert.equal(textOf(h3[1]), category);
    assert.match(blocks[i], /<ul\b[^>]*\srole="list"/, `${category}: items are not in a role="list" <ul>`);
    const shown = [...blocks[i].matchAll(/<li\b[^>]*\sdata-skill\b[^>]*>([\s\S]*?)<\/li>/g)].map(([, t]) => textOf(t));
    assert.deepEqual(shown, items, `${category}: items`);
  });
});

test('no levels of any kind: no %, progress bars, meters, ratings or widths', { skip }, () => {
  assert.doesNotMatch(section, /<(progress|meter)\b/);
  assert.doesNotMatch(section, /role="(progressbar|meter|slider)"/);
  assert.doesNotMatch(section, /aria-value(now|min|max|text)=/);
  assert.doesNotMatch(section, /\sstyle="/);
  const text = textOf(section);
  assert.doesNotMatch(text, /%/);
  assert.doesNotMatch(text, /\b\d+\s*\/\s*\d+\b/, 'looks like a rating (e.g. 4/5)');
  assert.doesNotMatch(text, /[★☆]/);
});

test('spoken languages are not in the Skills section (they go on /resume)', { skip }, () => {
  const text = textOf(section);
  for (const { language } of getResume().languages ?? []) {
    assert.ok(!text.includes(language), `spoken language in Skills: ${language}`);
  }
});

test('the page still has exactly one <h1>, and it is not in this section', { skip }, () => {
  assert.equal([...html.matchAll(/<h1\b/g)].length, 1);
  assert.doesNotMatch(section, /<h1\b/);
});

test('the section ships no script and has no accent-filled element', { skip }, () => {
  assert.doesNotMatch(section, /<script\b/);
  const filled = [...section.matchAll(/\sclass="([^"]*)"/g)].filter(([, cls]) =>
    cls.split(/\s+/).includes('bg-accent'),
  );
  assert.equal(filled.length, 0);
});
