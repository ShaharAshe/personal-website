// The live smoke run (npm run test:live) and live review screenshots (npm run screenshots:live): a read-only subset of
// the e2e suite against the deployed site, with Cloudflare's real headers, CSP and 404 handling (Task 2.16).
//
// Everything else is playwright.config.ts as is (Edge locally, 1 worker, no retries). The base URL is astro's `site`,
// so after the switch to the custom domain (plan.md Task 4.2) this checks the domain with no other change. No local
// server is started.
//
// No analytics: every spec takes `test` from tests/e2e/fixtures.ts, which stops every request to
// *.cloudflareinsights.com before it leaves the browser (tests/e2e-fixtures.test.ts enforces the import).

import { defineConfig } from '@playwright/test';
import base from './playwright.config.ts';
import astroConfig from './astro.config.mjs';

/** The specs the live run reuses, unchanged. All read-only: the site is static, there is nothing to write to. */
export const LIVE_SPECS = [
  // Status codes of /, /resume and the 404; the CSP and every other security header; no CSP or header console
  // errors; the saved theme, the toggle, Copy and the fonts; /resume.pdf's headers.
  'csp.spec.ts',
  // The beacon is on every page and the live CSP allows it; the fixture stops it, so no visit is sent.
  'analytics.spec.ts',
  // sitemap.xml, robots.txt, the OG image, favicon.ico and apple-touch-icon.png; the header layout.
  'seo.spec.ts',
  // Unknown paths, nested ones included, answer 404 with the styled page.
  'not-found.spec.ts',
  // The Download Resume and Download PDF links, Copy, the print stylesheet, the no-JavaScript fallback.
  'hero.spec.ts',
  'resume.spec.ts',
  // The console greeting (F.1): logged once on / and the 404 with no unexpected console problem, absent on /resume.
  'console-greeting.spec.ts',
  // The CTF chain (F.2), solved from what a visitor sees; checks that production serves /.well-known/ as text/plain.
  'ctf.spec.ts',
  // The 404 game (F.3): loads only on Play, plays, ends, restarts; no game on / or /resume; no CSP violation.
  'game.spec.ts',
  // Motion (Task 3.4): the section entrance (and nothing hidden without JS, in print or for a /#hash), the card hover,
  // the theme/terminal crossfade and the page transition, nothing with reduced motion, no layout shift, all under the
  // real CSP.
  'motion.spec.ts',
  // Font loading (Task 3.4a): /_astro/* cached immutable and nothing unhashed; fonts ready at first render with a warm
  // cache; no unused preload in either style; the fallbacks and the forced swap's layout shift.
  'fonts.spec.ts',
];

const channel = base.projects?.[0]?.use?.channel;

export default defineConfig({
  ...base,
  // Its own folders, so a live run doesn't overwrite the local run's report (both gitignored).
  outputDir: 'test-results/live',
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report/live' }]],
  use: { ...base.use, baseURL: astroConfig.site },
  projects: [
    { name: 'live', testMatch: LIVE_SPECS, use: { channel } },
    { name: 'live-screenshots', testMatch: 'review-screenshots.ts', use: { channel } },
  ],
  webServer: undefined,
});
