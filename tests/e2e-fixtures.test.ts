// Every e2e spec and the screenshot script must take `test` from tests/e2e/fixtures.ts, whose `page` blocks every
// request to *.cloudflareinsights.com (Task 2.15). A file that imported @playwright/test's own `test`
// would load the real Web Analytics beacon and send a visit from every run.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { isBlockedUrl } from './e2e/blocked-hosts.ts';

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

const blocked = isBlockedUrl;

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

// The live smoke run (npm run test:live, Task 2.16) reuses specs from tests/e2e/ against the deployed site. It must
// start no local server, point at astro's `site`, and run only files the import guard above covers.
test('playwright.live.config.ts targets the site URL with no local server, and runs only guarded files', async () => {
  const { default: live, LIVE_SPECS } = await import('../playwright.live.config.ts');
  const { default: astroConfig } = await import('../astro.config.mjs');
  assert.equal(live.webServer, undefined);
  assert.ok(astroConfig.site?.startsWith('https://'));
  assert.equal(live.use?.baseURL, astroConfig.site);
  assert.deepEqual(
    live.projects?.map((project) => project.name),
    ['live', 'live-screenshots'],
  );
  assert.deepEqual(live.projects?.[0]?.testMatch, LIVE_SPECS);
  assert.ok(LIVE_SPECS.length > 0);
  for (const spec of LIVE_SPECS) assert.ok(files.includes(spec), `${spec} is not a guarded file in tests/e2e/`);
  assert.ok(files.includes(live.projects?.[1]?.testMatch as string));
});
