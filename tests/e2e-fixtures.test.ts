// Every e2e spec and the screenshot script must take `test` from tests/e2e/fixtures.ts, whose `page` blocks every
// request to *.cloudflareinsights.com (Task 2.15). A file that imported @playwright/test's own `test`
// would load the real Web Analytics beacon and send a visit from every run.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { BLOCKED_URL_PATTERNS } from './e2e/blocked-hosts.ts';

const E2E = path.join(import.meta.dirname, 'e2e');
const files = fs
  .readdirSync(E2E)
  .filter((file) => file.endsWith('.spec.ts') || file === 'review-screenshots.ts')
  .sort();

test('the e2e folder has specs and the screenshot script', () => {
  assert.ok(files.length > 1);
  assert.ok(files.includes('review-screenshots.ts'));
  assert.ok(files.includes('analytics.spec.ts'));
});

for (const file of files) {
  test(`${file} takes test from ./fixtures.ts, not @playwright/test`, () => {
    const source = fs.readFileSync(path.join(E2E, file), 'utf8');
    assert.match(source, /import \{[^}]*\btest\b[^}]*\} from '\.\/fixtures\.ts';/);
    for (const [, names = ''] of source.matchAll(/import \{([^}]*)\} from '@playwright\/test';/g)) {
      const values = names
        .split(',')
        .map((name) => name.trim())
        .filter((name) => name && !name.startsWith('type '));
      assert.deepEqual(values, [], `${file} imports values from @playwright/test: ${values.join(', ')}`);
    }
    // The block is set on the fixture's page only; another page or context wouldn't have it.
    assert.doesNotMatch(
      source,
      /\.newPage\(|\.newContext\(|\blaunch\(/,
      `${file} opens a page the block doesn't cover`,
    );
  });
}

// CDP Fetch URL patterns: * matches any run of characters.
const wildcard = (pattern: string) =>
  new RegExp(`^${pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}$`);
const blocked = (url: string) => BLOCKED_URL_PATTERNS.some((pattern) => wildcard(pattern).test(url));

test('the blocked patterns cover the beacon script and the report endpoint, and nothing else', () => {
  for (const url of [
    'https://static.cloudflareinsights.com/beacon.min.js',
    'https://cloudflareinsights.com/cdn-cgi/rum',
  ]) {
    assert.ok(blocked(url), url);
  }
  for (const url of [
    'http://127.0.0.1:4322/',
    'https://cloudflareinsights.com.example.com/x',
    'https://notcloudflareinsights.com/beacon.min.js',
  ]) {
    assert.ok(!blocked(url), url);
  }
});
