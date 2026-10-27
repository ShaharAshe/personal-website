// Playwright end-to-end tests (npm run test:e2e) and review screenshots (npm run screenshots), run
// against the production build served by `astro preview`. Only checks that need a real browser live
// here; checks on the built HTML are node:test tests (npm test).
//
// Locally the installed Microsoft Edge is used (no browser download); CI installs Playwright's Chromium.

import { defineConfig } from '@playwright/test';

const isCI = !!process.env.CI;

// Not Astro's default 4321: `npm run dev` uses that too, and reusing a dev server would test dev output
// instead of the build. To reuse a running server locally: npm run preview -- --port 4322
const port = 4322;
const baseURL = `http://localhost:${port}`;
const channel = isCI ? undefined : 'msedge';

export default defineConfig({
  testDir: 'tests/e2e',
  // One browser at a time: measured locally, 1 worker runs the suite in ~11s vs ~31s with 4 (parallel
  // Edge instances slow each other down). CI's 2-core runner gets 1 worker by default anyway.
  workers: 1,
  forbidOnly: isCI,
  // A flaky test should be fixed, not retried until it passes.
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { baseURL, trace: 'retain-on-failure' },
  projects: [
    { name: 'e2e', testMatch: '*.spec.ts', use: { channel } },
    { name: 'screenshots', testMatch: 'review-screenshots.ts', use: { channel } },
  ],
  webServer: {
    // require-build.ts fails with "run npm run build first" when dist/ is missing.
    // --ignore-lock keeps astro preview in the foreground; run by an AI agent on Linux/macOS it would background itself and exit.
    command: `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/checks/require-build.ts && npx astro preview --ignore-lock --port ${port}`,
    url: baseURL,
    reuseExistingServer: !isCI,
  },
});
