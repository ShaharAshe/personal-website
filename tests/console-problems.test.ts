// The e2e console filter (tests/e2e/console-problems.ts): only the blocked beacon and, on the 404 page, the page's own
// 404 are ignored; any other failed request, warning or error is reported.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { unexpectedConsoleProblems, type ConsoleEntry } from './e2e/console-problems.ts';

const ORIGIN = 'http://127.0.0.1:4322';
const PAGE_404 = `${ORIGIN}/no-such-page`;
const BEACON = {
  type: 'error',
  text: 'Failed to load resource: net::ERR_BLOCKED_BY_CLIENT.Inspector',
  url: 'https://static.cloudflareinsights.com/beacon.min.js',
};
const OWN_404 = {
  type: 'error',
  text: 'Failed to load resource: the server responded with a status of 404 (Not Found)',
  url: PAGE_404,
};
const missing = (file: string): ConsoleEntry => ({ ...OWN_404, url: `${ORIGIN}/_astro/${file}` });

test('the blocked beacon request is ignored on every page', () => {
  assert.deepEqual(unexpectedConsoleProblems([BEACON]), []);
  assert.deepEqual(unexpectedConsoleProblems([BEACON], { expected404Url: PAGE_404 }), []);
});

test("the 404 page's own 404 is ignored only where it's expected", () => {
  assert.deepEqual(unexpectedConsoleProblems([OWN_404], { expected404Url: PAGE_404 }), []);
  assert.equal(unexpectedConsoleProblems([OWN_404]).length, 1);
  assert.equal(unexpectedConsoleProblems([OWN_404], { expected404Url: `${ORIGIN}/other` }).length, 1);
});

test('a missing CSS, font or script still fails, on the 404 page too', () => {
  const entries = [missing('missing.css'), missing('inter.woff2'), missing('page.js')];
  assert.equal(unexpectedConsoleProblems(entries).length, 3);
  assert.deepEqual(unexpectedConsoleProblems([BEACON, OWN_404, missing('missing.css')], { expected404Url: PAGE_404 }), [
    `${OWN_404.text} (${ORIGIN}/_astro/missing.css)`,
  ]);
});

test('a look-alike host, another failure on the beacon URL, page warnings and errors all fail; logs pass', () => {
  const entries: ConsoleEntry[] = [
    { ...BEACON, url: 'https://notcloudflareinsights.com/beacon.min.js' },
    { type: 'warning', text: 'Failed to load resource: something', url: BEACON.url },
    { type: 'error', text: 'Uncaught TypeError: x is undefined', url: `${ORIGIN}/` },
    { type: 'warning', text: 'deprecated API', url: `${ORIGIN}/` },
  ];
  assert.equal(unexpectedConsoleProblems(entries).length, 4);
  assert.deepEqual(unexpectedConsoleProblems([{ type: 'log', text: 'hello', url: `${ORIGIN}/` }]), []);
});
