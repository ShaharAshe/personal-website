// Tests for the PR workflow (task 2.17): the pre-push main guard (.githooks/pre-push →
// scripts/git/pre-push.ts → scripts/git/push-policy.ts), that the hooks are executable in git and
// installed by the prepare script, and that deploy.yml checks every PR and deploys only from main.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import yaml from 'js-yaml';
import { HOOKS_PATH } from '../scripts/git/hooks.ts';
import { type PushUpdate, decidePush, isZeroOid, parsePushLines } from '../scripts/git/push-policy.ts';

const ROOT = path.join(import.meta.dirname, '..');
const CLI = path.join(ROOT, 'scripts', 'git', 'pre-push.ts');
const HOOKS_DIR = path.join(ROOT, HOOKS_PATH);

const OID = 'a'.repeat(40);
const ZERO = '0'.repeat(40);

function update(localRef: string, remoteRef: string, localOid = OID, remoteOid = ZERO): PushUpdate {
  return { localRef, localOid, remoteRef, remoteOid };
}

// --- push-policy: parsePushLines / isZeroOid ---

test('parsePushLines reads one update per line and ignores blank lines', () => {
  assert.deepEqual(
    parsePushLines(`refs/heads/x ${OID} refs/heads/x ${ZERO}\r\n\n(delete) ${ZERO} refs/heads/y ${OID}\n`),
    [update('refs/heads/x', 'refs/heads/x'), update('(delete)', 'refs/heads/y', ZERO, OID)],
  );
  assert.deepEqual(parsePushLines(''), []);
});

test('isZeroOid: SHA-1 and SHA-256 zero ids', () => {
  assert.equal(isZeroOid(ZERO), true);
  assert.equal(isZeroOid('0'.repeat(64)), true);
  assert.equal(isZeroOid(OID), false);
});

// --- push-policy: decidePush ---

test('decidePush refuses a push to main, from any local ref', () => {
  for (const localRef of ['refs/heads/main', 'HEAD', 'refs/heads/task/2-17-pr-workflow']) {
    const decision = decidePush([update(localRef, 'refs/heads/main')]);
    assert.equal(decision.allowed, false, localRef);
    assert.match(decision.message, /refusing to push to 'main' on 'origin'/);
  }
});

test('decidePush refuses main even when other refs are pushed with it', () => {
  const decision = decidePush([update('refs/heads/x', 'refs/heads/x'), update('refs/heads/main', 'refs/heads/main')]);
  assert.equal(decision.allowed, false);
});

test('decidePush allows other branches and tags', () => {
  for (const ref of [
    'refs/heads/task/2-17-pr-workflow',
    'refs/heads/feature/main',
    'refs/heads/mainline',
    'refs/tags/v1',
  ]) {
    assert.deepEqual(decidePush([update(ref, ref)]), { allowed: true, message: '' }, ref);
  }
});

test('decidePush: deleting another remote branch is allowed, deleting main is refused', () => {
  assert.equal(decidePush([update('(delete)', 'refs/heads/old-branch', ZERO, OID)]).allowed, true);
  const main = decidePush([update('(delete)', 'refs/heads/main', ZERO, OID)], 'upstream');
  assert.equal(main.allowed, false);
  assert.match(main.message, /refusing to delete 'main' on 'upstream'/);
});

test('decidePush: nothing to push is allowed', () => {
  assert.equal(decidePush([]).allowed, true);
});

test('the refusal message names the branch and PR steps, and the squash cleanup', () => {
  const { message } = decidePush([update('refs/heads/main', 'refs/heads/main')]);
  for (const step of [
    'git switch -c task/',
    'git push -u origin <branch>',
    'gh pr create',
    'git branch -f main origin/main',
    'git fetch --prune',
    'git branch -D <branch>',
  ]) {
    assert.ok(message.includes(step), `message is missing "${step}"`);
  }
  assert.doesNotMatch(message, /--no-verify/);
});

// --- pre-push.ts CLI ---

function runCli(stdin: string) {
  return spawnSync(process.execPath, ['--disable-warning=MODULE_TYPELESS_PACKAGE_JSON', CLI, 'origin', 'url'], {
    input: stdin,
    encoding: 'utf8',
  });
}

test('pre-push.ts exits 1 with the message for main, 0 for a branch', () => {
  const refused = runCli(`refs/heads/main ${OID} refs/heads/main ${ZERO}\n`);
  assert.equal(refused.status, 1);
  assert.match(refused.stderr, /refusing to push to 'main'/);
  const allowed = runCli(`refs/heads/x ${OID} refs/heads/x ${ZERO}\n`);
  assert.equal(allowed.status, 0, allowed.stderr);
  assert.equal(allowed.stderr, '');
});

// --- the hook file, executable in git, installed by prepare ---

test('.githooks/pre-push is a POSIX sh script with LF endings that runs pre-push.ts', () => {
  const hook = fs.readFileSync(path.join(HOOKS_DIR, 'pre-push'), 'utf8');
  assert.ok(hook.startsWith('#!/bin/sh\n'), 'missing #!/bin/sh first line');
  assert.ok(!hook.includes('\r'), 'hook has CRLF line endings');
  assert.match(hook, /scripts\/git\/pre-push\.ts/);
});

const noGit = spawnSync('git', ['--version']).error ? 'git not found' : false;

function indexModes(): Map<string, string> {
  const result = spawnSync('git', ['ls-files', '-s', '--', HOOKS_PATH], { cwd: ROOT, encoding: 'utf8' });
  const modes = new Map<string, string>();
  for (const line of result.stdout.split('\n').filter(Boolean)) {
    const [mode = '', , , file = ''] = line.split(/\s+/);
    modes.set(file, mode);
  }
  return modes;
}

const modes = noGit ? new Map<string, string>() : indexModes();

for (const name of fs.readdirSync(HOOKS_DIR)) {
  const file = `${HOOKS_PATH}/${name}`;
  // A new hook isn't in the index until it's staged; in CI it always is, so the check is strict there.
  const skip = noGit || (modes.has(file) ? false : `not in the git index yet: git add --chmod=+x ${file}`);
  test(`${file} is mode 100755 in the git index`, { skip }, () => {
    assert.equal(modes.get(file), '100755', `run: git add --chmod=+x ${file}`);
  });
}

test('the prepare script installs the hooks folder that holds pre-commit and pre-push', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  assert.match(pkg.scripts.prepare, /scripts\/git\/install-hooks\.ts/);
  assert.equal(HOOKS_PATH, '.githooks');
  for (const hook of ['pre-commit', 'pre-push']) assert.ok(fs.existsSync(path.join(HOOKS_DIR, hook)), hook);
});

// --- the real hook, run by git against a temporary remote ---

function git(cwd: string, ...args: string[]) {
  return spawnSync('git', ['-c', 'user.name=Test', '-c', 'user.email=test@example.com', ...args], {
    cwd,
    encoding: 'utf8',
  });
}

function ok(cwd: string, ...args: string[]) {
  const result = git(cwd, ...args);
  assert.equal(result.status, 0, `git ${args.join(' ')} failed:\n${result.stderr}`);
  return result;
}

function push(cwd: string, ...args: string[]) {
  return git(cwd, '-c', `core.hooksPath=${HOOKS_DIR}`, 'push', ...args);
}

function remoteHas(bare: string, ref: string) {
  return git(bare, 'rev-parse', '--verify', '--quiet', ref).status === 0;
}

test('git runs the pre-push hook: main is refused, branches and deletions go through', { skip: noGit }, () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pre-push-test-'));
  test.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const bare = path.join(dir, 'remote.git');
  const work = path.join(dir, 'work');
  ok(dir, 'init', '-q', '--bare', bare);
  ok(dir, 'init', '-q', '-b', 'main', work);
  fs.writeFileSync(path.join(work, 'a.txt'), 'a\n');
  ok(work, 'add', 'a.txt');
  ok(work, 'commit', '-q', '--no-verify', '-m', 'init');
  ok(work, 'remote', 'add', 'origin', bare);

  const refused = push(work, 'origin', 'main');
  assert.notEqual(refused.status, 0, 'push to main went through');
  assert.match(refused.stderr, /refusing to push to 'main' on 'origin'/);
  assert.equal(remoteHas(bare, 'refs/heads/main'), false, 'main reached the remote');

  ok(work, 'switch', '-q', '-c', 'task/1-1-test');
  assert.notEqual(push(work, 'origin', 'HEAD:main').status, 0, 'HEAD:main went through');

  const branch = push(work, '-u', 'origin', 'task/1-1-test');
  assert.equal(branch.status, 0, branch.stderr);
  assert.equal(remoteHas(bare, 'refs/heads/task/1-1-test'), true);

  const deletion = push(work, 'origin', '--delete', 'task/1-1-test');
  assert.equal(deletion.status, 0, deletion.stderr);
  assert.equal(remoteHas(bare, 'refs/heads/task/1-1-test'), false);
});

// --- deploy.yml: every PR is checked, only main deploys ---

type Step = { name?: string; run?: string; uses?: string; if?: string };
type Workflow = {
  on: Record<string, unknown>;
  jobs: Record<string, { name?: string; if?: string; steps: Step[] }>;
};

const workflow = yaml.load(fs.readFileSync(path.join(ROOT, '.github', 'workflows', 'deploy.yml'), 'utf8')) as Workflow;
const steps = workflow.jobs.build?.steps ?? [];

function stepIndex(command: string) {
  return steps.findIndex((step) => step.run?.split('\n').some((line) => line.trim() === command));
}

test('deploy.yml runs on pull requests, pushes to main, the daily schedule and by hand', () => {
  assert.ok('pull_request' in workflow.on, 'no pull_request trigger');
  assert.deepEqual((workflow.on.push as { branches: string[] }).branches, ['main']);
  assert.ok(Array.isArray(workflow.on.schedule), 'no schedule trigger');
  assert.ok('workflow_dispatch' in workflow.on, 'no workflow_dispatch trigger');
});

test('deploy.yml: the job is the required check "build" and always runs', () => {
  assert.deepEqual(Object.keys(workflow.jobs), ['build']);
  assert.equal(workflow.jobs.build?.name, undefined, 'a job name would change the check name from "build"');
  assert.equal(workflow.jobs.build?.if, undefined, 'a job-level if could skip the required check');
});

test('deploy.yml runs build, check and test:e2e on every event, in that order', () => {
  const indexes = ['npm run build', 'npm run check', 'npm run test:e2e'].map((command) => {
    const index = stepIndex(command);
    assert.ok(index >= 0, `no step runs ${command}`);
    assert.equal(steps[index]?.if, undefined, `the ${command} step has an if, so it could be skipped`);
    return index;
  });
  assert.deepEqual(
    [...indexes].sort((a, b) => a - b),
    indexes,
  );
});

test('deploy.yml: every deploy step is gated on main and a non-PR event, after the e2e tests', () => {
  const deploys = steps
    .map((step, index) => ({ step, index }))
    .filter(({ step }) => /wrangler\s+(deploy|versions|publish)/.test(step.run ?? ''));
  assert.ok(deploys.length > 0, 'no deploy step found');
  for (const { step, index } of deploys) {
    assert.match(step.if ?? '', /github\.ref == 'refs\/heads\/main'/);
    assert.match(step.if ?? '', /github\.event_name != 'pull_request'/);
    assert.match(step.if ?? '', /&&/, 'the two conditions must both hold');
    assert.ok(index > stepIndex('npm run test:e2e'), 'deploy runs before the e2e tests');
  }
});
