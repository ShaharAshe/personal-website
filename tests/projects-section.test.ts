// Tests for the homepage Projects section: the pure helpers in src/lib/projects-section.ts (made-up data,
// not the real projects.json) and the built section in dist/index.html (skipped without a build). Expected
// content in the built-HTML tests comes from getProjects(), never fixed names or counts. Repos that have a
// project page file (src/content/projects/) are exempt where the page can override the GitHub data, so
// adding a page in Task 3.1 needs no test change.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { getProjects, type PracticeLink, type Project, type ProjectsData } from '../src/lib/projects.ts';
import { listProjectPageFiles } from '../src/lib/project-pages-loader.ts';
import { getResume } from '../src/lib/resume.ts';
import {
  githubProfileUrl,
  projectCard,
  projectsSection,
  updatedLabel,
  type ProjectPageEntry,
} from '../src/lib/projects-section.ts';

const ROOT = path.join(import.meta.dirname, '..');

// --- made-up data ---

const project = (overrides: Partial<Project> = {}): Project => ({
  name: 'event-pipeline',
  title: 'Event Pipeline',
  description: 'A Kafka pipeline.',
  url: 'https://github.com/example/event-pipeline',
  homepage: null,
  languages: ['Java'],
  topics: ['kafka'],
  stars: 0,
  pushedAt: '2026-03-15T10:00:00Z',
  ...overrides,
});

const practice = (name: string, title: string): PracticeLink => ({
  name,
  title,
  description: null,
  url: `https://github.com/example/${name}`,
  pushedAt: '2026-01-01T00:00:00Z',
});

const data = (overrides: Partial<ProjectsData> = {}): ProjectsData => ({
  featured: [project({ name: 'alpha', title: 'Alpha', url: 'https://github.com/example/alpha' })],
  portfolio: [
    project({ name: 'beta', title: 'Beta', url: 'https://github.com/example/beta' }),
    project({ name: 'gamma', title: 'Gamma', url: 'https://github.com/example/gamma' }),
    project({ name: 'delta', title: 'Delta', url: 'https://github.com/example/delta' }),
  ],
  practice: [practice('kata', 'Kata'), practice('euler', 'Euler')],
  ...overrides,
});

// --- updatedLabel ---

test('updatedLabel: month and year text, and a YYYY-MM datetime', () => {
  assert.deepEqual(updatedLabel('2026-03-15T10:00:00Z'), { datetime: '2026-03', label: 'Mar 2026' });
  assert.deepEqual(updatedLabel('2025-11-01T00:00:00Z'), { datetime: '2025-11', label: 'Nov 2025' });
});

test('updatedLabel: uses UTC at a month boundary, whatever the local time zone', () => {
  assert.deepEqual(updatedLabel('2026-01-31T23:59:59Z'), { datetime: '2026-01', label: 'Jan 2026' });
  assert.deepEqual(updatedLabel('2026-02-01T00:00:00Z'), { datetime: '2026-02', label: 'Feb 2026' });
});

test('updatedLabel: null (or unparseable) gives no label', () => {
  assert.equal(updatedLabel(null), null);
  assert.equal(updatedLabel('not a date'), null);
});

// --- projectCard ---

test('projectCard: GitHub fields, the repo link, and accessible names that include the title', () => {
  const card = projectCard(project());
  assert.equal(card.name, 'event-pipeline');
  assert.equal(card.title, 'Event Pipeline');
  assert.equal(card.description, 'A Kafka pipeline.');
  assert.equal(card.status, null);
  assert.equal(card.team, null);
  assert.deepEqual(card.languages, ['Java']);
  assert.deepEqual(card.topics, ['kafka']);
  assert.deepEqual(card.updated, { datetime: '2026-03', label: 'Mar 2026' });
  assert.deepEqual(card.repo, { href: 'https://github.com/example/event-pipeline', label: 'Event Pipeline on GitHub' });
  assert.equal(card.page, null, 'no project page → no /projects/ link');
});

test('projectCard: stars hidden at 0, shown above 0 with a spoken label', () => {
  assert.equal(projectCard(project({ stars: 0 })).stars, null);
  assert.deepEqual(projectCard(project({ stars: 1 })).stars, { count: 1, label: '1 star' });
  assert.deepEqual(projectCard(project({ stars: 2 })).stars, { count: 2, label: '2 stars' });
});

test('projectCard: "Live demo" only with an http(s) homepage', () => {
  assert.deepEqual(projectCard(project({ homepage: 'https://example.github.io/event-pipeline/' })).demo, {
    href: 'https://example.github.io/event-pipeline/',
    label: 'Live demo of Event Pipeline',
  });
  assert.equal(projectCard(project({ homepage: 'http://demo.example.com' })).demo?.href, 'http://demo.example.com');
  for (const homepage of [null, '', 'javascript:alert(1)', 'not a url', 'ftp://example.com']) {
    assert.equal(projectCard(project({ homepage })).demo, null, String(homepage));
  }
});

test('projectCard: topics that only repeat a language are dropped (case-insensitive), others kept in order', () => {
  const card = projectCard(project({ languages: ['Java', 'HTML'], topics: ['docker', 'java', 'html', 'spring-boot'] }));
  assert.deepEqual(card.topics, ['docker', 'spring-boot']);
  assert.deepEqual(card.languages, ['Java', 'HTML']);
});

test('projectCard: a project page overrides title/description, adds status/team and a /projects/ link', () => {
  const page: ProjectPageEntry = {
    id: 'event-pipeline',
    data: { title: 'Event Pipeline (Kafka)', description: 'Longer text.', status: 'In progress', team: '2 developers' },
  };
  const card = projectCard(project(), page);
  assert.equal(card.title, 'Event Pipeline (Kafka)');
  assert.equal(card.description, 'Longer text.');
  assert.equal(card.status, 'In progress');
  assert.equal(card.team, '2 developers');
  assert.deepEqual(card.page, { href: '/projects/event-pipeline', label: 'Read more about Event Pipeline (Kafka)' });
  assert.equal(card.repo.label, 'Event Pipeline (Kafka) on GitHub');
  assert.equal(
    projectCard(project({ homepage: 'https://x.example' }), page).demo?.label,
    'Live demo of Event Pipeline (Kafka)',
  );
  // The GitHub data the page doesn't override stays.
  assert.equal(card.repo.href, 'https://github.com/example/event-pipeline');
  assert.deepEqual(card.languages, ['Java']);
});

test('projectCard: a page with no frontmatter keeps the GitHub fields and only adds the link', () => {
  const card = projectCard(project(), { id: 'event-pipeline', data: {} });
  assert.equal(card.title, 'Event Pipeline');
  assert.equal(card.description, 'A Kafka pipeline.');
  assert.equal(card.status, null);
  assert.equal(card.team, null);
  assert.equal(card.page?.href, '/projects/event-pipeline');
});

// --- projectsSection ---

test('projectsSection: tiers come back in the given order', () => {
  const section = projectsSection(data(), []);
  assert.deepEqual(
    section.featured.map((c) => c.name),
    ['alpha'],
  );
  assert.deepEqual(
    section.portfolio.map((c) => c.name),
    ['beta', 'gamma', 'delta'],
  );
  assert.deepEqual(section.practice, [
    { name: 'kata', title: 'Kata', href: 'https://github.com/example/kata', label: 'Kata on GitHub' },
    { name: 'euler', title: 'Euler', href: 'https://github.com/example/euler', label: 'Euler on GitHub' },
  ]);
  assert.equal(section.isEmpty, false);
});

test('projectsSection: an empty tier is an empty list; isEmpty only when all three are empty', () => {
  for (const tier of ['featured', 'portfolio', 'practice'] as const) {
    const section = projectsSection(data({ [tier]: [] }), []);
    assert.deepEqual(section[tier], [], tier);
    assert.equal(section.isEmpty, false, tier);
  }
  assert.equal(projectsSection({ featured: [], portfolio: [], practice: [] }, []).isEmpty, true);
});

test('projectsSection: pages match repos by name ignoring case; repos without a page get no link', () => {
  const projects = data({
    portfolio: [project({ name: 'Crypto_Modules', title: 'Crypto Modules' }), project({ name: 'beta', title: 'Beta' })],
  });
  const pages: ProjectPageEntry[] = [
    { id: 'crypto_modules', data: { team: '2 developers' } },
    { id: 'alpha', data: { status: 'In progress' } },
    { id: 'orphan-page', data: {} },
  ];
  const section = projectsSection(projects, pages);
  assert.equal(section.featured[0].page?.href, '/projects/alpha');
  assert.equal(section.featured[0].status, 'In progress');
  assert.equal(section.portfolio[0].page?.href, '/projects/crypto_modules');
  assert.equal(section.portfolio[0].team, '2 developers');
  assert.equal(section.portfolio[1].page, null);
});

test('projectsSection: pages do not apply to practice links', () => {
  const section = projectsSection(data(), [{ id: 'kata', data: { title: 'Other' } }]);
  assert.deepEqual(section.practice[0], {
    name: 'kata',
    title: 'Kata',
    href: 'https://github.com/example/kata',
    label: 'Kata on GitHub',
  });
});

test('githubProfileUrl: the GitHub profile (case-insensitive), or null', () => {
  const profiles = [
    { network: 'LinkedIn', url: 'https://www.linkedin.com/in/example' },
    { network: 'GitHub', url: 'https://github.com/example' },
  ];
  assert.equal(githubProfileUrl(profiles), 'https://github.com/example');
  assert.equal(githubProfileUrl([{ network: ' github ', url: 'https://github.com/x' }]), 'https://github.com/x');
  assert.equal(githubProfileUrl(profiles.slice(0, 1)), null);
});

// --- the built section (dist/index.html) ---

const htmlPath = path.join(ROOT, 'dist', 'index.html');
const skip = fs.existsSync(htmlPath) ? false : 'no dist/index.html: run npm run build first';
const html = skip ? '' : fs.readFileSync(htmlPath, 'utf8');
const section = html.match(/<section\b[^>]*\bdata-projects\b[^>]*>[\s\S]*?<\/section>/)?.[0] ?? '';

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
const cards = (fragment: string) =>
  [...fragment.matchAll(/<article\b[^>]*\sdata-project-card="(featured|portfolio)"[^>]*>[\s\S]*?<\/article>/g)].map(
    ([block, tier]) => ({ block, tier, name: attr(block.match(/<article\b[^>]*>/)![0], 'data-project-name') }),
  );
const links = (fragment: string) => [...fragment.matchAll(/<a\b[^>]*>/g)].map(([tag]) => tag);

// Repo names that have a project page file; their title/description may be overridden by it.
const pageNames = new Set(
  listProjectPageFiles(path.join(ROOT, 'src', 'content', 'projects')).map((file) =>
    path.basename(file, path.extname(file)).toLowerCase(),
  ),
);
const hasPage = (name: string) => pageNames.has(name.toLowerCase());

test('the Projects section is in the built homepage, with id="projects" and a labelled <h2>', { skip }, () => {
  assert.ok(section, 'no <section data-projects> in dist/index.html');
  const open = section.match(/<section\b[^>]*>/)![0];
  assert.equal(attr(open, 'id'), 'projects');
  const h2 = section.match(/<h2\b[^>]*>([\s\S]*?)<\/h2>/);
  assert.ok(h2, 'no <h2> in the Projects section');
  assert.equal(textOf(h2[1]), 'Projects');
  assert.equal(attr(open, 'aria-labelledby'), attr(h2[0], 'id'));
});

test('the section sits between Experience and Skills', { skip }, () => {
  const at = (id: string) => html.search(new RegExp(`<section\\b[^>]*\\sid="${id}"`));
  assert.ok(at('experience') >= 0 && at('projects') >= 0 && at('skills') >= 0);
  assert.ok(at('experience') < at('projects') && at('projects') < at('skills'));
});

test(
  'every featured and portfolio repo is a card, in order, with its title, description and repo link',
  { skip },
  () => {
    const data = getProjects();
    const shown = cards(section);
    const expected = [
      ...data.featured.map((p) => ({ tier: 'featured', project: p })),
      ...data.portfolio.map((p) => ({ tier: 'portfolio', project: p })),
    ];
    assert.deepEqual(
      shown.map(({ tier, name }) => ({ tier, name })),
      expected.map(({ tier, project }) => ({ tier, name: project.name })),
    );
    shown.forEach(({ block, tier }, i) => {
      const p = expected[i].project;
      const heading = block.match(tier === 'featured' ? /<h3\b[^>]*>([\s\S]*?)<\/h3>/ : /<h4\b[^>]*>([\s\S]*?)<\/h4>/);
      assert.ok(heading, `${p.name}: no ${tier === 'featured' ? '<h3>' : '<h4>'} title`);
      if (!hasPage(p.name)) {
        assert.equal(textOf(heading[1]), p.title, `${p.name}: title`);
        const description = block.match(/<p\b[^>]*\sdata-project-description\b[^>]*>([\s\S]*?)<\/p>/);
        assert.equal(textOf(description?.[1] ?? ''), p.description, `${p.name}: description`);
      }
      const repo = links(block).filter((tag) => /\sdata-project-repo\b/.test(tag));
      assert.equal(repo.length, 1, `${p.name}: repo links`);
      assert.equal(attr(repo[0], 'href'), p.url, `${p.name}: repo href`);
      const demo = links(block).filter((tag) => /\sdata-project-demo\b/.test(tag));
      assert.equal(demo.length, p.homepage ? 1 : 0, `${p.name}: Live demo only with a homepage`);
      if (p.homepage) assert.equal(attr(demo[0], 'href'), p.homepage);
      assert.equal(/\sdata-project-stars\b/.test(block), p.stars > 0, `${p.name}: stars only above 0`);
    });
  },
);

test('each language and each topic is its own list item, in its own role="list" <ul>, in order', { skip }, () => {
  const data = getProjects();
  const expected = new Map([...data.featured, ...data.portfolio].map((p) => [p.name, projectCard(p)]));
  const items = (list: string | undefined, kind: string) =>
    [...(list ?? '').matchAll(new RegExp(`<li\\b[^>]*\\sdata-project-${kind}\\b[^>]*>([\\s\\S]*?)<\\/li>`, 'g'))].map(
      ([, text]) => textOf(text),
    );
  for (const { block, name } of cards(section)) {
    const card = expected.get(name!)!;
    for (const [kind, label, values] of [
      ['language', 'Languages', card.languages],
      ['topic', 'Topics', card.topics],
    ] as const) {
      const list = block.match(new RegExp(`<ul\\b[^>]*\\saria-label="${label}"[^>]*>[\\s\\S]*?<\\/ul>`))?.[0];
      if (values.length === 0) {
        assert.equal(list, undefined, `${name}: empty ${label} list rendered`);
        continue;
      }
      assert.ok(list, `${name}: no ${label} list`);
      assert.match(list.match(/<ul\b[^>]*>/)![0], /\srole="list"/, `${name}: ${label} <ul> has no role="list"`);
      assert.deepEqual(items(list, kind), [...values], `${name}: ${label}`);
    }
    // Every <li> inside the card is a language or topic chip: no topic outside its own item.
    const allItems = [...block.matchAll(/<li\b[^>]*>/g)].length;
    assert.equal(allItems, card.languages.length + card.topics.length, `${name}: list item count`);
  }
});

test('card links are accent text links, not outline chips; icons and arrows are aria-hidden', { skip }, () => {
  const classes = (tag: string) => (attr(tag, 'class') ?? '').split(/\s+/);
  for (const { block, name } of cards(section)) {
    const anchors = [...block.matchAll(/<a\b[^>]*>[\s\S]*?<\/a>/g)].map(([a]) => a);
    assert.ok(anchors.length > 0, `${name}: no links`);
    for (const anchor of anchors) {
      const cls = classes(anchor.match(/<a\b[^>]*>/)![0]);
      assert.ok(cls.includes('text-accent'), `${name}: link without text-accent`);
      for (const chip of ['border', 'border-border', 'rounded-md'])
        assert.ok(!cls.includes(chip), `${name}: link has chip class ${chip}`);
      assert.ok(!cls.some((c) => c.startsWith('bg-')), `${name}: link has a fill`);
    }
    // Chips are never accent.
    for (const [li] of block.matchAll(/<li\b[^>]*>/g)) {
      assert.ok(!classes(li).some((c) => c.includes('accent')), `${name}: accent on a chip`);
    }
    const repo = anchors.find((a) => /\sdata-project-repo\b/.test(a))!;
    assert.match(repo, /<svg\b[^>]*aria-hidden="true"[^>]*data-icon="github"/, `${name}: GitHub icon`);
    const demo = anchors.find((a) => /\sdata-project-demo\b/.test(a));
    if (demo) assert.match(demo, /<span aria-hidden="true">↗<\/span>/, `${name}: Live demo arrow`);
    const page = anchors.find((a) => /\sdata-project-page\b/.test(a));
    if (page) assert.match(page, /<span aria-hidden="true">→<\/span>/, `${name}: Read more arrow`);
  }
});

test('the GitHub icon path lives in one source file; the icon appears only where ui.md allows', { skip }, () => {
  const GITHUB_PATH = 'M12 .297c-6.63 0-12 5.373-12 12';
  const srcDir = path.join(ROOT, 'src');
  const files = fs
    .readdirSync(srcDir, { recursive: true, encoding: 'utf8' })
    .map((file) => path.join(srcDir, file))
    .filter((file) => fs.statSync(file).isFile() && !file.endsWith('.json'));
  const withPath = files.filter((file) => fs.readFileSync(file, 'utf8').includes(GITHUB_PATH));
  assert.deepEqual(
    withPath.map((file) => path.relative(ROOT, file).replaceAll('\\', '/')),
    ['src/components/GitHubIcon.astro'],
  );
  const hero = html.match(/<section\b[^>]*\bdata-hero\b[^>]*>[\s\S]*?<\/section>/)?.[0] ?? '';
  assert.match(hero, /data-icon="github"/, 'Hero does not use GitHubIcon');
  // Only on links whose text is "GitHub" (one per card), the Hero's GitHub profile link, and the all-empty
  // fallback link when it renders (ui.md "Link markers"); never repeated on every practice link.
  const heroGitHub = getResume().basics.profiles.filter(({ network }) => network.trim().toLowerCase() === 'github');
  const fallback = /\sdata-projects-empty\b/.test(section) && /<p\b[^>]*data-projects-empty[^>]*>\s*<a\b/.test(section);
  assert.equal([...hero.matchAll(/data-icon="github"/g)].length, heroGitHub.length, 'Hero GitHub icons');
  assert.equal(
    [...section.matchAll(/data-icon="github"/g)].length,
    cards(section).length + (fallback ? 1 : 0),
    'one GitHub icon per card GitHub link (plus the fallback link)',
  );
  // Plus the Contact section's "GitHub" link (Task 2.9).
  const contact = html.match(/<section\b[^>]*\bdata-contact\b[^>]*>[\s\S]*?<\/section>/)?.[0] ?? '';
  assert.equal([...contact.matchAll(/data-icon="github"/g)].length, 1, 'Contact GitHub link icon');
  assert.equal(
    [...html.matchAll(/data-icon="github"/g)].length,
    heroGitHub.length + cards(section).length + (fallback ? 1 : 0) + 1,
    'GitHub icons on the whole page',
  );
});

test('practice links: accent text links ending in an aria-hidden ↗, no GitHub icon, 40px tall', { skip }, () => {
  const anchors = [...section.matchAll(/<a\b[^>]*\sdata-practice-link=[^>]*>[\s\S]*?<\/a>/g)].map(([a]) => a);
  const practice = getProjects().practice;
  assert.equal(anchors.length, practice.length);
  anchors.forEach((anchor, i) => {
    const { title } = practice[i];
    assert.doesNotMatch(anchor, /<svg\b|data-icon=/, `${title}: has an icon`);
    assert.match(anchor, /<span aria-hidden="true">↗<\/span>\s*<\/a>$/, `${title}: no trailing aria-hidden ↗`);
    assert.equal(textOf(anchor), `${title} ↗`, `${title}: visible text`);
    const cls = (attr(anchor.match(/<a\b[^>]*>/)![0], 'class') ?? '').split(/\s+/);
    assert.ok(cls.includes('text-accent') && cls.includes('min-h-10'), `${title}: accent text link, 40px tall`);
  });
});

test(
  'the practice group says once that the links go to GitHub: a muted, plain "Solutions on GitHub" line',
  { skip },
  () => {
    const tier = section.match(/<div\b[^>]*data-project-tier="practice"[^>]*>[\s\S]*?<\/ul>/)?.[0];
    if (getProjects().practice.length === 0) return assert.equal(tier, undefined);
    assert.ok(tier, 'no practice tier');
    const note = tier.match(/<h3\b[\s\S]*?<\/h3>\s*(<p\b[^>]*>)([\s\S]*?)<\/p>/);
    assert.ok(note, 'no line right under the "Algorithm practice" heading');
    assert.equal(textOf(note[2]), 'Solutions on GitHub');
    assert.doesNotMatch(note[2], /<(a|svg)\b/, 'the line is not a link and has no icon');
    const cls = (attr(note[1], 'class') ?? '').split(/\s+/);
    assert.ok(cls.includes('text-sm') && cls.includes('text-text-muted'), 'text-sm text-text-muted');
  },
);

test('every practice repo is a link to its repo, in order', { skip }, () => {
  const shown = links(section)
    .filter((tag) => /\sdata-practice-link=/.test(tag))
    .map((tag) => ({ name: attr(tag, 'data-practice-link'), href: attr(tag, 'href'), label: attr(tag, 'aria-label') }));
  assert.deepEqual(
    shown,
    getProjects().practice.map((p) => ({ name: p.name, href: p.url, label: `${p.title} on GitHub` })),
  );
});

test('every link names its project in its accessible name, and opens in the same tab', { skip }, () => {
  const data = getProjects();
  const titleOf = new Map([...data.featured, ...data.portfolio, ...data.practice].map((p) => [p.name, p.title]));
  for (const { block, name } of cards(section)) {
    const heading = textOf(block.match(/<h[34]\b[^>]*>([\s\S]*?)<\/h[34]>/)![1]);
    const cardLinks = links(block);
    assert.ok(cardLinks.length > 0, `${name}: no links`);
    for (const tag of cardLinks) {
      const label = attr(tag, 'aria-label') ?? '';
      assert.ok(label.includes(heading), `${name}: "${label}" does not include "${heading}"`);
      if (!hasPage(name!)) assert.ok(label.includes(titleOf.get(name!)!), `${name}: label`);
    }
  }
  for (const tag of links(section)) assert.doesNotMatch(tag, /\starget=/);
});

test('no nested links, and cards are not links themselves', { skip }, () => {
  for (const { block } of cards(section)) {
    for (const [anchor] of block.matchAll(/<a\b[^>]*>[\s\S]*?<\/a>/g)) {
      assert.equal([...anchor.matchAll(/<a\b/g)].length, 1, 'nested <a>');
    }
  }
  assert.doesNotMatch(section, /<a\b[^>]*>\s*<article\b/);
});

test('last update is month and year in <time datetime="YYYY-MM">, never relative text', { skip }, () => {
  const times = [...section.matchAll(/<time\b[^>]*>([\s\S]*?)<\/time>/g)];
  const dated = [...getProjects().featured, ...getProjects().portfolio].filter((p) => p.pushedAt);
  assert.equal(times.length, dated.length);
  times.forEach(([tag, text], i) => {
    const expected = updatedLabel(dated[i].pushedAt)!;
    assert.equal(attr(tag, 'datetime'), expected.datetime);
    assert.match(attr(tag, 'datetime')!, /^\d{4}-\d{2}$/);
    assert.equal(textOf(text), expected.label);
  });
  assert.doesNotMatch(textOf(section), /\b(ago|yesterday|today|just now|last (week|month|year))\b/i);
});

test(
  'with no project page files, no card links to /projects/',
  { skip: skip || (pageNames.size > 0 && 'project pages exist') },
  () => {
    assert.doesNotMatch(section, /href="\/projects\//);
  },
);

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
