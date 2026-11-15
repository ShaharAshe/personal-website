// The DevTools console greeting (Task F.1) in a real browser, with the real CSP (`wrangler dev` locally; the deployed
// site in the live run, npm run test:live): on / and the 404 page it's logged exactly once, as a plain log, with no
// unexpected warning or error and no CSP violation. /resume has none. Its text and the dist/ markup are checked in
// tests/console-greeting.test.ts.
//
// Warnings and errors go through unexpectedConsoleProblems() (tests/e2e/console-problems.ts): only the blocked beacon
// and the 404 page's own 404 are ignored, by URL. The last test proves a missing /_astro/ file still fails it.

import { type ConsoleMessage, type Page } from '@playwright/test';
import { expect, test } from './fixtures.ts';
import { OPEN_TO_WORK_LABEL, SA_ASCII, linkedinProfileUrl } from '../../src/lib/console-greeting.ts';
import { githubProfileUrl } from '../../src/lib/projects-section.ts';
import { getResume } from '../../src/lib/resume.ts';
import { OPEN_TO_WORK } from '../../src/lib/site.ts';
import { unexpectedConsoleProblems, type ConsoleEntry } from './console-problems.ts';
import { cspViolations, watchSecurityErrors } from './helpers.ts';

// The same lookups the greeting uses. Without both URLs, isGreeting below would match nothing useful (or, with '',
// every message), so a missing profile stops the spec here.
const { profiles } = getResume().basics;
const LINKEDIN = linkedinProfileUrl(profiles) ?? '';
const GITHUB = githubProfileUrl(profiles) ?? '';
if (!LINKEDIN || !GITHUB) throw new Error('resume.yaml needs a LinkedIn and a GitHub profile');

const isGreeting = (message: ConsoleMessage) => message.text().includes(GITHUB);

/** Records every console message from now on, with what unexpectedConsoleProblems() needs. */
function recordConsole(page: Page) {
  const messages: ConsoleMessage[] = [];
  page.on('console', (message) => messages.push(message));
  const entries = (): ConsoleEntry[] =>
    messages.map((m) => ({ type: m.type(), text: m.text(), url: m.location().url }));
  return { messages, entries };
}

for (const { label, path, is404 } of [
  { label: 'the homepage', path: '/', is404: false },
  { label: 'the 404 page', path: '/no-such-page', is404: true },
]) {
  test(`${label}: logs the greeting exactly once, with no unexpected warning, error or CSP violation`, async ({
    page,
  }) => {
    const securityErrors = await watchSecurityErrors(page);
    const { messages, entries } = recordConsole(page);

    await page.goto(path);
    await page.waitForLoadState('load');

    const greetings = messages.filter(isGreeting);
    expect(greetings).toHaveLength(1);
    const [greeting] = greetings;
    expect(greeting!.type()).toBe('log');
    const text = greeting!.text();
    expect(text).toContain(SA_ASCII[0]);
    // The "Open to work" line (with the LinkedIn link) is there only while the flag is on.
    expect(text.includes(OPEN_TO_WORK_LABEL)).toBe(OPEN_TO_WORK);
    expect(text.includes(LINKEDIN)).toBe(OPEN_TO_WORK);

    expect(unexpectedConsoleProblems(entries(), is404 ? { expected404Url: page.url() } : {})).toEqual([]);
    expect(securityErrors).toEqual([]);
    expect(await cspViolations(page)).toEqual([]);
  });
}

test('/resume: no greeting', async ({ page }) => {
  const { messages } = recordConsole(page);
  await page.goto('/resume');
  await page.waitForLoadState('load');
  expect(messages.filter(isGreeting)).toHaveLength(0);
});

test('a missing /_astro/ file is still reported (the filter ignores only the expected failures)', async ({ page }) => {
  const { entries } = recordConsole(page);
  await page.goto('/');
  await page.waitForLoadState('load');
  const missing = new URL('/_astro/no-such-file.png', page.url()).href;
  // A same-origin image: img-src 'self' allows it, so the only failure is its 404, logged as "Failed to load
  // resource" at its URL. (A stylesheet would come back as the HTML 404 page and be refused on its MIME type instead.)
  await page.evaluate(
    (src) =>
      new Promise<void>((resolve) => {
        const img = document.createElement('img');
        img.addEventListener('error', () => resolve());
        img.addEventListener('load', () => resolve());
        img.src = src;
      }),
    missing,
  );
  await expect
    .poll(() => unexpectedConsoleProblems(entries()))
    .toEqual([
      expect.stringMatching(
        new RegExp(`^Failed to load resource: .*\\b404\\b.* \\(${missing.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}\\)$`),
      ),
    ]);
});
