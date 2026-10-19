import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { z } from 'astro/zod';
import { resumeSchema } from '../src/data/resume.schema.ts';
import { RESUME_YAML } from '../scripts/cv/paths.js';

const fixtures = path.join(import.meta.dirname, 'fixtures');
const load = (file: string): unknown => yaml.load(fs.readFileSync(file, 'utf8'));

// Validates a fixture and returns its issues as "path: message" strings.
function issues(fixture: string) {
  const result = resumeSchema.safeParse(load(path.join(fixtures, fixture)));
  assert.equal(result.success, false, `${fixture} should fail validation`);
  return result.error!.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);
}

test('accepts the real resume.yaml', () => {
  const result = resumeSchema.safeParse(load(RESUME_YAML));
  if (!result.success) assert.fail(z.prettifyError(result.error));
});

test('accepts the valid fixture', () => {
  assert.ok(resumeSchema.safeParse(load(path.join(fixtures, 'resume-valid.yaml'))).success);
});

test('rejects a phone field', () => {
  assert.deepEqual(issues('resume-with-phone.yaml'), ['basics: Unrecognized key: "phone"']);
});

test('rejects an unquoted date', () => {
  assert.deepEqual(issues('resume-unquoted-date.yaml'), [
    'education.0.startDate: must be a quoted string like "2025-04" or "2021"',
  ]);
});

test('rejects a missing required field', () => {
  assert.deepEqual(issues('resume-missing-position.yaml'), [
    'work.0.position: Invalid input: expected string, received undefined',
  ]);
});

test('rejects a malformed date string', () => {
  const resume = load(path.join(fixtures, 'resume-valid.yaml')) as { work: { startDate: string }[] };
  resume.work[0].startDate = '2024-13';
  assert.equal(resumeSchema.safeParse(resume).success, false);
});

test('validate-resume.ts exits 1 and lists the problem path', () => {
  const result = spawnSync(
    process.execPath,
    [
      '--disable-warning=MODULE_TYPELESS_PACKAGE_JSON',
      path.join(import.meta.dirname, '..', 'scripts', 'cv', 'validate-resume.ts'),
      path.join(fixtures, 'resume-with-phone.yaml'),
    ],
    { encoding: 'utf8' },
  );
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Unrecognized key: "phone"[\s\S]*at basics/);
});
