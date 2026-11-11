// Skills (Task 2.7, restyled as a card before 2.14) in a real browser. On / and /resume, at 375px, 640px and
// 1280px in both themes, there's no horizontal scroll and every skill chip is fully inside the viewport width; on
// the homepage every chip is also inside the card. At 375px a long item wraps inside its chip without leaving the
// card. What the built HTML contains is checked by tests/skills.test.ts and tests/resume-page.test.ts (npm test).
// The expected item count comes from the resume, never a fixed number.

import { expect, test } from '@playwright/test';
import { THEMES } from '../../src/lib/theme.ts';
import { getResume } from '../../src/lib/resume.ts';
import { expectTheme } from './helpers.ts';

const itemCount = getResume().skills.reduce((sum, { items }) => sum + items.length, 0);

for (const width of [375, 640, 1280]) {
  for (const theme of THEMES) {
    test.describe(`Skills at ${width}px, ${theme}`, () => {
      test.use({ viewport: { width, height: 800 }, colorScheme: theme });

      for (const url of ['/', '/resume']) {
        test(`${url}: no horizontal scroll; every skill is visible and inside the viewport width`, async ({ page }) => {
          await page.goto(url);
          await expectTheme(page, theme);

          const { scrollWidth, clientWidth } = await page.evaluate(() => ({
            scrollWidth: document.documentElement.scrollWidth,
            clientWidth: document.documentElement.clientWidth,
          }));
          expect(scrollWidth).toBeLessThanOrEqual(clientWidth);

          const section = page.locator('#skills');
          await expect(section.getByRole('heading', { level: 2, name: 'Skills' })).toBeVisible();

          const items = section.locator('[data-skill]');
          if (url === '/') await expect(items).toHaveCount(itemCount);
          else expect(await items.count()).toBeGreaterThan(itemCount); // plus the spoken languages

          const card = url === '/' ? await section.locator('[data-skills-card]').boundingBox() : null;
          if (url === '/') expect(card).not.toBeNull();
          else await expect(section.locator('[data-skills-card]')).toHaveCount(0);

          for (const item of await items.all()) {
            await expect(item).toBeVisible();
            const box = await item.boundingBox();
            expect(box).not.toBeNull();
            expect(box!.x).toBeGreaterThanOrEqual(0);
            expect(box!.x + box!.width).toBeLessThanOrEqual(width);
            if (card) {
              expect(box!.x).toBeGreaterThanOrEqual(card.x);
              expect(box!.x + box!.width).toBeLessThanOrEqual(card.x + card.width);
            }
          }
        });
      }
    });
  }
}

test.describe('Skills long item at 375px', () => {
  test.use({ viewport: { width: 375, height: 800 } });

  test('a long item wraps inside its chip and stays inside the card', async ({ page }) => {
    await page.goto('/');
    const card = page.locator('#skills [data-skills-card]');
    // The longest real item, made longer than the card is wide (the real ones fit on one line at 375px).
    const longest = getResume()
      .skills.flatMap(({ items }) => items)
      .reduce((a, b) => (b.length > a.length ? b : a));
    const chip = page.locator('#skills [data-skill]', { hasText: longest }).first();
    const oneLine = (await chip.boundingBox())!.height;
    await chip.evaluate((el, text) => {
      el.textContent = `${text} ${text} ${text}`;
    }, longest);
    // And one unbroken word, which only overflow-wrap:anywhere can break.
    const word = page.locator('#skills [data-skill]').first();
    await word.evaluate((el) => {
      el.textContent = 'x'.repeat(80);
    });

    const cardBox = (await card.boundingBox())!;
    for (const target of [chip, word]) {
      const box = (await target.boundingBox())!;
      expect(box.height).toBeGreaterThan(oneLine * 1.5); // wrapped onto more lines
      expect(box.x).toBeGreaterThanOrEqual(cardBox.x);
      expect(box.x + box.width).toBeLessThanOrEqual(cardBox.x + cardBox.width);
      const { scrollWidth, clientWidth } = await target.evaluate((el) => ({
        scrollWidth: el.scrollWidth,
        clientWidth: el.clientWidth,
      }));
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth); // the text doesn't spill out of the chip
    }
    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
  });
});
