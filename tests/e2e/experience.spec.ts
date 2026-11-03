// Experience (Task 2.6) in a real browser: the nav link scrolls to it, the full-resume link is reachable by
// keyboard with a focus ring, and the layout at 375px and 1280px in both themes. What the built HTML contains
// is checked by tests/experience.test.ts (npm test).

import { expect, test, type Page } from '@playwright/test';
import { THEMES } from '../../src/lib/theme.ts';
import { expectFocusRing, expectTheme } from './helpers.ts';

const experience = (page: Page) => page.locator('#experience');
const fullResume = (page: Page) => experience(page).getByRole('link', { name: /^View full resume/ });

test('the nav "Experience" link brings the section into view', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Experience' }).click();
  await expect(page).toHaveURL(/#experience$/);
  await expect(experience(page).getByRole('heading', { level: 2, name: 'Experience' })).toBeInViewport();
});

test('keyboard: after the Hero email icon (its last stop), Tab reaches the full-resume link with a focus ring', async ({
  page,
}) => {
  await page.goto('/');
  const last = page.locator('[data-hero]').getByRole('link', { name: 'Email', exact: true });
  // Focus by keyboard (Shift+Tab, Tab), so :focus-visible applies.
  await last.focus();
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Tab');
  await expect(last).toBeFocused();

  await page.keyboard.press('Tab');
  await expect(fullResume(page)).toHaveAttribute('href', '/resume');
  await expectFocusRing(fullResume(page));
});

for (const width of [375, 1280]) {
  for (const theme of THEMES) {
    test.describe(`Experience at ${width}px, ${theme}`, () => {
      test.use({ viewport: { width, height: 800 }, colorScheme: theme });

      test('no horizontal scroll; the section and the link fit the viewport width', async ({ page }) => {
        await page.goto('/');
        await expectTheme(page, theme);

        const { scrollWidth, clientWidth } = await page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
        }));
        expect(scrollWidth).toBeLessThanOrEqual(clientWidth);

        for (const locator of [experience(page), fullResume(page)]) {
          const box = await locator.boundingBox();
          expect(box).not.toBeNull();
          expect(box!.x).toBeGreaterThanOrEqual(0);
          expect(box!.x + box!.width).toBeLessThanOrEqual(width);
        }
      });
    });
  }
}
