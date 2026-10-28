// Tests for src/lib/projects.ts: the validated reader for the generated src/data/projects.json.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fetchProjects } from '../scripts/github/projects.ts';
import { PROJECTS_JSON, ProjectsDataError, getProjects, projectsDataSchema } from '../src/lib/projects.ts';

const githubFixtures = path.join(import.meta.dirname, 'fixtures', 'github');
const readFixture = (name: string): unknown => JSON.parse(fs.readFileSync(path.join(githubFixtures, name), 'utf8'));

const validData = {
  featured: [
    {
      name: 'event-pipeline',
      title: 'Event Pipeline',
      description: 'A Kafka pipeline.',
      url: 'https://github.com/someone/event-pipeline',
      homepage: null,
      languages: ['Java'],
      topics: ['kafka'],
      stars: 0,
      pushedAt: '2026-01-02T03:04:05Z',
    },
  ],
  portfolio: [],
  practice: [
    {
      name: 'project_euler',
      title: 'Project Euler',
      description: null,
      url: 'https://github.com/someone/project_euler',
      pushedAt: null,
    },
  ],
};

function tempJson(data: unknown) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'projects-data-test-'));
  test.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const file = path.join(dir, 'projects.json');
  fs.writeFileSync(file, typeof data === 'string' ? data : JSON.stringify(data));
  return file;
}

// The data with one change applied to the first featured project.
const withFeatured = (change: Record<string, unknown>) => ({
  ...validData,
  featured: [{ ...validData.featured[0], ...change }],
});

function assertShapeError(file: string, field: string) {
  assert.throws(
    () => getProjects(file),
    (error: Error) =>
      error instanceof ProjectsDataError &&
      error.message.includes('does not match the expected shape') &&
      error.message.includes(field),
  );
}

test(
  'the real projects.json loads',
  { skip: fs.existsSync(PROJECTS_JSON) ? false : 'src/data/projects.json not generated (npm run projects)' },
  () => {
    const data = getProjects();
    for (const project of [...data.featured, ...data.portfolio]) assert.ok(project.description, project.name);
  },
);

test('a valid file loads', () => {
  assert.deepEqual(getProjects(tempJson(validData)), validData);
});

test('a missing file says to run npm run projects first', () => {
  assert.throws(
    () => getProjects(path.join(os.tmpdir(), 'no-such-dir', 'projects.json')),
    (error: Error) => error instanceof ProjectsDataError && /not found: run npm run projects first/.test(error.message),
  );
});

test('invalid JSON fails clearly', () => {
  assert.throws(
    () => getProjects(tempJson('{"featured": [')),
    (error: Error) => error instanceof ProjectsDataError && /is not valid JSON/.test(error.message),
  );
});

test('a wrong type fails, naming the field', () => {
  assertShapeError(tempJson(withFeatured({ stars: '0' })), 'featured[0].stars');
});

test('a stale or unknown field fails, naming it', () => {
  assertShapeError(tempJson(withFeatured({ stargazers_count: 0 })), 'stargazers_count');
});

test('an empty description on a featured/portfolio project fails', () => {
  assertShapeError(tempJson(withFeatured({ description: '  ' })), 'featured[0].description');
});

test('a missing tier fails', () => {
  assertShapeError(tempJson({ featured: [], practice: [] }), 'portfolio');
});

test('what fetchProjects writes matches the schema the site reads with', async () => {
  const repos = readFixture('repos.json');
  const languages = readFixture('languages.json') as Record<string, unknown>;
  const fetchImpl = (async (input: string | URL | Request) => {
    const { pathname } = new URL(String(input));
    if (pathname.endsWith('/repos')) return new Response(JSON.stringify(repos));
    const repo = pathname.match(/^\/repos\/(.+)\/languages$/)?.[1] ?? '';
    return new Response(JSON.stringify(languages[repo] ?? {}));
  }) as typeof fetch;

  const data = await fetchProjects('ShaharAshe', { fetchImpl });
  assert.ok(data.featured.length > 0 && data.practice.length > 0, 'fixture should fill the tiers');
  const result = projectsDataSchema.safeParse(JSON.parse(JSON.stringify(data)));
  assert.ok(result.success, result.success ? '' : result.error.message);
});
