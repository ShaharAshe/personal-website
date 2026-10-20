// Tests for the GitHub project fetch (scripts/github/). No real network calls: unit tests use a fake
// fetch, and the CLI tests run fetch-projects.ts against a local HTTP server serving the fixtures in
// tests/fixtures/github/ (a trimmed GitHub API response, with forks, archived and untagged repos).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import {
  GitHubApiError,
  GitHubProfileError,
  MissingDescriptionError,
  fetchProjects,
  findMissingDescriptions,
  githubUserFromResume,
  githubUserFromUrl,
  listRepos,
  prettifyName,
  readGitHubUser,
  selectRepos,
  toProject,
} from '../scripts/github/projects.ts';
import type { GitHubRepo, Languages } from '../scripts/github/projects.ts';

const root = path.join(import.meta.dirname, '..');
const fixtures = path.join(import.meta.dirname, 'fixtures', 'github');
const readFixture = (name: string): unknown => JSON.parse(fs.readFileSync(path.join(fixtures, name), 'utf8'));

const reposFixture = () => readFixture('repos.json') as GitHubRepo[];
const languagesFixture = readFixture('languages.json') as Record<string, Languages>;

// Parsed fixture repos, as listRepos returns them (topics defaulted, unknown fields dropped).
async function parsedRepos(repos: unknown = reposFixture()) {
  return listRepos('ShaharAshe', { fetchImpl: fakeGitHub(repos).fetchImpl });
}

type Route = { status: number; body: string; headers?: Record<string, string> };

// Serves the two endpoints fetch-projects.ts calls. `override` replaces every response (errors).
function route(pathname: string, repos: unknown, override?: Route): Route {
  if (override) return override;
  if (pathname === '/users/ShaharAshe/repos') return { status: 200, body: JSON.stringify(repos) };
  const repo = pathname.match(/^\/repos\/(.+)\/languages$/)?.[1];
  if (repo && repo in languagesFixture) return { status: 200, body: JSON.stringify(languagesFixture[repo]) };
  return { status: 404, body: '{"message":"Not Found"}' };
}

function fakeGitHub(repos: unknown, override?: Route) {
  const calls: { url: string; headers: Record<string, string> }[] = [];
  const fetchImpl = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, headers: (init?.headers ?? {}) as Record<string, string> });
    const { status, body, headers } = route(new URL(url).pathname, repos, override);
    return new Response(body, { status, headers });
  }) as typeof fetch;
  return { fetchImpl, calls };
}

const names = (items: { name: string }[]) => items.map((item) => item.name);

const resumeWith = (profiles: { network: string; url: string }[]) => ({ basics: { name: 'X', profiles } });

test('githubUserFromUrl: profile URL with or without trailing slash and www', () => {
  for (const url of [
    'https://github.com/ShaharAshe',
    'https://github.com/ShaharAshe/',
    'https://www.github.com/ShaharAshe',
    'https://www.github.com/ShaharAshe/',
  ]) {
    assert.equal(githubUserFromUrl(url), 'ShaharAshe', url);
  }
});

test('githubUserFromUrl: anything that is not a GitHub profile URL fails clearly', () => {
  for (const url of [
    'https://gitlab.com/ShaharAshe',
    'https://github.com/',
    'https://github.com/ShaharAshe/log-analytics-platform',
    'https://github.com/ShaharAshe?tab=repositories',
    'https://github.com/-bad-name-',
    'ftp://github.com/ShaharAshe',
    'github.com/ShaharAshe',
    'not a url',
  ]) {
    assert.throws(
      () => githubUserFromUrl(url),
      (error: unknown) => {
        assert.ok(error instanceof GitHubProfileError, url);
        assert.match(error.message, /not a profile like https:\/\/github\.com\/<username>/, url);
        return true;
      },
    );
  }
});

test('githubUserFromResume: reads the network: GitHub profile', () => {
  const resume = resumeWith([
    { network: 'LinkedIn', url: 'https://www.linkedin.com/in/x' },
    { network: 'GitHub', url: 'https://github.com/ShaharAshe/' },
  ]);
  assert.equal(githubUserFromResume(resume), 'ShaharAshe');
});

test('githubUserFromResume: no GitHub profile fails clearly', () => {
  const resume = resumeWith([{ network: 'LinkedIn', url: 'https://www.linkedin.com/in/x' }]);
  assert.throws(() => githubUserFromResume(resume), GitHubProfileError);
  assert.throws(() => githubUserFromResume(resume), /has no GitHub profile\. Add one under basics\.profiles/);
  assert.throws(() => githubUserFromResume({ basics: {} }), /has no basics\.profiles list/);
});

test('githubUserFromResume: a GitHub profile with a non-profile URL fails clearly', () => {
  const resume = resumeWith([{ network: 'GitHub', url: 'https://github.com/ShaharAshe/some-repo' }]);
  assert.throws(
    () => githubUserFromResume(resume, 'resume.yaml'),
    (error: unknown) => {
      assert.ok(error instanceof GitHubProfileError);
      assert.match(error.message, /^resume\.yaml: GitHub profile URL is not a profile/);
      return true;
    },
  );
});

test('readGitHubUser: reads a resume YAML file (fixture), and the real resume.yaml', () => {
  assert.equal(readGitHubUser(path.join(import.meta.dirname, 'fixtures', 'resume-valid.yaml')), 'jane-example');
  assert.equal(readGitHubUser(), 'ShaharAshe');
});

test('prettifyName', () => {
  assert.equal(prettifyName('log-analytics-platform'), 'Log Analytics Platform');
  assert.equal(prettifyName('Cryptography_modules'), 'Cryptography Modules');
  assert.equal(prettifyName('project_euler'), 'Project Euler');
  assert.equal(prettifyName('LeetCode'), 'LeetCode');
  assert.equal(prettifyName('diff-checker'), 'Diff Checker');
});

test('selectRepos: tiers by topic, newest push first; forks, archived and untagged excluded', async () => {
  const groups = selectRepos(await parsedRepos());
  assert.deepEqual(names(groups.featured), ['event-pipeline', 'both-tags']);
  assert.deepEqual(names(groups.portfolio), ['web_tool', 'old-portfolio-app']);
  assert.deepEqual(names(groups.practice), ['LeetCode', 'project_euler']);

  const all = names([...groups.featured, ...groups.portfolio, ...groups.practice]);
  for (const excluded of ['forked-library', 'archived-project', 'untagged-repo', 'untagged-no-description']) {
    assert.ok(!all.includes(excluded), `${excluded} should be excluded`);
  }
});

test('selectRepos: a repo tagged with two tiers goes to the higher one only', async () => {
  const groups = selectRepos(await parsedRepos());
  assert.ok(names(groups.featured).includes('both-tags'));
  assert.ok(!names(groups.portfolio).includes('both-tags'));
});

test('selectRepos: private repos are excluded even if tagged', async () => {
  const repos = reposFixture().map((repo) => (repo.name === 'web_tool' ? { ...repo, private: true } : repo));
  assert.deepEqual(names(selectRepos(await parsedRepos(repos)).portfolio), ['old-portfolio-app']);
});

test('toProject: maps fields, strips portfolio topics, sorts languages by bytes, normalizes homepage', async () => {
  const repos = await parsedRepos();
  const pipeline = repos.find((repo) => repo.name === 'event-pipeline')!;
  assert.deepEqual(toProject(pipeline, languagesFixture['ShaharAshe/event-pipeline']), {
    name: 'event-pipeline',
    title: 'Event Pipeline',
    description: 'Kafka-based event pipeline.',
    url: 'https://github.com/ShaharAshe/event-pipeline',
    homepage: null,
    languages: ['Java', 'Shell', 'Dockerfile'],
    topics: ['java', 'kafka'],
    stars: 3,
    pushedAt: '2026-10-01T10:00:00Z',
  });
  const bothTags = repos.find((repo) => repo.name === 'both-tags')!;
  assert.deepEqual(toProject(bothTags, {}).topics, []);
});

test('findMissingDescriptions: featured/portfolio need one (null or blank); practice does not', async () => {
  assert.deepEqual(findMissingDescriptions(selectRepos(await parsedRepos())), []);

  const repos = reposFixture().map((repo) => {
    if (repo.name === 'event-pipeline') return { ...repo, description: null };
    if (repo.name === 'web_tool') return { ...repo, description: '   ' };
    return repo;
  });
  assert.deepEqual(findMissingDescriptions(selectRepos(await parsedRepos(repos))), ['event-pipeline', 'web_tool']);
});

test('fetchProjects: full result from the fixture', async () => {
  const data = await fetchProjects('ShaharAshe', { fetchImpl: fakeGitHub(reposFixture()).fetchImpl });
  assert.deepEqual(names(data.featured), ['event-pipeline', 'both-tags']);
  assert.deepEqual(names(data.portfolio), ['web_tool', 'old-portfolio-app']);
  assert.deepEqual(data.portfolio[0].homepage, 'https://shaharashe.github.io/web_tool/');
  assert.deepEqual(data.portfolio[0].languages, ['JavaScript', 'CSS', 'HTML']);
  assert.deepEqual(data.practice, [
    {
      name: 'LeetCode',
      title: 'LeetCode',
      description: 'LeetCode solutions.',
      url: 'https://github.com/ShaharAshe/LeetCode',
      pushedAt: '2026-09-24T12:14:33Z',
    },
    {
      name: 'project_euler',
      title: 'Project Euler',
      description: null,
      url: 'https://github.com/ShaharAshe/project_euler',
      pushedAt: '2024-08-12T12:15:49Z',
    },
  ]);
});

test('fetchProjects: missing description throws before fetching any languages', async () => {
  const repos = reposFixture().map((repo) => (repo.name === 'web_tool' ? { ...repo, description: null } : repo));
  const { fetchImpl, calls } = fakeGitHub(repos);
  await assert.rejects(fetchProjects('ShaharAshe', { fetchImpl }), (error: unknown) => {
    assert.ok(error instanceof MissingDescriptionError);
    assert.deepEqual(error.repos, ['web_tool']);
    return true;
  });
  assert.equal(calls.length, 1);
});

test('fetchProjects: zero tagged repos gives an empty result, not an error', async () => {
  const untagged = reposFixture().map((repo) => ({ ...repo, topics: ['java'] }));
  const data = await fetchProjects('ShaharAshe', { fetchImpl: fakeGitHub(untagged).fetchImpl });
  assert.deepEqual(data, { featured: [], portfolio: [], practice: [] });
});

test('GITHUB_TOKEN: sent as a Bearer header when set, no Authorization header when not', async () => {
  const withToken = fakeGitHub(reposFixture());
  await fetchProjects('ShaharAshe', { token: 'test-token', fetchImpl: withToken.fetchImpl });
  assert.ok(withToken.calls.every((call) => call.headers.Authorization === 'Bearer test-token'));

  const without = fakeGitHub(reposFixture());
  await fetchProjects('ShaharAshe', { fetchImpl: without.fetchImpl });
  assert.ok(without.calls.every((call) => !('Authorization' in call.headers)));
});

test('listRepos: follows Link rel="next" pagination', async () => {
  const [first, ...rest] = reposFixture();
  const calls: string[] = [];
  const fetchImpl = (async (input: string | URL | Request) => {
    const url = String(input);
    calls.push(url);
    if (url.includes('page=2')) return Response.json(rest);
    return Response.json([first], {
      headers: {
        link: '<https://api.github.com/user/1/repos?per_page=100&page=2>; rel="next", <https://api.github.com/user/1/repos?per_page=100&page=2>; rel="last"',
      },
    });
  }) as typeof fetch;
  const repos = await listRepos('ShaharAshe', { fetchImpl });
  assert.equal(repos.length, reposFixture().length);
  assert.equal(calls.length, 2);
});

test('API errors: non-2xx, rate limit, network failure and a malformed response all throw GitHubApiError', async () => {
  const cases: [string, typeof fetch, RegExp][] = [
    ['500', fakeGitHub([], { status: 500, body: 'boom' }).fetchImpl, /returned 500/],
    [
      'rate limit',
      fakeGitHub([], { status: 403, body: '{}', headers: { 'x-ratelimit-remaining': '0' } }).fetchImpl,
      /rate limit exceeded\. Set GITHUB_TOKEN/,
    ],
    [
      'network',
      (async () => {
        throw new TypeError('fetch failed');
      }) as typeof fetch,
      /request failed[\s\S]*fetch failed/,
    ],
    ['malformed', fakeGitHub({ not: 'an array' }).fetchImpl, /Unexpected GitHub API response/],
  ];
  for (const [name, fetchImpl, message] of cases) {
    await assert.rejects(fetchProjects('ShaharAshe', { fetchImpl }), (error: unknown) => {
      assert.ok(error instanceof GitHubApiError, `${name}: expected GitHubApiError`);
      assert.match(error.message, message, name);
      return true;
    });
  }
});

test('API errors: a failed languages request fails the whole fetch', async () => {
  const repos = reposFixture().map((repo) =>
    repo.name === 'web_tool' ? { ...repo, full_name: 'ShaharAshe/gone' } : repo,
  );
  await assert.rejects(fetchProjects('ShaharAshe', { fetchImpl: fakeGitHub(repos).fetchImpl }), /returned 404/);
});

// --- CLI: fetch-projects.ts against a local fake GitHub API -------------------------------------

async function fakeServer(repos: unknown, override?: Route) {
  const server = http.createServer((req, res) => {
    const { status, body, headers } = route(new URL(req.url!, 'http://localhost').pathname, repos, override);
    res.writeHead(status, { 'content-type': 'application/json', ...headers }).end(body);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  test.after(() => server.close());
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

function tempOutput() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'projects-test-'));
  test.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return path.join(dir, 'projects.json');
}

// Async spawn (not spawnSync) so the fake server in this process can answer the child.
function runCli(apiUrl: string, outFile: string): Promise<{ code: number | null; stdout: string; stderr: string }> {
  const env: NodeJS.ProcessEnv = { ...process.env, GITHUB_API_URL: apiUrl };
  delete env.GITHUB_TOKEN;
  const script = path.join(root, 'scripts', 'github', 'fetch-projects.ts');
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['--disable-warning=MODULE_TYPELESS_PACKAGE_JSON', script, outFile], { env });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => (stdout += chunk));
    child.stderr.on('data', (chunk) => (stderr += chunk));
    child.on('error', reject);
    child.on('close', (code) => resolve({ code, stdout, stderr }));
  });
}

test('CLI: writes projects.json and exits 0', async () => {
  const out = tempOutput();
  const { code, stdout, stderr } = await runCli(await fakeServer(reposFixture()), out);
  assert.equal(code, 0, stderr);
  assert.match(stdout, /GITHUB_TOKEN not set/);
  const data = JSON.parse(fs.readFileSync(out, 'utf8'));
  assert.deepEqual(names(data.featured), ['event-pipeline', 'both-tags']);
  assert.deepEqual(names(data.portfolio), ['web_tool', 'old-portfolio-app']);
  assert.deepEqual(names(data.practice), ['LeetCode', 'project_euler']);
});

test('CLI: missing description exits non-zero with the repo name, and writes nothing', async () => {
  const out = tempOutput();
  const repos = reposFixture().map((repo) => (repo.name === 'event-pipeline' ? { ...repo, description: null } : repo));
  const { code, stderr } = await runCli(await fakeServer(repos), out);
  assert.notEqual(code, 0);
  assert.match(stderr, /no GitHub description: event-pipeline/);
  assert.ok(!fs.existsSync(out));
});

test('CLI: API error exits non-zero and writes nothing', async () => {
  const out = tempOutput();
  const { code, stderr } = await runCli(await fakeServer([], { status: 503, body: 'unavailable' }), out);
  assert.notEqual(code, 0);
  assert.match(stderr, /GitHub API returned 503/);
  assert.ok(!fs.existsSync(out));
});

test('CLI: zero tagged repos warns, writes an empty result, exits 0', async () => {
  const out = tempOutput();
  const untagged = reposFixture().map((repo) => ({ ...repo, topics: [] }));
  const { code, stderr } = await runCli(await fakeServer(untagged), out);
  assert.equal(code, 0, stderr);
  assert.match(stderr, /Warning: no repos/);
  assert.deepEqual(JSON.parse(fs.readFileSync(out, 'utf8')), { featured: [], portfolio: [], practice: [] });
});
