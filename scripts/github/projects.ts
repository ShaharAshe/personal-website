// Turns the GitHub REST API's repo list into the data in src/data/projects.json (design-doc §6,
// .claude/rules/github-projects.md). Pure filter/sort/map logic plus a small API client with an
// injectable fetch, so tests run against fixtures with no network. The CLI is fetch-projects.ts.

import fs from 'node:fs';
import yaml from 'js-yaml';
import { z } from 'astro/zod';
import { RESUME_YAML } from '../cv/paths.js';
import type { PracticeLink, Project, ProjectsData } from '../../src/lib/projects.ts';

export const DEFAULT_API_URL = 'https://api.github.com';

export class GitHubProfileError extends Error {}

// "https://github.com/ShaharAshe", with or without www or a trailing slash -> "ShaharAshe".
export function githubUserFromUrl(url: string): string {
  const invalid = () =>
    new GitHubProfileError(`GitHub profile URL is not a profile like https://github.com/<username>: ${url}`);
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw invalid();
  }
  const segments = parsed.pathname.split('/').filter(Boolean);
  const user = segments[0];
  if (
    !['http:', 'https:'].includes(parsed.protocol) ||
    !['github.com', 'www.github.com'].includes(parsed.hostname) ||
    segments.length !== 1 ||
    parsed.search ||
    parsed.hash ||
    // GitHub usernames: alphanumerics and single hyphens, no leading/trailing hyphen, max 39.
    !/^[A-Za-z0-9](?:-?[A-Za-z0-9]){0,38}$/.test(user)
  ) {
    throw invalid();
  }
  return user;
}

// Only the part of resume.yaml read here; the full schema check is validate-resume.ts's job.
const resumeProfilesSchema = z.object({
  basics: z.object({ profiles: z.array(z.object({ network: z.string(), url: z.string() })) }),
});

// The GitHub username from basics.profiles (network: GitHub), so resume.yaml stays the single
// source of truth for it.
export function githubUserFromResume(resume: unknown, source = 'resume.yaml'): string {
  const result = resumeProfilesSchema.safeParse(resume);
  if (!result.success) {
    throw new GitHubProfileError(`${source} has no basics.profiles list to read the GitHub profile from.`);
  }
  const github = result.data.basics.profiles.find((profile) => profile.network.toLowerCase() === 'github');
  if (!github) {
    throw new GitHubProfileError(`${source} has no GitHub profile. Add one under basics.profiles (network: GitHub).`);
  }
  try {
    return githubUserFromUrl(github.url);
  } catch (error) {
    throw new GitHubProfileError(`${source}: ${error instanceof Error ? error.message : error}`);
  }
}

export function readGitHubUser(resumePath: string = RESUME_YAML): string {
  let resume: unknown;
  try {
    resume = yaml.load(fs.readFileSync(resumePath, 'utf8'));
  } catch (error) {
    throw new GitHubProfileError(`Could not read ${resumePath}:\n${error instanceof Error ? error.message : error}`);
  }
  return githubUserFromResume(resume, resumePath);
}

export type Tier = 'featured' | 'portfolio' | 'practice';

// Highest tier first: a repo tagged with more than one goes to the highest.
const TIER_TOPICS: [Tier, string][] = [
  ['featured', 'portfolio-featured'],
  ['portfolio', 'portfolio'],
  ['practice', 'portfolio-practice'],
];

// The subset of GitHub's repository object we read. Unknown fields are dropped; a missing or
// mistyped field fails loudly instead of producing a broken card.
const repoSchema = z.object({
  name: z.string(),
  full_name: z.string(),
  description: z.string().nullable(),
  html_url: z.url(),
  homepage: z.string().nullable(),
  topics: z.array(z.string()).default([]),
  stargazers_count: z.number(),
  pushed_at: z.string().nullable(),
  fork: z.boolean(),
  archived: z.boolean(),
  private: z.boolean(),
});
const reposSchema = z.array(repoSchema);
const languagesSchema = z.record(z.string(), z.number());

export type GitHubRepo = z.infer<typeof repoSchema>;
export type Languages = z.infer<typeof languagesSchema>;

// The output types come from the projects.json schema in src/lib/projects.ts (the site's reader), so
// the writer and the reader can't drift apart.
export type { Project, PracticeLink, ProjectsData };

export type RepoGroups = Record<Tier, GitHubRepo[]>;

export class GitHubApiError extends Error {}

export class MissingDescriptionError extends Error {
  readonly repos: string[];
  constructor(repos: string[]) {
    super(
      `These portfolio repos have no GitHub description: ${repos.join(', ')}.\n` +
        'Add one in each repo\'s "About" settings on GitHub, or remove its portfolio topic.',
    );
    this.repos = repos;
  }
}

// "log-analytics-platform" -> "Log Analytics Platform", "LeetCode" stays "LeetCode".
export function prettifyName(name: string): string {
  return name
    .split(/[-_]+/)
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(' ');
}

export function tierOf(repo: GitHubRepo): Tier | null {
  return TIER_TOPICS.find(([, topic]) => repo.topics.includes(topic))?.[0] ?? null;
}

const pushedTime = (repo: GitHubRepo) => (repo.pushed_at ? Date.parse(repo.pushed_at) : -Infinity);

// Drops forks, archived, private and untagged repos; groups by tier; newest push first.
export function selectRepos(repos: GitHubRepo[]): RepoGroups {
  const groups: RepoGroups = { featured: [], portfolio: [], practice: [] };
  for (const repo of repos) {
    if (repo.fork || repo.archived || repo.private) continue;
    const tier = tierOf(repo);
    if (tier) groups[tier].push(repo);
  }
  for (const group of Object.values(groups)) group.sort((a, b) => pushedTime(b) - pushedTime(a));
  return groups;
}

export function findMissingDescriptions(groups: RepoGroups): string[] {
  return [...groups.featured, ...groups.portfolio].filter((repo) => !repo.description?.trim()).map((repo) => repo.name);
}

const isPortfolioTopic = (topic: string) => topic === 'portfolio' || topic.startsWith('portfolio-');

export function toProject(repo: GitHubRepo, languages: Languages): Project {
  return {
    name: repo.name,
    title: prettifyName(repo.name),
    description: repo.description?.trim() ?? '',
    url: repo.html_url,
    homepage: repo.homepage?.trim() || null,
    // Most-used language first, by bytes of code.
    languages: Object.entries(languages)
      .sort(([, a], [, b]) => b - a)
      .map(([language]) => language),
    topics: repo.topics.filter((topic) => !isPortfolioTopic(topic)),
    stars: repo.stargazers_count,
    pushedAt: repo.pushed_at,
  };
}

export function toPracticeLink(repo: GitHubRepo): PracticeLink {
  return {
    name: repo.name,
    title: prettifyName(repo.name),
    description: repo.description?.trim() || null,
    url: repo.html_url,
    pushedAt: repo.pushed_at,
  };
}

export interface ClientOptions {
  token?: string;
  apiUrl?: string;
  fetchImpl?: typeof fetch;
}

async function getJson(url: string, { token, fetchImpl = fetch }: ClientOptions) {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'portfolio-site-build',
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  let response: Response;
  try {
    response = await fetchImpl(url, { headers });
  } catch (error) {
    throw new GitHubApiError(`GitHub API request failed: ${url}\n${error instanceof Error ? error.message : error}`);
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    let hint = '';
    if ((response.status === 403 || response.status === 429) && response.headers.get('x-ratelimit-remaining') === '0') {
      hint = token
        ? '\nGitHub API rate limit exceeded.'
        : '\nGitHub API rate limit exceeded. Set GITHUB_TOKEN to raise the limit.';
    } else if (response.status === 401) {
      hint = '\nGITHUB_TOKEN was rejected. Check that it is valid.';
    }
    throw new GitHubApiError(`GitHub API returned ${response.status} for ${url}${hint}\n${body.slice(0, 500)}`);
  }

  // Link: <https://api.github.com/...&page=2>; rel="next", <...>; rel="last"
  const next = response.headers.get('link')?.match(/<([^>]+)>;\s*rel="next"/)?.[1] ?? null;
  return { data: (await response.json()) as unknown, next };
}

function parse<T>(schema: z.ZodType<T>, data: unknown, url: string): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new GitHubApiError(`Unexpected GitHub API response from ${url}:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}

// All public repos owned by `user`, following pagination.
export async function listRepos(user: string, options: ClientOptions = {}): Promise<GitHubRepo[]> {
  const apiUrl = options.apiUrl ?? DEFAULT_API_URL;
  const repos: GitHubRepo[] = [];
  let url: string | null = `${apiUrl}/users/${encodeURIComponent(user)}/repos?type=owner&per_page=100`;
  while (url) {
    const page: Awaited<ReturnType<typeof getJson>> = await getJson(url, options);
    repos.push(...parse(reposSchema, page.data, url));
    url = page.next;
  }
  return repos;
}

export async function getLanguages(repo: GitHubRepo, options: ClientOptions = {}): Promise<Languages> {
  const url = `${options.apiUrl ?? DEFAULT_API_URL}/repos/${repo.full_name}/languages`;
  return parse(languagesSchema, (await getJson(url, options)).data, url);
}

// The whole fetch: list, filter, check descriptions (before any further requests), then fetch
// languages for the card tiers. Throws GitHubApiError or MissingDescriptionError.
export async function fetchProjects(user: string, options: ClientOptions = {}): Promise<ProjectsData> {
  const groups = selectRepos(await listRepos(user, options));

  const missing = findMissingDescriptions(groups);
  if (missing.length > 0) throw new MissingDescriptionError(missing);

  const withLanguages = (repos: GitHubRepo[]) =>
    Promise.all(repos.map(async (repo) => toProject(repo, await getLanguages(repo, options))));

  return {
    featured: await withLanguages(groups.featured),
    portfolio: await withLanguages(groups.portfolio),
    practice: groups.practice.map(toPracticeLink),
  };
}
