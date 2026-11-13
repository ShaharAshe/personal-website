// Cloudflare Web Analytics (Task 2.15) in a real browser, with the real CSP (wrangler dev applies dist/_headers).
// tests/e2e/fixtures.ts stops every request to *.cloudflareinsights.com, so these runs send no visits. Its
// interception runs after the CSP check, so a URL in analyticsRequests was allowed by the CSP and then stopped by the
// test. The last test is the control: with the beacon taken out of the served CSP, the request never gets that far.
// The tag itself on every built page is checked by tests/analytics.test.ts (npm test).

import { CF_BEACON_SRC, CF_BEACON_TOKEN } from '../../src/lib/analytics.ts';
import { expect, test } from './fixtures.ts';
import { cspViolations, themeToggle, watchSecurityErrors } from './helpers.ts';

const PAGES = [
  { path: '/', status: 200 },
  { path: '/resume', status: 200 },
  { path: '/no-such-page', status: 404 },
];

for (const { path, status } of PAGES) {
  test(`${path}: the beacon tag is there, the CSP allows it, and the test blocks the request`, async ({
    page,
    analyticsRequests,
  }) => {
    const consoleErrors = await watchSecurityErrors(page);

    const response = await page.goto(path);
    expect(response?.status()).toBe(status);

    const beacon = page.locator('script[data-cf-beacon]');
    await expect(beacon).toHaveCount(1);
    await expect(beacon).toHaveAttribute('type', 'module');
    await expect(beacon).toHaveAttribute('src', CF_BEACON_SRC);
    expect(JSON.parse((await beacon.getAttribute('data-cf-beacon')) ?? '')).toEqual({ token: CF_BEACON_TOKEN });

    // The browser asked for the script (so the CSP allowed it), and the test's block stopped it.
    await expect.poll(() => analyticsRequests).toEqual([CF_BEACON_SRC]);

    // The site's own scripts still run.
    await expect(themeToggle(page)).toHaveAccessibleName(/^Switch to (light|dark) theme$/);
    expect(await cspViolations(page)).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });
}

test('a report to cloudflareinsights.com is allowed by connect-src and blocked by the test', async ({
  page,
  analyticsRequests,
}) => {
  const consoleErrors = await watchSecurityErrors(page);
  await page.goto('/');

  const endpoint = 'https://cloudflareinsights.com/cdn-cgi/rum';
  const result = await page.evaluate(
    (url) =>
      fetch(url, { method: 'POST', body: '{}' }).then(
        () => 'sent',
        (error: unknown) => `failed: ${String(error)}`,
      ),
    endpoint,
  );
  expect(result).toMatch(/^failed/);
  await expect.poll(() => analyticsRequests).toContain(endpoint);
  expect(await cspViolations(page)).toEqual([]);
  expect(consoleErrors).toEqual([]);
});

test('control: with the beacon removed from the served CSP, the browser blocks it and never requests it', async ({
  page,
  analyticsRequests,
}) => {
  // Only the CSP header of / changes; the HTML and the other headers stay as served.
  await page.route('/', async (route) => {
    const response = await route.fetch();
    const headers = response.headers();
    const policy = headers['content-security-policy'] ?? '';
    expect(policy).toContain(` ${CF_BEACON_SRC} `);
    headers['content-security-policy'] = policy.replace(` ${CF_BEACON_SRC}`, '');
    await route.fulfill({ response, headers });
  });
  await watchSecurityErrors(page);

  await page.goto('/');
  await expect.poll(() => cspViolations(page)).toContain(`script-src-elem blocked ${CF_BEACON_SRC}`);
  expect(analyticsRequests).toEqual([]);
});
