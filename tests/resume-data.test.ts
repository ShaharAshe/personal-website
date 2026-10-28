// Tests for src/lib/resume.ts: typed resume data for components, with the email held back. The real
// email is only compared in memory, never printed (no assertion message includes it).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import yaml from 'js-yaml';
import { z } from 'astro/zod';
import { RESUME_YAML as CV_RESUME_YAML } from '../scripts/cv/paths.js';
import { RESUME_YAML, ResumeDataError, getEmailParts, getResume } from '../src/lib/resume.ts';

const fixtures = path.join(import.meta.dirname, 'fixtures');
const validFixture = path.join(fixtures, 'resume-valid.yaml');

function tempFile(name: string, content: string) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'resume-data-test-'));
  test.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const file = path.join(dir, name);
  fs.writeFileSync(file, content);
  return file;
}

test('the default path is the same file the resume scripts use', () => {
  assert.equal(RESUME_YAML, CV_RESUME_YAML);
});

test('the real resume.yaml loads', () => {
  const resume = getResume();
  assert.ok(resume.basics.name);
  assert.ok(resume.work.length > 0);
  assert.ok(resume.skills.length > 0);
});

test('basics has no email field', () => {
  assert.equal('email' in getResume().basics, false);
  assert.equal('email' in getResume(validFixture).basics, false);
});

test('getEmailParts returns the user and domain', () => {
  assert.deepEqual(getEmailParts(validFixture), { user: 'jane', domain: 'example.com' });
});

test('getEmailParts on the real resume rejoins to a valid email', () => {
  const { user, domain } = getEmailParts();
  assert.ok(user.length > 0 && domain.length > 0, 'empty email part');
  assert.ok(z.email().safeParse(`${user}@${domain}`).success, 'parts do not form a valid email');
});

test('a resume that breaks the schema fails, naming the field', () => {
  const resume = yaml.load(fs.readFileSync(validFixture, 'utf8')) as { work: { position?: string }[] };
  delete resume.work[0].position;
  const file = tempFile('resume.yaml', yaml.dump(resume));
  assert.throws(
    () => getResume(file),
    (error: Error) =>
      error instanceof ResumeDataError &&
      error.message.includes('does not match the resume schema') &&
      error.message.includes('work[0].position'),
  );
});

test('unparseable YAML fails with "Could not read"', () => {
  const file = tempFile('resume.yaml', 'basics: [unclosed');
  assert.throws(
    () => getResume(file),
    (error: Error) => error instanceof ResumeDataError && /Could not read/.test(error.message),
  );
});
