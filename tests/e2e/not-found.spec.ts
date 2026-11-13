// The 404 page (Task 2.12) in a real browser, over astro preview, which serves dist/404.html with status 404 for an
// unknown path, as Cloudflare does with not_found_handling. What the built HTML contains is checked by
// tests/not-found-page.test.ts (npm test).

import { type Page } from '@playwright/test';
import { expect, test } from './fixtures.ts';
import { THEMES } from '../../src/lib/theme.ts';
import { expectTheme } from './helpers.ts';

const heading = (page: Page) => page.getByRole('heading', { level: 1, name: 'Page not found' });

test('an unknown path returns status 404 and shows the 404 heading', async ({ page }) => {
  const response = await page.goto('/no-such-page');
  expect(response?.status()).toBe(404);
  await expect(heading(page)).toBeVisible();
});

test('a nested unknown path returns status 404 and the page is still styled', async ({ page }) => {
  const response = await page.goto('/no/such/page');
  expect(response?.status()).toBe(404);
  await expect(heading(page)).toBeVisible();
  // Display utilities come from the site's stylesheet, so this fails if assets resolve against the nested path.
  await expect(page.locator('[data-not-found-home]')).toHaveCSS('display', 'inline-flex');
  await expect(page.locator('body')).toHaveCSS('display', 'flex');
});

test('the back link goes to the homepage', async ({ page }) => {
  await page.goto('/no-such-page');
  await page.getByRole('link', { name: 'Back to home' }).click();
  await expect(page.locator('[data-hero]')).toBeVisible();
  expect(new URL(page.url()).pathname).toBe('/');
});

test('the footer has no Back to top link', async ({ page }) => {
  await page.goto('/no-such-page');
  const footer = page.getByRole('contentinfo');
  await expect(footer).toBeVisible();
  await expect(footer.getByRole('link', { name: 'Back to top' })).toHaveCount(0);
});

for (const width of [375, 1280]) {
  for (const theme of THEMES) {
    test.describe(`404 at ${width}px, ${theme}`, () => {
      test.use({ viewport: { width, height: 800 }, colorScheme: theme });

      test('no horizontal scroll', async ({ page }) => {
        await page.goto('/no-such-page');
        await expectTheme(page, theme);
        await expect(heading(page)).toBeVisible();
        const { scrollWidth, clientWidth } = await page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
        }));
        expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
      });
    });
  }
}
