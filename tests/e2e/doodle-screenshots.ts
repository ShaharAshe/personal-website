// Review screenshots of the doodle (Task F.4), not assertions: the Hero of the doodle preview build (dist-doodle/),
// closed and with the bubble open, at 375px and 1280px in both themes. npm run screenshots:doodles runs this once per
// doodle, rebuilding dist-doodle/ in between; files are named after the doodle the build has. Writes screenshots/
// (gitignored). The normal Hero is in review-screenshots.ts (npm run screenshots).

import { expect, test } from './fixtures.ts';
import { DOODLE_PORT } from '../../scripts/doodles/doodle-server.ts';
import { THEMES } from '../../src/lib/theme.ts';

const OUT_DIR = 'screenshots';

test.use({ baseURL: `http://127.0.0.1:${DOODLE_PORT}` });

for (const width of [375, 1280]) {
  for (const theme of THEMES) {
    test.describe(`${width}px ${theme}`, () => {
      // Reduced motion: the bubble's short fade-in is off, so the open shot isn't caught mid-fade. The shape is the
      // same either way (it moves only while playing).
      test.use({ viewport: { width, height: 800 }, colorScheme: theme, reducedMotion: 'reduce' });

      test('doodle', async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => document.fonts.ready);
        const id = await page.locator('[data-doodle]').getAttribute('data-doodle');
        const hero = (await page.locator('[data-hero]').boundingBox())!;
        // The Hero plus room below it for the open bubble.
        const clip = { x: 0, y: 0, width, height: hero.y + hero.height + 140 };
        await page.screenshot({ path: `${OUT_DIR}/doodle-${id}-${width}-${theme}.png`, clip });
        await page.locator('[data-doodle-link]').hover();
        await page.locator('[data-doodle-bubble]').waitFor({ state: 'visible' });
        await page.screenshot({ path: `${OUT_DIR}/doodle-${id}-${width}-${theme}-bubble.png`, clip });
      });
    });
  }
}

// The animation, frozen at a few points (Web Animations' currentTime), to check each motion looks right: the doodle
// alone, enlarged ×3, 1280px dark only.
test.describe('motion', () => {
  test.use({ viewport: { width: 1280, height: 800 }, colorScheme: 'dark', deviceScaleFactor: 3 });

  test('doodle mid-animation', async ({ page }) => {
    await page.goto('/');
    const root = page.locator('[data-doodle]');
    const id = await root.getAttribute('data-doodle');
    await page.locator('[data-doodle-link]').hover();
    await expect(root).toHaveAttribute('data-doodle-state', 'playing');
    for (const at of [0.2, 0.4, 0.6, 0.8]) {
      await page.evaluate((fraction) => {
        for (const animation of document.getAnimations()) {
          animation.pause();
          animation.currentTime = Number(animation.effect?.getTiming().duration) * fraction;
        }
      }, at);
      await page
        .locator('[data-doodle-link] svg')
        .screenshot({ path: `${OUT_DIR}/doodle-${id}-motion-${at * 100}.png` });
    }
  });
});
