// Skills (Task 2.7) in a real browser: at 375px and 1280px in both themes there's no horizontal scroll and
// every skill chip is fully inside the viewport width. What the built HTML contains is checked by
// tests/skills.test.ts (npm test). The expected item count comes from the resume, never a fixed number.

import { expect, test } from '@playwright/test';
import { THEMES } from '../../src/lib/theme.ts';
import { getResume } from '../../src/lib/resume.ts';
import { expectTheme } from './helpers.ts';

const itemCount = getResume().skills.reduce((sum, { items }) => sum + items.length, 0);

for (const width of [375, 1280]) {
  for (const theme of THEMES) {
    test.describe(`Skills at ${width}px, ${theme}`, () => {
      test.use({ viewport: { width, height: 800 }, colorScheme: theme });

      test('no horizontal scroll; every skill is visible and inside the viewport width', async ({ page }) => {
        await page.goto('/');
        await expectTheme(page, theme);

        const { scrollWidth, clientWidth } = await page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
        }));
        expect(scrollWidth).toBeLessThanOrEqual(clientWidth);

        const section = page.locator('#skills');
        await expect(section.getByRole('heading', { level: 2, name: 'Skills' })).toBeVisible();

        const items = section.locator('[data-skill]');
        await expect(items).toHaveCount(itemCount);
        for (const item of await items.all()) {
          await expect(item).toBeVisible();
          const box = await item.boundingBox();
          expect(box).not.toBeNull();
          expect(box!.x).toBeGreaterThanOrEqual(0);
          expect(box!.x + box!.width).toBeLessThanOrEqual(width);
        }
      });
    });
  }
}
