// The Content-Security-Policy and security headers (Task 2.14) in a real browser. playwright.config.ts serves the build
// with `wrangler dev`, which applies dist/_headers exactly as Cloudflare does, so every page here gets the real CSP.
// That the policy lists the hash of every inline script and style is checked on dist/ by tests/csp.test.ts (npm test).
//
// On /, /resume and the 404 page, in both themes: no CSP violation event, no "Refused to" console message, the
// no-flash script applies a saved theme before first paint, the toggle and Copy work, and the fonts load. Last, an
// inline script added to the HTML is blocked, which proves the policy is enforced (not report-only, not ignored).
// The real email address is never printed: comparisons with it report only true/false.

import fs from 'node:fs';
import { type Page } from '@playwright/test';
import { expect, test } from './fixtures.ts';
import { parseHeaders } from '../../scripts/csp/csp.mts';
import { joinEmail } from '../../src/lib/email-client.ts';
import { getEmailParts } from '../../src/lib/resume.ts';
import { THEMES, THEME_STORAGE_KEY, nextTheme, type Theme } from '../../src/lib/theme.ts';
import {
  cspViolations,
  expectCopyIconSwap,
  expectTheme,
  expectToggleFor,
  themeToggle,
  watchSecurityErrors,
} from './helpers.ts';

const ADDRESS = joinEmail(getEmailParts());

// The headers public/_headers sets, as served (Task 2.16: the live run checks them on the deployed site). The CSP line
// there is the fail-closed template the build replaces, so it's checked by its own regex below instead.
const HEADER_RULES = parseHeaders(fs.readFileSync('public/_headers', 'utf8'));
const ruleHeaders = (rulePath: string) => {
  const rule = HEADER_RULES.find((r) => r.path === rulePath);
  if (!rule) throw new Error(`public/_headers has no ${rulePath} rule`);
  return rule.headers;
};
const SITE_HEADERS = ruleHeaders('/*').filter(({ name }) => name.toLowerCase() !== 'content-security-policy');

const PAGES = [
  { path: '/', status: 200, copy: true },
  { path: '/resume', status: 200, copy: true },
  { path: '/no-such-page', status: 404, copy: false },
];

declare global {
  interface Window {
    __injected?: boolean;
  }
}

/** Saves a theme before the page loads, and records <html data-theme> the moment <body> is inserted. */
async function saveThemeBeforeLoad(page: Page, theme: Theme): Promise<void> {
  await page.addInitScript(
    ([key, value]) => {
      localStorage.setItem(key, value);
      new MutationObserver((_, observer) => {
        if (!document.body) return;
        document.documentElement.dataset.themeAtBody = document.documentElement.dataset.theme ?? 'none';
        observer.disconnect();
      }).observe(document, { childList: true, subtree: true });
    },
    [THEME_STORAGE_KEY, theme] as const,
  );
}

/** Every @font-face of the site's two families loads (a font-src block would reject the load). */
async function expectFontsLoad(page: Page): Promise<void> {
  const fonts = await page.evaluate(async () => {
    await document.fonts.ready;
    // The self-hosted files only: Astro also adds metric-matched "<family> fallback: Arial" faces, which use local().
    const faces = [...document.fonts].filter((face) => /^"?(Inter|JetBrains Mono)-[0-9a-f]+"?$/.test(face.family));
    // The body text font, used on every page, has loaded on its own.
    const bodyLoaded = faces.some((face) => face.family.startsWith('Inter') && face.status === 'loaded');
    // The rest load on demand; load them all to prove font-src allows every file.
    const results = await Promise.all(
      faces.map((face) =>
        face.load().then(
          () => 'loaded',
          () => 'error',
        ),
      ),
    );
    return {
      families: [...new Set(faces.map((face) => face.family.replace(/-[0-9a-f]+"?$/, '')))],
      bodyLoaded,
      results,
    };
  });
  expect(fonts.families.map((family) => family.replace(/^"/, '')).sort()).toEqual(['Inter', 'JetBrains Mono']);
  expect(fonts.bodyLoaded).toBe(true);
  expect(fonts.results.every((result) => result === 'loaded')).toBe(true);
}

for (const { path, status, copy } of PAGES) {
  for (const saved of THEMES) {
    test.describe(`${path}, saved theme ${saved}`, () => {
      test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

      test('the CSP is sent, nothing is blocked, and the theme, toggle, Copy and fonts work', async ({ page }) => {
        const consoleErrors = await watchSecurityErrors(page);
        // The OS asks for the other theme, so only the inline no-flash script can produce the saved one.
        await page.emulateMedia({ colorScheme: nextTheme(saved) });
        await saveThemeBeforeLoad(page, saved);
        await page.clock.install();

        const response = await page.goto(path);
        expect(response?.status()).toBe(status);
        const headers = response?.headers() ?? {};
        expect(headers['content-security-policy']).toMatch(
          /^default-src 'self'; script-src 'self' https:\/\/static\.cloudflareinsights\.com\/beacon\.min\.js 'sha256-/,
        );
        expect(headers['content-security-policy-report-only']).toBeUndefined();

        // The no-flash script ran before first paint.
        const html = page.locator('html');
        await expect(html).toHaveAttribute('data-theme-at-body', saved);
        await expectTheme(page, saved);
        await expectToggleFor(page, saved);

        // The toggle's module script runs.
        await themeToggle(page).click();
        await expectTheme(page, nextTheme(saved));

        if (copy) {
          const button = page.locator('button[data-email-copy]').first();
          await button.scrollIntoViewIfNeeded();
          await expectCopyIconSwap(page, button, ADDRESS);
        }

        await expectFontsLoad(page);

        expect(await cspViolations(page)).toEqual([]);
        expect(consoleErrors).toEqual([]);
      });
    });
  }
}

for (const { path, status } of PAGES) {
  test(`${path} sends every header from public/_headers with its exact value`, async ({ request }) => {
    const response = await request.get(path);
    expect(response.status()).toBe(status);
    const headers = response.headers();
    expect(SITE_HEADERS.length).toBeGreaterThan(5);
    for (const { name, value } of SITE_HEADERS) expect(headers[name.toLowerCase()], name).toBe(value);
  });
}

test('/resume.pdf is a PDF with the headers of its _headers rule', async ({ request }) => {
  const response = await request.get('/resume.pdf');
  expect(response.status()).toBe(200);
  const headers = response.headers();
  expect(headers['content-type']).toBe('application/pdf');
  for (const { name, value } of ruleHeaders('/resume.pdf')) expect(headers[name.toLowerCase()], name).toBe(value);
});

test('the watcher catches a Permissions-Policy feature name the browser does not know', async ({ page }) => {
  const consoleErrors = await watchSecurityErrors(page);
  // Only this header changes; the others, CSP included, stay as served.
  await page.route('/', async (route) => {
    const response = await route.fetch();
    const headers = { ...response.headers(), 'permissions-policy': 'not-a-real-feature=(), camera=()' };
    await route.fulfill({ response, headers });
  });

  await page.goto('/');
  await expect(themeToggle(page)).toBeVisible();
  await expect
    .poll(() => consoleErrors.some((text) => /Unrecognized feature.*not-a-real-feature/.test(text)))
    .toBe(true);
});

test('an inline script and a style attribute added to the HTML are blocked', async ({ page }) => {
  const consoleErrors = await watchSecurityErrors(page);
  // Only the body changes: the response keeps its real headers, CSP included.
  await page.route('/', async (route) => {
    const response = await route.fetch();
    const body = (await response.text()).replace(
      '</body>',
      '<div id="injected-style" style="display: none">x</div><script>window.__injected = true;</script></body>',
    );
    await route.fulfill({ response, body });
  });

  await page.goto('/');
  // The site's own scripts still run.
  await expect(themeToggle(page)).toHaveAccessibleName(/^Switch to (light|dark) theme$/);

  expect(await page.evaluate(() => window.__injected)).toBeUndefined();
  await expect(page.locator('#injected-style')).toBeVisible();
  const violations = await cspViolations(page);
  expect(violations).toContain('script-src-elem blocked inline');
  expect(violations).toContain('style-src-attr blocked inline');
  // The browser also reports it in the console, which is what the other tests listen for.
  expect(consoleErrors.some((text) => /Refused to|violates the following Content Security Policy/.test(text))).toBe(
    true,
  );
});
