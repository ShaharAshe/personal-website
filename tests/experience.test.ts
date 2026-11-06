// Tests for the homepage Experience section: the pure helpers in src/lib/experience.ts and
// src/lib/resume-dates.ts (which must format dates exactly like scripts/cv/format.js does for the PDF), the
// design-doc §5.1 featured-highlight rule, and the built section in dist/index.html (skipped without a build).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import * as pdfFormat from '../scripts/cv/format.js';
import { experienceContent } from '../src/lib/experience.ts';
import { getResume } from '../src/lib/resume.ts';
import { dateParts, dateRange, formatDate, type DatedItem } from '../src/lib/resume-dates.ts';

const ROOT = path.join(import.meta.dirname, '..');
const validFixture = path.join(ROOT, 'tests', 'fixtures', 'resume-valid.yaml');
const htmlPath = path.join(ROOT, 'dist', 'index.html');
const skip = fs.existsSync(htmlPath) ? false : 'no dist/index.html: run npm run build first';
const html = skip ? '' : fs.readFileSync(htmlPath, 'utf8');
const section = html.match(/<section\b[^>]*\bdata-experience\b[^>]*>[\s\S]*?<\/section>/)?.[0] ?? '';

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
const roleItems = (fragment: string) =>
  [...fragment.matchAll(/<li\b[^>]*\sdata-role\b[^>]*>[\s\S]*?<\/article>/g)].map(([li]) => li);
const element = (fragment: string, dataAttr: string) =>
  fragment.match(new RegExp(`<([a-z0-9]+)\\b[^>]*\\s${dataAttr}\\b[^>]*>([\\s\\S]*?)</\\1>`))?.[2] ?? '';

// --- dates: same output as the PDF (scripts/cv/format.js) ---

test('formatDate and dateRange give the PDF format, including "Present"', () => {
  assert.equal(formatDate('2025-04'), 'Apr 2025');
  assert.equal(formatDate('2021'), '2021');
  assert.equal(formatDate(undefined), 'Present');
  assert.equal(dateRange({ startDate: '2025-04', endDate: '2026-04' }), 'Apr 2025 – Apr 2026');
  assert.equal(dateRange({ startDate: '2024-01' }), 'Jan 2024 – Present');
});

test('the site formats every date exactly like scripts/cv/format.js', () => {
  const months = Array.from({ length: 12 }, (_, i) => `2025-${String(i + 1).padStart(2, '0')}`);
  for (const value of [...months, '2021', undefined]) {
    assert.equal(formatDate(value), pdfFormat.formatDate(value), `formatDate(${value})`);
  }

  const items: DatedItem[] = [
    { startDate: '2025-04', endDate: '2026-04' },
    { startDate: '2021' },
    { startDate: '2021', endDate: '2024' },
  ];
  for (const resume of [getResume(), getResume(validFixture)]) {
    items.push(...resume.work, ...resume.education);
  }
  for (const item of items) {
    assert.equal(dateRange(item), pdfFormat.dateRange(item), `dateRange(${JSON.stringify(item)})`);
  }
});

test('dateParts gives <time datetime> values, and no end for an ongoing item', () => {
  assert.deepEqual(dateParts({ startDate: '2025-04', endDate: '2026-04' }), {
    start: { datetime: '2025-04', label: 'Apr 2025' },
    end: { datetime: '2026-04', label: 'Apr 2026' },
  });
  assert.deepEqual(dateParts({ startDate: '2021' }), { start: { datetime: '2021', label: '2021' }, end: null });
});

// --- experienceContent ---

test('experienceContent keeps only featured highlights, in YAML order, and lists a role with none', () => {
  assert.deepEqual(experienceContent(getResume(validFixture)), [
    {
      company: 'Example Corp',
      position: 'Software Engineer',
      dates: { start: { datetime: '2024-01', label: 'Jan 2024' }, end: null, text: 'Jan 2024 – Present' },
      highlights: ['Built a service that handles example requests'],
    },
    {
      company: 'Sample Ltd',
      position: 'Intern',
      dates: {
        start: { datetime: '2023-06', label: 'Jun 2023' },
        end: { datetime: '2023-09', label: 'Sep 2023' },
        text: 'Jun 2023 – Sep 2023',
      },
      highlights: [],
    },
  ]);
});

test('experienceContent follows the featured flags of the real resume, in order', () => {
  const resume = getResume();
  assert.deepEqual(
    experienceContent(resume).map((role) => role.highlights),
    resume.work.map((job) => job.highlights.filter((h) => h.featured).map((h) => h.text)),
  );
});

test("experienceContent with highlights: 'all' returns every highlight, in YAML order", () => {
  for (const resume of [getResume(), getResume(validFixture)]) {
    assert.deepEqual(
      experienceContent(resume, { highlights: 'all' }).map((role) => role.highlights),
      resume.work.map((job) => job.highlights.map((h) => h.text)),
    );
  }
});

test("experienceContent's default is what the homepage gets: featured only, and only highlights differ from 'all'", () => {
  for (const resume of [getResume(), getResume(validFixture)]) {
    const homepage = experienceContent(resume);
    assert.deepEqual(experienceContent(resume, { highlights: 'featured' }), homepage);
    assert.deepEqual(experienceContent(resume, {}), homepage);
    const withoutHighlights = (roles: ReturnType<typeof experienceContent>) =>
      roles.map((role) => ({ ...role, highlights: [] }));
    assert.deepEqual(withoutHighlights(experienceContent(resume, { highlights: 'all' })), withoutHighlights(homepage));
  }
});

test('the real resume has 3–4 featured highlights (design-doc §5.1)', () => {
  const count = experienceContent(getResume()).reduce((sum, role) => sum + role.highlights.length, 0);
  assert.ok(
    count >= 3 && count <= 4,
    `design-doc §5.1: the homepage shows 3–4 featured highlights, found ${count}. ` +
      'Adjust the featured flags in src/data/resume.yaml.',
  );
});

// --- the built section (dist/index.html) ---

test('the Experience section is in the built homepage, with id="experience" and an <h2>', { skip }, () => {
  assert.ok(section, 'no <section data-experience> in dist/index.html');
  assert.equal(attr(section.match(/<section\b[^>]*>/)![0], 'id'), 'experience');
  const h2 = section.match(/<h2\b[^>]*>([\s\S]*?)<\/h2>/);
  assert.ok(h2, 'no <h2> in the Experience section');
  assert.equal(textOf(h2[1]), 'Experience');
});

test('every featured highlight is shown and no other highlight appears on the page', { skip }, () => {
  const sectionText = textOf(section);
  const pageText = textOf(html);
  for (const job of getResume().work) {
    for (const { text, featured } of job.highlights) {
      if (featured) assert.ok(sectionText.includes(text), `featured highlight missing: "${text.slice(0, 50)}…"`);
      else assert.ok(!pageText.includes(text), `non-featured highlight on the page: "${text.slice(0, 50)}…"`);
    }
  }
});

test('each role shows its company, position and dates as in the PDF, with <time datetime>', { skip }, () => {
  const roles = roleItems(section);
  const work = getResume().work;
  assert.equal(roles.length, work.length);
  work.forEach((job, i) => {
    const role = roles[i];
    assert.equal(textOf(element(role, 'data-role-company')), job.company);
    assert.equal(textOf(element(role, 'data-role-position')), job.position);
    const dates = element(role, 'data-role-dates');
    assert.equal(textOf(dates), pdfFormat.dateRange(job));
    const times = [...dates.matchAll(/<time\b[^>]*>/g)].map(([t]) => attr(t, 'datetime'));
    assert.deepEqual(times, job.endDate ? [job.startDate, job.endDate] : [job.startDate]);
  });
});

test('the full-resume link points to /resume', { skip }, () => {
  const link = section.match(/<a\b[^>]*\sdata-full-resume\b[^>]*>[\s\S]*?<\/a>/)?.[0];
  assert.ok(link, 'no full-resume link');
  assert.equal(attr(link, 'href'), '/resume');
  assert.match(textOf(link), /^View full resume/);
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
