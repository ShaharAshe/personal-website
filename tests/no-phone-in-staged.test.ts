// Tests for the pre-commit phone check (.githooks/pre-commit → scripts/checks/no-phone-in-staged.ts)
// and the hook installer (scripts/git/install-hooks.ts, the npm "prepare" script). Uses only a made-up
// phone number, with CI unset, so the real number never reaches a test file or test output.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PhoneConfigError, findPhone, phonePattern } from '../scripts/checks/phone.ts';
import {
  type StagedFile,
  failureMessage,
  findStagedHits,
  isBinary,
  missingPhoneMessage,
  parseNameStatus,
  stagedPhonePattern,
} from '../scripts/checks/staged.ts';
import { HOOKS_PATH, decideHookInstall } from '../scripts/git/hooks.ts';

const FAKE_LOCAL = '055-555-0199';
const FAKE_INTL = '+972 55-555-0199';
const FAKE = phonePattern(FAKE_LOCAL);

const ROOT = path.join(import.meta.dirname, '..');
const CHECKER = path.join(ROOT, 'scripts', 'checks', 'no-phone-in-staged.ts');

function assertNoPhone(text: string) {
  assert.deepEqual(findPhone(text, FAKE), [], 'output contains the phone');
}

function staged(file: string, content: string | Buffer, status = 'M'): StagedFile {
  return { path: file, status, content: Buffer.from(content) };
}

// --- stagedPhonePattern: fails closed ---

test('stagedPhonePattern: unset CV_PHONE blocks with the .env.example instructions', () => {
  for (const env of [{}, { CV_PHONE: '  ' }]) {
    assert.throws(
      () => stagedPhonePattern(env),
      (error: Error) =>
        error instanceof PhoneConfigError &&
        /CV_PHONE is not set/.test(error.message) &&
        /\.env\.example/.test(error.message),
    );
  }
  assert.match(missingPhoneMessage(), /--no-verify/);
});

test('stagedPhonePattern: a too-short CV_PHONE blocks too', () => {
  assert.throws(() => stagedPhonePattern({ CV_PHONE: '12345' }), /doesn't look like a phone number.*blocked/s);
});

test('stagedPhonePattern: a valid CV_PHONE gives the shared phone.ts pattern', () => {
  assert.equal(stagedPhonePattern({ CV_PHONE: FAKE_INTL }).source, phonePattern(FAKE_INTL).source);
});

// --- parseNameStatus / isBinary ---

test('parseNameStatus parses the -z name-status output', () => {
  assert.deepEqual(parseNameStatus('M\0src/a.ts\0A\0dir/new file.md\0D\0old.txt\0'), [
    { status: 'M', path: 'src/a.ts' },
    { status: 'A', path: 'dir/new file.md' },
    { status: 'D', path: 'old.txt' },
  ]);
  assert.deepEqual(parseNameStatus(''), []);
});

test('isBinary: a NUL byte in the first 8000 bytes', () => {
  assert.equal(isBinary(Buffer.from('plain text\n')), false);
  assert.equal(isBinary(Buffer.from([0x25, 0x50, 0x00, 0x44])), true);
  assert.equal(isBinary(Buffer.concat([Buffer.alloc(8000, 0x61), Buffer.from([0])])), false);
});

// --- findStagedHits ---

test('findStagedHits: local and international forms with separators, with line numbers', () => {
  const hits = findStagedHits(
    [
      staged('a.ts', `one\nconst p = '${FAKE_LOCAL}';\nthree\n`),
      staged('b.md', `x\ny\ncall +972 (55) 555.0199\n0555550199\n`, 'A'),
    ],
    FAKE,
  );
  assert.deepEqual(hits, ['a.ts:2', 'b.md:3', 'b.md:4']);
  for (const hit of hits) assertNoPhone(hit);
});

test('findStagedHits: text without the number passes', () => {
  assert.deepEqual(findStagedHits([staged('a.ts', 'call 055-555-0198\n')], FAKE), []);
});

test('findStagedHits: deleted and binary files are skipped', () => {
  const files = [
    { path: 'gone.txt', status: 'D', content: null },
    staged('img.png', Buffer.concat([Buffer.from([0x89, 0x50, 0x00]), Buffer.from(FAKE_LOCAL)]), 'A'),
  ];
  assert.deepEqual(findStagedHits(files, FAKE), []);
});

test('findStagedHits: a path containing the number is reported without printing the path', () => {
  const hits = findStagedHits([staged(`notes/${FAKE_LOCAL}.txt`, 'hello', 'A')], FAKE);
  assert.equal(hits.length, 1);
  assertNoPhone(hits[0]);
});

test('failureMessage lists file:line, says what to do, and never contains the number', () => {
  const message = failureMessage(['a.ts:2']);
  assert.match(message, /a\.ts:2/);
  assert.match(message, /stage the files again \(git add\)/);
  assert.match(message, /--no-verify/);
  assertNoPhone(message);
});

// --- decideHookInstall ---

test('decideHookInstall: sets core.hooksPath only on a local checkout without one', () => {
  const base = { ci: false, gitAvailable: true, isRepoRoot: true, currentHooksPath: null };
  assert.equal(decideHookInstall(base).action, 'set');
  assert.equal(decideHookInstall({ ...base, ci: true }).action, 'skip');
  assert.equal(decideHookInstall({ ...base, gitAvailable: false }).action, 'skip');
  assert.equal(decideHookInstall({ ...base, isRepoRoot: false }).action, 'skip');
  assert.equal(decideHookInstall({ ...base, currentHooksPath: HOOKS_PATH }).action, 'already');
  const other = decideHookInstall({ ...base, currentHooksPath: '.husky' });
  assert.equal(other.action, 'warn');
  assert.match(other.message, /NOT active/);
});

// --- the hook file ---

test('.githooks/pre-commit is a POSIX sh script with LF endings that runs the checker', () => {
  const hook = fs.readFileSync(path.join(ROOT, '.githooks', 'pre-commit'), 'utf8');
  assert.ok(hook.startsWith('#!/bin/sh\n'), 'missing #!/bin/sh first line');
  assert.ok(!hook.includes('\r'), 'hook has CRLF line endings');
  assert.match(hook, /scripts\/checks\/no-phone-in-staged\.ts/);
});

// --- no-phone-in-staged.ts against a real temporary git repo ---

const noGit = spawnSync('git', ['--version']).error ? 'git not found' : false;

function tempRepo() {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'staged-check-test-'));
  test.after(() => fs.rmSync(repo, { recursive: true, force: true }));
  git(repo, 'init', '-q');
  return repo;
}

function git(repo: string, ...args: string[]) {
  const result = spawnSync('git', ['-c', 'user.name=Test', '-c', 'user.email=test@example.com', ...args], {
    cwd: repo,
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, `git ${args.join(' ')} failed:\n${result.stderr}`);
}

function write(repo: string, file: string, content: string | Buffer) {
  fs.mkdirSync(path.dirname(path.join(repo, file)), { recursive: true });
  fs.writeFileSync(path.join(repo, file), content);
}

function check(repo: string, phone = FAKE_LOCAL) {
  const env: NodeJS.ProcessEnv = { ...process.env, CV_PHONE: phone };
  delete env.CI;
  const result = spawnSync(process.execPath, ['--disable-warning=MODULE_TYPELESS_PACKAGE_JSON', CHECKER, repo], {
    env,
    encoding: 'utf8',
  });
  assertNoPhone(result.stdout + result.stderr);
  return result;
}

test('no-phone-in-staged: a staged file with the number fails, naming file:line', { skip: noGit }, () => {
  const repo = tempRepo();
  write(repo, 'src/ok.ts', 'export {};\n');
  write(repo, 'scripts/create_cv.js', `\nconst phone = '${FAKE_INTL}';\n`);
  git(repo, 'add', '.');
  const result = check(repo);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /scripts\/create_cv\.js:2/);
  assert.match(result.stderr, /--no-verify/);
});

test('no-phone-in-staged: staged files without the number pass', { skip: noGit }, () => {
  const repo = tempRepo();
  write(repo, 'src/ok.ts', 'export {};\n');
  write(repo, '.env', `CV_PHONE=${FAKE_LOCAL}\n`); // not staged
  git(repo, 'add', 'src/ok.ts');
  const result = check(repo);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /No phone number in 1 staged files/);
});

test('no-phone-in-staged: checks the index, not the working tree', { skip: noGit }, () => {
  const repo = tempRepo();
  write(repo, 'a.txt', `phone: ${FAKE_LOCAL}\n`);
  git(repo, 'add', 'a.txt');
  write(repo, 'a.txt', 'phone: removed\n'); // fixed on disk but not staged again
  assert.equal(check(repo).status, 1);

  write(repo, 'b.txt', 'clean\n');
  git(repo, 'add', 'b.txt');
  git(repo, 'rm', '-q', '-f', '--cached', 'a.txt');
  write(repo, 'b.txt', `${FAKE_LOCAL}\n`); // on disk only
  assert.equal(check(repo).status, 0);
});

test('no-phone-in-staged: deleted and binary staged files are not flagged', { skip: noGit }, () => {
  const repo = tempRepo();
  write(repo, 'old.txt', `${FAKE_LOCAL}\n`);
  git(repo, 'add', 'old.txt');
  git(repo, 'commit', '-q', '-m', 'init');
  git(repo, 'rm', '-q', 'old.txt');
  write(repo, 'blob.bin', Buffer.concat([Buffer.from([0, 1, 2]), Buffer.from(FAKE_LOCAL)]));
  git(repo, 'add', 'blob.bin');
  const result = check(repo);
  assert.equal(result.status, 0, result.stderr);
});

test('no-phone-in-staged: missing CV_PHONE fails closed', { skip: noGit }, () => {
  const repo = tempRepo();
  write(repo, 'ok.txt', 'hello\n');
  git(repo, 'add', 'ok.txt');
  const result = check(repo, '');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /CV_PHONE is not set/);
  assert.match(result.stderr, /\.env\.example/);
});
