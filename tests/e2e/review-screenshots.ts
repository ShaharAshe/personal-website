// Review screenshots (npm run screenshots), not assertions: font rendering differs between Windows
// and Linux, so pixel comparisons would be noise. Writes screenshots/*.png (gitignored) to look at
// before saying a UI task is done.

import fs from 'node:fs';
import { test } from './fixtures.ts';
import { readIco } from '../../scripts/og/ico.ts';
import { SITE_ICONS } from '../../src/lib/seo.ts';
import { LOOKS, styleToggle, themeToggle, useLook } from './helpers.ts';

// 640px is sm, where the nav first shows the home link and the layout changes most (Task 2.16).
const WIDTHS = [375, 640, 1280];
const OUT_DIR = 'screenshots';

// Both themes and terminal view (Task F.7). The `theme` in each file name is the look: dark, light or terminal.
for (const width of WIDTHS) {
  for (const look of LOOKS) {
    const theme = look.name;
    test.describe(`${width}px ${theme}`, () => {
      test.use({ viewport: { width, height: 800 }, colorScheme: look.colorScheme });
      test.beforeEach(({ page }) => useLook(page, look));

      test('page', async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => document.fonts.ready);
        await page.screenshot({ path: `${OUT_DIR}/${width}-${theme}.png`, fullPage: true });
      });

      test('resume page', async ({ page }) => {
        await page.goto('/resume');
        await page.evaluate(() => document.fonts.ready);
        await page.locator('[data-resume] [data-email-address]').waitFor({ state: 'visible' });
        await page.screenshot({ path: `${OUT_DIR}/${width}-${theme}-resume.png`, fullPage: true });
        // The top of /resume up close: Download PDF and the contact line (email, Copy, profile links).
        await page
          .locator('[data-resume] > header')
          .screenshot({ path: `${OUT_DIR}/${width}-${theme}-resume-top.png` });
      });

      // The homepage Skills card with the last project card above it, to compare the two; and /resume's Skills.
      test('skills', async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => document.fonts.ready);
        const lastCard = (await page.locator('[data-project-card]').last().boundingBox())!;
        const skills = (await page.locator('#skills').boundingBox())!;
        await page.screenshot({
          path: `${OUT_DIR}/${width}-${theme}-skills.png`,
          fullPage: true,
          clip: { x: 0, y: lastCard.y - 16, width, height: skills.y + skills.height - lastCard.y + 32 },
        });

        await page.goto('/resume');
        await page.evaluate(() => document.fonts.ready);
        await page.locator('#skills').screenshot({ path: `${OUT_DIR}/${width}-${theme}-resume-skills.png` });
      });

      test('404 page', async ({ page }) => {
        await page.goto('/no-such-page');
        await page.evaluate(() => document.fonts.ready);
        await page.screenshot({ path: `${OUT_DIR}/${width}-${theme}-404.png`, fullPage: true });
      });

      // The 404 game (F.3) during a round: Play, a jump, then paused about a second in, so the frame holds still.
      test('404 game', async ({ page }) => {
        await page.goto('/no-such-page');
        await page.evaluate(() => document.fonts.ready);
        const canvas = page.locator('[data-game-canvas]');
        await page.getByRole('button', { name: 'Play' }).click();
        await canvas.and(page.locator('[data-game-state="running"]')).waitFor();
        await page.waitForTimeout(900);
        await page.keyboard.press('Space');
        await page.waitForTimeout(150);
        await page.evaluate(() => {
          Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
          document.dispatchEvent(new Event('visibilitychange'));
        });
        await page.locator('[data-game-score]').scrollIntoViewIfNeeded();
        await page.screenshot({ path: `${OUT_DIR}/${width}-${theme}-404-game.png`, fullPage: true });
      });

      // Terminal view hides the theme toggle, so it has no shot of it.
      if (look.style !== 'terminal') {
        test('toggle focused', async ({ page }) => {
          await page.goto('/');
          await page.evaluate(() => document.fonts.ready);
          // Keyboard focus, so :focus-visible draws the ring.
          await themeToggle(page).focus();
          await page.keyboard.press('Shift+Tab');
          await page.keyboard.press('Tab');
          await page.screenshot({ path: `${OUT_DIR}/${width}-${theme}-toggle-focused.png` });
        });
      }

      // The footer with the terminal view switch focused by keyboard (F.7).
      test('switch focused', async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => document.fonts.ready);
        await styleToggle(page).focus();
        await page.keyboard.press('Shift+Tab');
        await page.keyboard.press('Tab');
        await page.getByRole('contentinfo').screenshot({ path: `${OUT_DIR}/${width}-${theme}-switch-focused.png` });
      });

      test.describe('with clipboard access', () => {
        test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

        test('contact copied', async ({ page }) => {
          await page.goto('/');
          await page.evaluate(() => document.fonts.ready);
          const button = page.locator('[data-contact] button[data-email-copy]');
          await button.scrollIntoViewIfNeeded();
          // Copy, then Tab-and-back so the button shows its check icon and "Copied" with its keyboard focus ring.
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

// The header on every page (Task 2.13): the home link is hidden at 375px, first appears at 640px (sm, the tightest
// fit), and sits at the column's left edge at 1280px.
const HEADER_PAGES = { home: '/', resume: '/resume', '404': '/no-such-page' };
for (const width of [375, 640, 1280]) {
  for (const look of LOOKS) {
    const theme = look.name;
    test.describe(`header ${width}px ${theme}`, () => {
      test.use({ viewport: { width, height: 800 }, colorScheme: look.colorScheme });
      test.beforeEach(({ page }) => useLook(page, look));

      for (const [name, url] of Object.entries(HEADER_PAGES)) {
        test(`header ${name}`, async ({ page }) => {
          await page.goto(url);
          await page.evaluate(() => document.fonts.ready);
          await page.locator('body > header').screenshot({ path: `${OUT_DIR}/header-${width}-${theme}-${name}.png` });
        });
      }
    });
  }
}

// The OG image as shared: full size, scaled to a ~500px-wide preview (the tagline must stay readable), and the
// center 630×630 square that WhatsApp crops (the name and title must stay inside it).
test.describe('og image', () => {
  test.use({ viewport: { width: 1200, height: 630 } });

  test('og image previews', async ({ page }) => {
    await page.goto('/og-image.png');
    await page.screenshot({ path: `${OUT_DIR}/og-image.png` });
    await page.screenshot({ path: `${OUT_DIR}/og-image-square.png`, clip: { x: 285, y: 0, width: 630, height: 630 } });
    await page.setViewportSize({ width: 500, height: 263 });
    await page.goto('/og-image.png');
    await page.evaluate(() => {
      const img = document.querySelector('img')!;
      img.style.width = '500px';
      img.style.height = 'auto';
      document.body.style.margin = '0';
    });
    await page.screenshot({ path: `${OUT_DIR}/og-image-500.png` });
  });
});

// /resume as printed from dark theme, the hardest case, at A4 width (96dpi). print-preview-resume.pdf is a print
// preview of the web page made by this script, to show the real page breaks, which a screenshot can't. It is not
// the resume: that's Shahar_Asher_CV.pdf, generated by npm run cv.
test.describe('resume print', () => {
  test.use({ viewport: { width: 794, height: 1123 }, colorScheme: 'dark' });

  test('print', async ({ page }) => {
    await page.goto('/resume');
    await page.evaluate(() => document.fonts.ready);
    await page.locator('[data-resume] [data-email-address]').waitFor({ state: 'visible' });
    await page.emulateMedia({ media: 'print' });
    await page.screenshot({ path: `${OUT_DIR}/resume-print.png`, fullPage: true });
    await page.pdf({ path: `${OUT_DIR}/print-preview-resume.pdf`, format: 'A4', preferCSSPageSize: true });
  });

  // Printed from terminal view (F.7): must look exactly like the shot above.
  test('print from terminal view', async ({ page }) => {
    await useLook(
      page,
      LOOKS.find((look) => look.style === 'terminal')!,
    );
    await page.goto('/resume');
    await page.evaluate(() => document.fonts.ready);
    await page.locator('[data-resume] [data-email-address]').waitFor({ state: 'visible' });
    await page.emulateMedia({ media: 'print' });
    await page.screenshot({ path: `${OUT_DIR}/resume-print-terminal.png`, fullPage: true });
  });
});

// The site icons (Task 2.13a): every favicon.ico entry and the apple-touch-icon at real size (1×) and scaled up 8×
// (pixelated, so each pixel shows), on a light and a dark strip like browser chrome. The entries are read from the
// files themselves, so this shows exactly what's committed.
test.describe('site icons', () => {
  test.use({ viewport: { width: 1600, height: 900 } });

  test('icons', async ({ page }) => {
    const ico = readIco(fs.readFileSync(`public${SITE_ICONS.favicon.path}`));
    const icons = [
      ...ico.map(({ width, png }) => ({ label: `favicon.ico ${width}px`, size: width, png })),
      {
        label: 'apple-touch-icon.png 180px',
        size: SITE_ICONS.appleTouch.size,
        png: fs.readFileSync(`public${SITE_ICONS.appleTouch.path}`),
      },
    ];
    const cell = ({ size, png }: { size: number; png: Buffer }, scale: number) =>
      `<img src="data:image/png;base64,${png.toString('base64')}" width="${size * scale}" height="${size * scale}">`;
    const strip = (bg: string, fg: string) => `
      <section style="background:${bg};color:${fg};padding:16px;display:flex;gap:32px;align-items:flex-end">
        ${icons
          .map(
            (icon) =>
              `<figure>${cell(icon, 1)}${icon.size < 180 ? cell(icon, 8) : cell(icon, 2)}` +
              `<figcaption>${icon.label}</figcaption></figure>`,
          )
          .join('')}
      </section>`;
    await page.setContent(`<!doctype html><html><head><style>
        body { margin: 0; font: 13px sans-serif; }
        figure { margin: 0; display: flex; flex-direction: column; align-items: center; gap: 8px; }
        img { image-rendering: pixelated; }
      </style></head><body>${strip('#f1f3f4', '#202124')}${strip('#202124', '#e8eaed')}</body></html>`);
    await page.screenshot({ path: `${OUT_DIR}/icons.png`, fullPage: true });
  });
});
