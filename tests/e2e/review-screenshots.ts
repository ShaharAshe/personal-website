// Review screenshots (npm run screenshots), not assertions: font rendering differs between Windows
// and Linux, so pixel comparisons would be noise. Writes screenshots/*.png (gitignored) to look at
// before saying a UI task is done.

import { test } from '@playwright/test';
import { THEMES } from '../../src/lib/theme.ts';
import { themeToggle } from './helpers.ts';

const WIDTHS = [375, 1280];
const OUT_DIR = 'screenshots';

for (const width of WIDTHS) {
  for (const theme of THEMES) {
    test.describe(`${width}px ${theme}`, () => {
      test.use({ viewport: { width, height: 800 }, colorScheme: theme });

      test('page', async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => document.fonts.ready);
        await page.screenshot({ path: `${OUT_DIR}/${width}-${theme}.png`, fullPage: true });
      });

      test('toggle focused', async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => document.fonts.ready);
        // Keyboard focus, so :focus-visible draws the ring.
        await themeToggle(page).focus();
        await page.keyboard.press('Shift+Tab');
        await page.keyboard.press('Tab');
        await page.screenshot({ path: `${OUT_DIR}/${width}-${theme}-toggle-focused.png` });
      });

      test.describe('with clipboard access', () => {
        test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

        test('contact copied', async ({ page }) => {
          await page.goto('/');
          await page.evaluate(() => document.fonts.ready);
          const button = page.locator('[data-contact] button[data-email-copy]');
          await button.scrollIntoViewIfNeeded();
          // Copy, then Tab-and-back so the button shows "Copied ✓" with its keyboard focus ring.
          await button.focus();
          await page.keyboard.press('Shift+Tab');
          await page.keyboard.press('Tab');
          await page.keyboard.press('Enter');
          await page.locator('[data-copy-done]').waitFor({ state: 'visible' });
          await page.locator('[data-contact]').screenshot({ path: `${OUT_DIR}/${width}-${theme}-contact-copied.png` });
        });
      });
    });
  }
}
