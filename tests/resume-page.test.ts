// Tests for the /resume page: the pure helpers in src/lib/resume-page.ts, then the built page
// (dist/resume/index.html, skipped without a build). Expected values come from getResume(), so a resume edit
// needs no test change. Comparisons with the real email only ever report true/false, so a failure never prints it.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import * as pdfFormat from '../scripts/cv/format.js';
import { getEmailParts, getResume, type PublicResume } from '../src/lib/resume.ts';
import { dateRange } from '../src/lib/resume-dates.ts';
import { SPOKEN_LANGUAGES_LABEL, displayUrl, resumePageContent } from '../src/lib/resume-page.ts';
import { RESUME_PDF_FILENAME, RESUME_PDF_URL } from '../src/lib/resume-pdf.ts';

const ROOT = path.join(import.meta.dirname, '..');
const DIST = path.join(ROOT, 'dist');
const validFixture = path.join(ROOT, 'tests', 'fixtures', 'resume-valid.yaml');
const htmlPath = path.join(DIST, 'resume', 'index.html');
const homePath = path.join(DIST, 'index.html');
const skip = fs.existsSync(htmlPath) && fs.existsSync(homePath) ? false : 'no built /resume: run npm run build first';
const html = skip ? '' : fs.readFileSync(htmlPath, 'utf8');
const homeHtml = skip ? '' : fs.readFileSync(homePath, 'utf8');
const main = html.match(/<main\b[\s\S]*<\/main>/)?.[0] ?? '';

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
const elements = (fragment: string, dataAttr: string) =>
  // (?=[\s=>]): the whole attribute name, so data-skill doesn't also match data-skill-category.
  [...fragment.matchAll(new RegExp(`<([a-z0-9]+)\\b[^>]*\\s${dataAttr}(?=[\\s=>])[^>]*>([\\s\\S]*?)</\\1>`, 'g'))].map(
    (match) => match[2],
  );
const sectionById = (id: string) =>
  main.match(new RegExp(`<section\\b[^>]*\\sid="${id}"[\\s\\S]*?</section>`))?.[0] ?? '';
const resumeNavLink = (page: string) =>
  [...(page.match(/<nav\b[\s\S]*?<\/nav>/)?.[0] ?? '').matchAll(/<a\b[^>]*>/g)]
    .map(([tag]) => tag)
    .find((tag) => attr(tag, 'href') === '/resume') ?? '';

// --- the helpers ---

test('displayUrl gives the same text as the PDF (scripts/cv/format.js)', () => {
  const urls = [
    'https://www.linkedin.com/in/x',
    'http://example.com/',
    'https://github.com/ShaharAshe/log-analytics-platform',
    ...getResume().basics.profiles.map(({ url }) => url),
    ...getResume().projects.flatMap(({ url }) => (url ? [url] : [])),
  ];
  for (const url of urls) assert.equal(displayUrl(url), pdfFormat.displayUrl(url), url);
});

test('every highlight is in the page content, not only the featured ones', () => {
  const resume = getResume();
  assert.deepEqual(
    resumePageContent(resume).experience.map((role) => role.highlights),
    resume.work.map((job) => job.highlights.map((h) => h.text)),
  );
});

test('a project link says GitHub only for a GitHub URL, and a project without a URL has no link', () => {
  const resume = getResume(validFixture);
  const withProjects: PublicResume = {
    ...resume,
    projects: [
      { name: 'A', status: 'In Progress', description: 'First', url: 'https://github.com/x/a' },
      { name: 'B', description: 'Second', url: 'https://www.example.com/b/' },
      { name: 'C', description: 'Third' },
    ],
  };
  assert.deepEqual(resumePageContent(withProjects).projects, [
    {
      name: 'A',
      status: 'In Progress',
      description: 'First',
      link: { url: 'https://github.com/x/a', text: 'GitHub', icon: 'github' },
    },
    {
      name: 'B',
      status: null,
      description: 'Second',
      link: { url: 'https://www.example.com/b/', text: 'example.com/b', icon: 'external' },
    },
    { name: 'C', status: null, description: 'Third', link: null },
  ]);
});

test('the skills end with a spoken-languages row in the PDF format, and without languages there is no row', () => {
  const resume = getResume(validFixture);
  const withLanguages: PublicResume = {
    ...resume,
    languages: [
      { language: 'Klingon', fluency: 'Native' },
      { language: 'Esperanto', fluency: 'Fluent' },
    ],
  };
  assert.deepEqual(resumePageContent(withLanguages).skills.at(-1), {
    category: SPOKEN_LANGUAGES_LABEL,
    items: ['Klingon (Native)', 'Esperanto (Fluent)'],
  });
  for (const languages of [undefined, []]) {
    const { skills } = resumePageContent({ ...resume, languages });
    assert.deepEqual(
      skills.map(({ category }) => category),
      resume.skills.map(({ category }) => category),
    );
  }
});

test('education has its dates in the PDF format, and an entry without highlights gets an empty list', () => {
  const resume = getResume(validFixture);
  const education = [{ institution: 'Uni', degree: 'B.Sc.', startDate: '2021', endDate: '2024' }];
  assert.deepEqual(resumePageContent({ ...resume, education }).education, [
    {
      degree: 'B.Sc.',
      institution: 'Uni',
      dates: {
        start: { datetime: '2021', label: '2021' },
        end: { datetime: '2024', label: '2024' },
        text: pdfFormat.dateRange(education[0]),
      },
      highlights: [],
    },
  ]);
});

test('the title and description come from the resume data', () => {
  const resume = getResume(validFixture);
  const { name, label } = resume.basics;
  assert.deepEqual(resumePageContent(resume).meta, {
    title: `${name} – Resume`,
    description: `Resume of ${name}, ${label}.`,
  });
});

// --- the built page ---

test('/resume has one <h1> with the name, and the title and full summary', { skip }, () => {
  const { name, label, summary } = getResume().basics;
  const h1s = [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/g)];
  assert.equal(h1s.length, 1);
  assert.equal(textOf(h1s[0][1]), name);
  assert.equal(textOf(elements(main, 'data-resume-title')[0] ?? ''), label);
  assert.equal(textOf(elements(main, 'data-resume-summary')[0] ?? ''), summary.replace(/\s+/g, ' ').trim());
});

test('the <h2>s are the resume sections, in the same order as the PDF', { skip }, () => {
  const h2s = [...main.matchAll(/<h2\b[^>]*>([\s\S]*?)<\/h2>/g)].map(([, text]) => textOf(text));
  assert.deepEqual(h2s, ['Experience', 'Projects', 'Skills', 'Education']);
});

test('every work highlight is on the page, with position, company and PDF dates', { skip }, () => {
  const section = sectionById('experience');
  const { work } = getResume();
  assert.deepEqual(
    elements(section, 'data-entry-highlight').map(textOf),
    work.flatMap((job) => job.highlights.map((h) => h.text.replace(/\s+/g, ' ').trim())),
  );
  assert.deepEqual(
    elements(section, 'data-entry-title').map(textOf),
    work.map((job) => job.position),
  );
  assert.deepEqual(
    elements(section, 'data-entry-subtitle').map(textOf),
    work.map((job) => job.company),
  );
  assert.deepEqual(
    elements(section, 'data-entry-dates').map(textOf),
    work.map((job) => dateRange(job)),
  );
  assert.deepEqual(
    [...section.matchAll(/<time\b[^>]*>/g)].map(([tag]) => attr(tag, 'datetime')),
    work.flatMap((job) => (job.endDate ? [job.startDate, job.endDate] : [job.startDate])),
  );
});

test('every project is on the page, with its status, description and a GitHub link', { skip }, () => {
  const section = sectionById('projects');
  const { projects } = getResume();
  assert.deepEqual(
    elements(section, 'data-project-name').map(textOf),
    projects.map(({ name }) => name),
  );
  assert.deepEqual(
    elements(section, 'data-project-status').map(textOf),
    projects.flatMap(({ status }) => (status ? [`· ${status}`] : [])),
  );
  assert.deepEqual(
    elements(section, 'data-project-description').map(textOf),
    projects.map(({ description }) => description.replace(/\s+/g, ' ').trim()),
  );
  const links = [...section.matchAll(/<a\b[^>]*\sdata-project-link\b[^>]*>[\s\S]*?<\/a>/g)].map(([a]) => a);
  const urls = projects.flatMap(({ url }) => (url ? [url] : []));
  assert.deepEqual(
    links.map((a) => attr(a, 'href')),
    urls,
  );
  assert.deepEqual(
    links.map(textOf),
    urls.map(() => 'GitHub'),
  );
  for (const link of links) assert.match(link, /data-icon="github"/);
  for (const url of urls) assert.equal(new URL(url).hostname, 'github.com');
});

test('every skill and spoken language is on the page, spoken languages in the last row', { skip }, () => {
  const section = sectionById('skills');
  const { skills, languages } = getResume();
  assert.ok(languages && languages.length > 0, 'the real resume has spoken languages');
  assert.deepEqual(elements(section, 'data-skill-category-name').map(textOf), [
    ...skills.map(({ category }) => category),
    SPOKEN_LANGUAGES_LABEL,
  ]);
  assert.deepEqual(elements(section, 'data-skill').map(textOf), [
    ...skills.flatMap(({ items }) => items),
    ...languages.map(({ language, fluency }) => `${language} (${fluency})`),
  ]);
});

test('every education entry and highlight is on the page, with PDF dates', { skip }, () => {
  const section = sectionById('education');
  const { education } = getResume();
  assert.deepEqual(
    elements(section, 'data-entry-title').map(textOf),
    education.map((entry) => entry.degree),
  );
  assert.deepEqual(
    elements(section, 'data-entry-subtitle').map(textOf),
    education.map((entry) => entry.institution),
  );
  assert.deepEqual(
    elements(section, 'data-entry-dates').map(textOf),
    education.map((entry) => pdfFormat.dateRange(entry)),
  );
  assert.deepEqual(
    elements(section, 'data-entry-highlight').map(textOf),
    education.flatMap((entry) => (entry.highlights ?? []).map((text) => text.replace(/\s+/g, ' ').trim())),
  );
});

test('the profile links follow basics.profiles, with the shared icons', { skip }, () => {
  const links = [...main.matchAll(/<a\b[^>]*\sdata-resume-profile=[^>]*>[\s\S]*?<\/a>/g)].map(([a]) => a);
  const { profiles } = getResume().basics;
  assert.deepEqual(
    links.map((a) => ({ href: attr(a, 'href'), text: textOf(a) })),
    profiles.map(({ url, network }) => ({ href: url, text: network })),
  );
  for (const link of links) {
    const icon = attr(link.match(/<a\b[^>]*>/)![0], 'data-resume-profile');
    assert.match(link, new RegExp(`data-icon="${icon}"`));
  }
});

test('the header order is title, Download PDF, the contact line, then the summary', { skip }, () => {
  const at = ['<h1', 'data-resume-title', 'data-resume-download', 'data-resume-contact', 'data-resume-summary'].map(
    (marker) => main.indexOf(marker),
  );
  assert.ok(
    at.every((index) => index >= 0),
    'a header part is missing',
  );
  assert.deepEqual(
    at,
    [...at].sort((a, b) => a - b),
  );
});

test('the contact line has the email first, then the profiles, with aria-hidden separators', { skip }, () => {
  const line = main.match(/<ul\b[^>]*\sdata-resume-contact\b[\s\S]*?<\/ul>/)?.[0] ?? '';
  assert.ok(line.indexOf('data-copy-email') < line.indexOf('data-resume-profile='), 'the email is not first');
  const separators = [...line.matchAll(/<span\b[^>]*\sdata-resume-separator\b[^>]*>([\s\S]*?)<\/span>/g)];
  assert.equal(separators.length, getResume().basics.profiles.length);
  for (const [tag, text] of separators) {
    assert.equal(attr(tag.match(/<span\b[^>]*>/)![0], 'aria-hidden'), 'true');
    assert.equal(textOf(text), '·');
    assert.match(tag, /\btext-text-muted\b/);
  }
});

test('the address is the mail link, next to a small icon-only copy button', { skip }, () => {
  const link = main.match(/<a\b[^>]*\sdata-email-link\b[^>]*>[\s\S]*?<\/a>/)?.[0] ?? '';
  assert.match(link, /\sdata-email-address\b/, 'the address is not inside the mail link');
  assert.match(link, /data-icon="mail"/);
  assert.equal(attr(link.match(/<a\b[^>]*>/)![0], 'href'), undefined, 'the href is only set in the browser');

  const button = main.match(/<button\b[^>]*\sdata-email-copy\b[^>]*>[\s\S]*?<\/button>/)?.[0] ?? '';
  assert.ok(button, 'no copy button');
  const tag = button.match(/<button\b[^>]*>/)![0];
  assert.equal(attr(tag, 'type'), 'button');
  assert.equal(attr(tag, 'aria-label'), 'Copy email address');
  assert.match(button, /data-icon="copy"/);
  assert.match(button, /data-icon="check"/);
  assert.equal(textOf(button), 'Copied', 'the only text is the feedback');
  assert.match(main, /<p\b[^>]*\sdata-copy-status\b[^>]*role="status"/);
  assert.match(main, /<p\b[^>]*\sdata-copy-hint\b/);
});

test('/resume has no "Open in mail app" link', { skip }, () => {
  assert.ok(!textOf(main).includes('Open in mail app'));
  assert.equal([...main.matchAll(/\sdata-email-link\b/g)].length, 1);
});

test('the tagline and location, which the PDF does not print, are not on the page', { skip }, () => {
  const { tagline, location } = getResume().basics;
  const text = textOf(main);
  assert.ok(!text.includes(tagline.replace(/\s+/g, ' ').trim()), 'tagline on /resume');
  assert.ok(!text.includes(location), 'location on /resume');
});

test('Download PDF uses the shared URL and file name, and is the one accent-filled element in <main>', { skip }, () => {
  const link = main.match(/<a\b[^>]*\sdata-resume-download\b[^>]*>[\s\S]*?<\/a>/)?.[0] ?? '';
  assert.ok(link, 'no Download PDF link');
  assert.equal(attr(link, 'href'), RESUME_PDF_URL);
  assert.equal(attr(link, 'download'), RESUME_PDF_FILENAME);
  assert.equal(textOf(link), 'Download PDF');

  const filled = [...main.matchAll(/<[a-z]+\b[^>]*\sclass="([^"]*)"[^>]*>/g)].filter(([, cls]) =>
    cls.split(/\s+/).includes('bg-accent'),
  );
  assert.equal(filled.length, 1);
  assert.match(filled[0][0], /data-resume-download/);
});

test('the Back to home link is above the <h1> and goes to / (same text as the 404 page)', { skip }, () => {
  const home = main.match(/<p\b[^>]*\sdata-resume-home\b[^>]*>[\s\S]*?<\/p>/)?.[0] ?? '';
  const link = home.match(/<a\b[^>]*>[\s\S]*?<\/a>/)?.[0] ?? '';
  assert.equal(attr(link, 'href'), '/');
  assert.equal(textOf(link), '← Back to home');
  assert.match(link, /<span aria-hidden="true">←<\/span>/);
  assert.ok(main.indexOf('data-resume-home') < main.indexOf('<h1'));
  assert.ok(link.match(/<a\b[^>]*>/)![0].includes('text-accent'));
});

test(
  'the email parts are only CopyEmail attributes: no joined address and no mailto: (true/false only)',
  { skip },
  () => {
    const { user, domain } = getEmailParts();
    const tags = [...html.matchAll(/<[a-z]+\b[^>]*\sdata-email-user="[^"]*"[^>]*>/g)].map(([tag]) => tag);
    assert.ok(tags.length > 0, 'no email element on /resume');
    assert.equal(
      tags.every((tag) => attr(tag, 'data-email-user') === user && attr(tag, 'data-email-domain') === domain),
      true,
    );
    assert.equal(html.includes(`${user}@${domain}`), false);
    assert.doesNotMatch(html, /href\s*=\s*["']?mailto:/i);

    // Outside those attributes, neither part appears on its own.
    const rest = html.replace(/\sdata-email-(user|domain)="[^"]*"/g, '');
    assert.equal(rest.includes(`${user}@`), false);
    assert.equal(rest.includes(`@${domain}`), false);
  },
);

test('the page has its own <title> and meta description, different from the homepage', { skip }, () => {
  const headOf = (page: string) => ({
    title: decode(page.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? ''),
    description: attr(page.match(/<meta name="description"[^>]*>/)?.[0] ?? '', 'content'),
  });
  assert.deepEqual(headOf(html), resumePageContent(getResume()).meta);
  assert.notEqual(headOf(html).title, headOf(homeHtml).title);
  assert.notEqual(headOf(html).description, headOf(homeHtml).description);
});

test('the nav Resume link has aria-current="page" on /resume and no link has it on the homepage', { skip }, () => {
  assert.equal(attr(resumeNavLink(html), 'aria-current'), 'page');
  assert.equal([...html.matchAll(/\saria-current=/g)].length, 1, 'one current link on /resume');
  assert.equal(attr(resumeNavLink(homeHtml), 'aria-current'), undefined);
  assert.doesNotMatch(homeHtml, /\saria-current=/);
});

// --- JS ---

// JSON-LD (type="application/ld+json", homepage only) is data the browser never runs, so it isn't JS.
const scriptsOf = (page: string) =>
  [...page.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)]
    .filter(([, attrs]) => !attrs.includes('application/ld+json'))
    .map(([, attrs, text]) => {
      const src = attrs.match(/\bsrc="([^"]+)"/)?.[1];
      return src ? fs.readFileSync(path.join(DIST, src)).toString() : text;
    });

test('/resume JS stays under 30KB gzipped', { skip }, () => {
  const bytes = scriptsOf(html).reduce((sum, code) => sum + zlib.gzipSync(code).length, 0);
  console.log(`/resume JS: ${(bytes / 1024).toFixed(2)} KB gzipped`);
  assert.ok(bytes < 30 * 1024, `/resume JS is ${bytes} bytes gzipped`);
});

test('/resume ships no script the homepage does not also have (theme scripts and CopyEmail only)', { skip }, () => {
  const home = new Set(scriptsOf(homeHtml));
  const scripts = scriptsOf(html);
  assert.ok(scripts.length > 0);
  assert.equal(scripts.filter((code) => !home.has(code)).length, 0);
});
