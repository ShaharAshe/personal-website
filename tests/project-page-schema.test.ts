// Tests for the project page frontmatter schema (src/data/project-page.schema.ts), used by the
// `projects` content collection in src/content.config.ts.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { projectPageSchema } from '../src/data/project-page.schema.ts';

const issues = (frontmatter: unknown) => {
  const result = projectPageSchema.safeParse(frontmatter);
  assert.equal(result.success, false, 'should fail validation');
  return result.error!.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);
};

test('accepts every override field', () => {
  const frontmatter = {
    title: 'Log Analytics Platform',
    description: 'A longer description than the one on GitHub.',
    status: 'In progress',
    team: '2 developers',
  };
  assert.deepEqual(projectPageSchema.parse(frontmatter), frontmatter);
});

test('accepts empty frontmatter: every field is optional', () => {
  assert.deepEqual(projectPageSchema.parse({}), {});
});

test('rejects an unknown field', () => {
  assert.deepEqual(issues({ status: 'In progress', stars: 5 }), [': Unrecognized key: "stars"']);
});

test('rejects a wrong type', () => {
  assert.deepEqual(issues({ status: 123 }), ['status: Invalid input: expected string, received number']);
});

test('rejects an empty string', () => {
  assert.equal(issues({ team: '  ' }).length, 1);
});
