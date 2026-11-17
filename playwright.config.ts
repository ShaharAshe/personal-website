// Playwright end-to-end tests (npm run test:e2e) and review screenshots (npm run screenshots), run
// against the production build served by `wrangler dev`: Cloudflare's own static-assets server, run locally (no
// login). Unlike `astro preview` it applies dist/_headers (the CSP and the other security headers, Task 2.14),
// not_found_handling and html_handling exactly as production does, so a CSP that breaks the site fails these tests.
// Only checks that need a real browser live here; checks on the built HTML are node:test tests (npm test).
//
// Locally the installed Microsoft Edge is used (no browser download); CI installs Playwright's Chromium.

import { defineConfig } from '@playwright/test';
import { DOODLE_PORT, doodleServerCommand } from './scripts/doodles/doodle-server.ts';

const isCI = !!process.env.CI;

// Not Astro's default 4321: `npm run dev` uses that too, and reusing a dev server would test dev output
// instead of the build. To reuse a running server locally: npx wrangler dev --port 4322 --ip 127.0.0.1
// (not `npm run preview`: astro preview sends none of the headers in dist/_headers).
const port = 4322;
// 127.0.0.1, not localhost: wrangler dev listens on IPv4 only, and localhost can resolve to ::1 first.
const baseURL = `http://127.0.0.1:${port}`;
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
    // Every doodle in turn (Task F.4): run by npm run screenshots:doodles, which rebuilds dist-doodle/ for each.
    { name: 'doodle-screenshots', testMatch: 'doodle-screenshots.ts', use: { channel } },
  ],
  webServer: [
    {
      // require-build.ts fails with "run npm run build first" when dist/ is missing.
      // wrangler.jsonc serves ./dist. --show-interactive-dev-session=false: no keyboard-shortcut prompt (no TTY here).
      command: `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/checks/require-build.ts && npx wrangler dev --port ${port} --ip 127.0.0.1 --show-interactive-dev-session=false`,
      url: baseURL,
      reuseExistingServer: !isCI,
      // No usage metrics from test runs.
      env: { WRANGLER_SEND_METRICS: 'false' },
    },
    {
      // The doodle preview build (Task F.4, npm run doodle:build), for tests/e2e/doodle.spec.ts and the doodle
      // screenshots: dist-doodle/ with its own _headers (the real CSP), on its own port. Never reused, so a rebuilt
      // dist-doodle/ (npm run screenshots:doodles builds one per doodle) is always the one served.
      command: `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/doodles/require.ts && ${doodleServerCommand()}`,
      url: `http://127.0.0.1:${DOODLE_PORT}`,
      reuseExistingServer: false,
      env: { WRANGLER_SEND_METRICS: 'false' },
    },
  ],
});
