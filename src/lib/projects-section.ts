// Content for the homepage Projects section (src/components/Projects.astro, ProjectCard.astro), built from
// the validated projects.json (src/lib/projects.ts) and the `projects` content collection, so components
// hold no project text. Pure: no Astro imports, so node:test can test it.
//
// Tiers per .claude/rules/github-projects.md, each in projects.json order (pushed_at, newest first).
// A project page (src/content/projects/<repo-name>.md(x), design-doc §6.4) is matched to its repo by name,
// ignoring case: Astro's glob loader lowercases entry ids. Its frontmatter overrides title/description and
// adds status/team, and the card gets a "Read more" link to /projects/<entry id>.

import type { ProjectPage } from '../data/project-page.schema.ts';
import type { PracticeLink, Project, ProjectsData } from './projects.ts';
import { formatDate } from './resume-dates.ts';

// The shape of a getCollection('projects') entry that the section needs.
export interface ProjectPageEntry {
  id: string;
  data: ProjectPage;
}

export interface LinkView {
  href: string;
  // Accessible name: always names the project and contains the link's visible text.
  label: string;
}

export interface UpdatedView {
  // "YYYY-MM", a valid <time datetime> value.
  datetime: string;
  // "Nov 2026". Month and year, never relative text: the site is static.
  label: string;
}

export interface ProjectCardView {
  name: string;
  title: string;
  description: string;
  status: string | null;
  team: string | null;
  languages: string[];
  topics: string[];
  // null when 0 (stars are shown only above 0).
  stars: { count: number; label: string } | null;
  updated: UpdatedView | null;
  repo: LinkView;
  demo: LinkView | null;
  page: LinkView | null;
}

export interface PracticeLinkView {
  name: string;
  title: string;
  href: string;
  label: string;
}

export interface ProjectsSectionView {
  featured: ProjectCardView[];
  portfolio: ProjectCardView[];
  practice: PracticeLinkView[];
  isEmpty: boolean;
}

// pushed_at → month and year, in UTC (the build machine's time zone must not matter).
export function updatedLabel(pushedAt: string | null): UpdatedView | null {
  if (!pushedAt) return null;
  const date = new Date(pushedAt);
  if (Number.isNaN(date.getTime())) return null;
  const datetime = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
  return { datetime, label: formatDate(datetime) };
}

// Only an absolute http(s) URL becomes a "Live demo" link.
function demoUrl(homepage: string | null): string | null {
  if (!homepage) return null;
  try {
    const url = new URL(homepage);
    return url.protocol === 'http:' || url.protocol === 'https:' ? homepage : null;
  } catch {
    return null;
  }
}

const repoLabel = (title: string) => `${title} on GitHub`;

export function projectCard(project: Project, page?: ProjectPageEntry): ProjectCardView {
  const title = page?.data.title ?? project.title;
  const languages = new Set(project.languages.map((language) => language.toLowerCase()));
  const demo = demoUrl(project.homepage);
  return {
    name: project.name,
    title,
    description: page?.data.description ?? project.description,
    status: page?.data.status ?? null,
    team: page?.data.team ?? null,
    languages: [...project.languages],
    // A topic that only repeats a language (e.g. `java` next to Java) isn't shown twice.
    topics: project.topics.filter((topic) => !languages.has(topic.toLowerCase())),
    stars:
      project.stars > 0
        ? { count: project.stars, label: `${project.stars} star${project.stars === 1 ? '' : 's'}` }
        : null,
    updated: updatedLabel(project.pushedAt),
    repo: { href: project.url, label: repoLabel(title) },
    demo: demo ? { href: demo, label: `Live demo of ${title}` } : null,
    page: page ? { href: `/projects/${page.id}`, label: `Read more about ${title}` } : null,
  };
}

export function practiceLink(link: PracticeLink): PracticeLinkView {
  return { name: link.name, title: link.title, href: link.url, label: repoLabel(link.title) };
}

// The GitHub profile URL from resume.yaml's basics.profiles, for the line shown when every tier is empty.
export function githubProfileUrl(profiles: { network: string; url: string }[]): string | null {
  return profiles.find(({ network }) => network.trim().toLowerCase() === 'github')?.url ?? null;
}

export function projectsSection(data: ProjectsData, pages: ProjectPageEntry[]): ProjectsSectionView {
  const pageFor = (name: string) => pages.find((page) => page.id.toLowerCase() === name.toLowerCase());
  const card = (project: Project) => projectCard(project, pageFor(project.name));
  const featured = data.featured.map(card);
  const portfolio = data.portfolio.map(card);
  const practice = data.practice.map(practiceLink);
  return {
    featured,
    portfolio,
    practice,
    isEmpty: featured.length + portfolio.length + practice.length === 0,
  };
}
