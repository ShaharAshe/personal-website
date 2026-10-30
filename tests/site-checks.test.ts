// Tests for the site checks in scripts/checks/ (run by npm run check). Each CLI runs as a child
// process against temp fixtures, with a made-up phone number in CV_PHONE (and a made-up email) and CI
// unset, so the real number and address never reach a test file or test output.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  MissingBuildError,
  PhoneConfigError,
  findPhone,
  phonePattern,
  readPhone,
  requireBuild,
} from '../scripts/checks/phone.ts';
import { emailPattern, findEmail } from '../scripts/checks/email.ts';
import { getEmailParts } from '../src/lib/resume.ts';
import { RESUME_BASENAME } from '../scripts/cv/paths.js';
import { writeTextPdf } from './helpers/pdf.ts';

const FAKE_LOCAL = '055-555-0199';
const FAKE_INTL = '+972 55-555-0199';

const script = (name: string) => path.join(import.meta.dirname, '..', 'scripts', 'checks', name);

function run(name: string, args: string[], env: NodeJS.ProcessEnv = { CV_PHONE: FAKE_LOCAL }) {
  const childEnv: NodeJS.ProcessEnv = { ...process.env, ...env };
  if (!('CI' in env)) delete childEnv.CI;
  const result = spawnSync(
    process.execPath,
    ['--disable-warning=MODULE_TYPELESS_PACKAGE_JSON', script(name), ...args],
    {
      env: childEnv,
      encoding: 'utf8',
    },
  );
  // No check may ever print the number it's looking for.
  assert.deepEqual(findPhone(result.stdout + result.stderr, phonePattern(FAKE_LOCAL)), [], 'output contains the phone');
  return result;
}

function tempDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'site-checks-test-'));
  test.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

function writeFiles(dir: string, files: Record<string, string>) {
  for (const [name, content] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, name)), { recursive: true });
    fs.writeFileSync(path.join(dir, name), content);
  }
  return dir;
}

// --- phone.ts ---

test('phonePattern matches the last 9 digits with any separators', () => {
  const pattern = phonePattern(FAKE_LOCAL);
  for (const text of ['055-555-0199', '0555550199', '055 555 0199', '(055) 555.0199', '0 5 5 5 5 5 0 1 9 9']) {
    assert.equal(findPhone(text, pattern).length, 1, text);
  }
  assert.deepEqual(findPhone('055-555-0198\n055-123-4567', pattern), []);
});

test('phonePattern catches the local form from an international CV_PHONE, and the reverse', () => {
  assert.equal(findPhone('call 055-555-0199', phonePattern(FAKE_INTL)).length, 1);
  assert.equal(findPhone('call +972 55-555-0199', phonePattern(FAKE_LOCAL)).length, 1);
  assert.equal(findPhone('+972555550199', phonePattern(FAKE_LOCAL)).length, 1);
});

test('findPhone reports 1-based line numbers', () => {
  assert.deepEqual(findPhone(`a\nb ${FAKE_LOCAL}\nc\n${FAKE_INTL}`, phonePattern(FAKE_LOCAL)), [2, 4]);
});

test('readPhone: unset skips locally, fails in CI, rejects too-short values', () => {
  assert.ok('skip' in readPhone({}));
  assert.ok('skip' in readPhone({ CV_PHONE: '  ' }));
  assert.throws(() => readPhone({ CI: 'true' }), PhoneConfigError);
  assert.throws(() => readPhone({ CV_PHONE: '1234567' }), PhoneConfigError);
  assert.deepEqual(readPhone({ CV_PHONE: FAKE_INTL }), { phone: FAKE_INTL });
});

test('requireBuild fails with "run npm run build first" when dist/ or .generated/ is missing', () => {
  const root = tempDir();
  assert.throws(() => requireBuild(root), /dist\/ and \.generated\/ not found: run npm run build first/);
  fs.mkdirSync(path.join(root, 'dist'));
  assert.throws(() => requireBuild(root), MissingBuildError);
  fs.mkdirSync(path.join(root, '.generated'));
  requireBuild(root);
});

test('require-build.ts exits 1 with the message when the build is missing', () => {
  const result = run('require-build.ts', [tempDir()]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /run npm run build first/);
});

// --- no-phone-in-dist.ts ---

test('no-phone-in-dist: a phone in a dist HTML file fails, naming the file', () => {
  const dist = writeFiles(tempDir(), {
    'index.html': '<p>hello</p>',
    'about/index.html': `<p>Call me</p>\n<p>${FAKE_LOCAL}</p>`,
  });
  const result = run('no-phone-in-dist.ts', [dist]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /about[\\/]index\.html:2/);
});

test('no-phone-in-dist: the international form in CV_PHONE catches the local form in dist', () => {
  const dist = writeFiles(tempDir(), { '_astro/page.js': `const p="${FAKE_LOCAL}";` });
  const result = run('no-phone-in-dist.ts', [dist], { CV_PHONE: FAKE_INTL });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /page\.js:1/);
});

test('no-phone-in-dist: the resume PDF/DOCX containing the phone does not trigger it', () => {
  const dist = writeFiles(tempDir(), { 'index.html': '<p>hello</p>', [`${RESUME_BASENAME}.docx`]: FAKE_LOCAL });
  writeTextPdf(path.join(dist, `${RESUME_BASENAME}.pdf`), [FAKE_LOCAL]);
  const result = run('no-phone-in-dist.ts', [dist]);
  assert.equal(result.status, 0, result.stderr);
});

test('no-phone-in-dist: CV_PHONE unset warns and skips locally, fails in CI', () => {
  const dist = writeFiles(tempDir(), { 'index.html': FAKE_LOCAL });
  const local = run('no-phone-in-dist.ts', [dist], { CV_PHONE: '' });
  assert.equal(local.status, 0);
  assert.match(local.stderr, /CV_PHONE not set/);
  const ci = run('no-phone-in-dist.ts', [dist], { CV_PHONE: '', CI: 'true' });
  assert.equal(ci.status, 1);
  assert.match(ci.stderr, /required in CI/);
});

test('no-phone-in-dist: a CV_PHONE too short to be a phone fails', () => {
  const result = run('no-phone-in-dist.ts', [tempDir()], { CV_PHONE: '12345' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /doesn't look like a phone number/);
});

// --- no-phone-in-source.ts ---

const noGit = spawnSync('git', ['--version']).error ? 'git not found' : false;

function tempRepo(files: Record<string, string>, tracked: string[]) {
  const repo = writeFiles(tempDir(), files);
  for (const args of [
    ['init', '-q'],
    ['add', '--', ...tracked],
  ]) {
    const result = spawnSync('git', args, { cwd: repo, encoding: 'utf8' });
    assert.equal(result.status, 0, `git ${args.join(' ')} failed:\n${result.stderr}`);
  }
  return repo;
}

test('no-phone-in-source: a phone in a tracked file fails, naming the file', { skip: noGit }, () => {
  const repo = tempRepo({ 'src/ok.ts': 'export {};\n', 'scripts/create_cv.js': `\nconst phone = '${FAKE_INTL}';\n` }, [
    '.',
  ]);
  const result = run('no-phone-in-source.ts', [repo]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /scripts\/create_cv\.js:2/);
});

test('no-phone-in-source: an untracked file with the phone (like .env) passes', { skip: noGit }, () => {
  const repo = tempRepo({ 'src/ok.ts': 'export {};\n', '.env': `CV_PHONE=${FAKE_LOCAL}\n` }, ['src/ok.ts']);
  const result = run('no-phone-in-source.ts', [repo]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /No phone number in 1 tracked files/);
});

// --- no-email-in-dist.ts ---
// Uses the made-up email in tests/fixtures/resume-valid.yaml. The real-dist test reads the real
// email only in memory to check the output never contains it.

const FAKE_RESUME = path.join(import.meta.dirname, 'fixtures', 'resume-valid.yaml');
const FAKE_EMAIL = emailPattern('jane', 'example.com');

function runEmailCheck(args: string[], email = FAKE_EMAIL) {
  const result = run('no-email-in-dist.ts', args);
  assert.deepEqual(findEmail(result.stdout + result.stderr, email), [], 'output contains the email');
  return result;
}

test('emailPattern matches case-insensitively and the %40-encoded form, not look-alikes', () => {
  const lines = findEmail(
    'jane@example.com\nJANE@Example.COM\nmailto:jane%40example.com\njane@example.org\njaneXexample.com',
    FAKE_EMAIL,
  );
  assert.deepEqual(lines, [1, 2, 3]);
});

test('no-email-in-dist: an email in dist files fails, naming file:line only', () => {
  const dist = writeFiles(tempDir(), {
    'index.html': '<p>hello</p>',
    'contact/index.html': '<p>Write to</p>\n<a href="mailto:Jane@Example.com">me</a>',
    '_astro/page.js': 'const e="jane%40example.com";',
  });
  const result = runEmailCheck([dist, FAKE_RESUME]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /contact[\\/]index\.html:2/);
  assert.match(result.stderr, /page\.js:1/);
});

test('no-email-in-dist: user and domain apart (assembled in the browser) pass', () => {
  const dist = writeFiles(tempDir(), {
    'index.html': '<button data-user="jane" data-domain="example.com">Copy</button>',
  });
  const result = runEmailCheck([dist, FAKE_RESUME]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /No email address in 1 site files/);
});

test('no-email-in-dist: the resume PDF/DOCX containing the email does not trigger it', () => {
  const dist = writeFiles(tempDir(), { 'index.html': '<p>hello</p>', [`${RESUME_BASENAME}.docx`]: 'jane@example.com' });
  writeTextPdf(path.join(dist, `${RESUME_BASENAME}.pdf`), ['jane@example.com']);
  const result = runEmailCheck([dist, FAKE_RESUME]);
  assert.equal(result.status, 0, result.stderr);
});

test('no-email-in-dist: a missing dist/ fails', () => {
  const result = runEmailCheck([path.join(tempDir(), 'dist'), FAKE_RESUME]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /run npm run build first/);
});

const realDist = path.join(import.meta.dirname, '..', 'dist');

test(
  'no-email-in-dist: passes on the real dist/',
  { skip: fs.existsSync(realDist) ? false : 'dist/ not built (npm run build)' },
  () => {
    const { user, domain } = getEmailParts();
    const result = runEmailCheck([realDist], emailPattern(user, domain));
    assert.equal(result.status, 0, result.stderr);
  },
);

// --- pdf-contains-phone.ts ---

test('pdf-contains-phone: a PDF without the phone fails', () => {
  const pdf = path.join(tempDir(), 'resume.pdf');
  writeTextPdf(pdf, ['Shahar Asher', 'Software Engineer']);
  const result = run('pdf-contains-phone.ts', [pdf]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /does not contain the CV_PHONE number/);
});

test('pdf-contains-phone: a PDF with the phone passes', () => {
  const pdf = path.join(tempDir(), 'resume.pdf');
  writeTextPdf(pdf, ['Shahar Asher', `${FAKE_INTL} | someone@example.com`]);
  const result = run('pdf-contains-phone.ts', [pdf], { CV_PHONE: FAKE_INTL });
  assert.equal(result.status, 0, result.stderr);
});

test('pdf-contains-phone: a missing PDF fails', () => {
  const result = run('pdf-contains-phone.ts', [path.join(tempDir(), 'missing.pdf')]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /PDF not found/);
});
