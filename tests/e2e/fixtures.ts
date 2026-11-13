// The `test` every e2e spec and the screenshot script import (not @playwright/test's own; tests/e2e-fixtures.test.ts
// fails if one doesn't). Its `page` stops every request to cloudflareinsights.com and its subdomains before it reaches
// the network, so test runs never count as Web Analytics visits (Task 2.15) and never depend on Cloudflare.
//
// How: CDP request interception (Fetch.enable) limited to those hosts' URL patterns; each paused request is failed
// with BlockedByClient. Set on the page before the test's first navigation, it holds across navigations. Both browsers
// used here (local Edge, CI Chromium) are Chromium. The specs use only this `page`; the guard test fails on a spec that
// opens another page or context, which wouldn't get the block.
//
// Rejected alternatives, both tried:
// - page.route/context.route: with any Playwright route installed, Chromium fails the page's own
//   fetch('/favicon.ico') ("Failed to fetch"), which broke seo.spec.ts.
// - Network.setBlockedURLs (DevTools request blocking): it runs before the CSP check, so a blocked request would look
//   the same whether or not the CSP allowed it.
//
// Interception runs after the CSP check: a request the CSP blocks is never paused. So `analyticsRequests`, the URLs
// this fixture stopped, also proves the CSP allowed each one (tests/e2e/analytics.spec.ts).

import { test as base } from '@playwright/test';
import { BLOCKED_URL_PATTERNS } from './blocked-hosts.ts';

export const test = base.extend<{ analyticsRequests: string[] }>({
  // A fixture needs a destructured first argument, even an empty one.
  analyticsRequests: async ({}, use) => {
    await use([]);
  },
  page: async ({ page, analyticsRequests }, use) => {
    const cdp = await page.context().newCDPSession(page);
    cdp.on('Fetch.requestPaused', ({ requestId, request }) => {
      analyticsRequests.push(request.url);
      // The page may already be gone (test teardown); nothing to fail then.
      cdp.send('Fetch.failRequest', { requestId, errorReason: 'BlockedByClient' }).catch(() => {});
    });
    await cdp.send('Fetch.enable', { patterns: BLOCKED_URL_PATTERNS.map((urlPattern) => ({ urlPattern })) });
    await use(page);
  },
});

export { expect } from '@playwright/test';
