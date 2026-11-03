// Hero (Task 2.5) in a real browser: the resume download, the CTA targets, keyboard order with focus
// rings, and the layout at 375px and 1280px in both themes. What the built HTML contains is checked by
// tests/hero.test.ts (npm test).

import { expect, test, type Page } from '@playwright/test';
import { THEMES } from '../../src/lib/theme.ts';
import { mailtoHref } from '../../src/lib/email-client.ts';
import { getEmailParts, getResume } from '../../src/lib/resume.ts';
import { RESUME_PDF_FILENAME } from '../../src/lib/resume-pdf.ts';
import { expectFocusRing, expectTheme, themeToggle } from './helpers.ts';

const hero = (page: Page) => page.locator('[data-hero]');
const download = (page: Page) => hero(page).getByRole('link', { name: 'Download Resume' });
const viewProjects = (page: Page) => hero(page).getByRole('link', { name: 'View Projects' });

test('Download Resume downloads the PDF as Shahar_Asher_CV.pdf', async ({ page }) => {
  await page.goto('/');
  const [file] = await Promise.all([page.waitForEvent('download'), download(page).click()]);
  expect(file.suggestedFilename()).toBe('Shahar_Asher_CV.pdf');
  expect(file.suggestedFilename()).toBe(RESUME_PDF_FILENAME);
  expect(new URL(file.url()).pathname).toBe('/resume.pdf');
  expect(await file.failure()).toBeNull();
});

test('View Projects points to /#projects', async ({ page }) => {
  await page.goto('/');
  await expect(viewProjects(page)).toHaveAttribute('href', '/#projects');
});

test('keyboard: after the theme toggle, Tab reaches both CTAs and then each profile link, with focus rings', async ({
  page,
}) => {
  await page.goto('/');
  // Start from the toggle, the last header Tab stop (header order is covered in theme-toggle.spec.ts).
  await themeToggle(page).focus();
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Tab');
  await expect(themeToggle(page)).toBeFocused();

  await page.keyboard.press('Tab');
  await expectFocusRing(download(page));
  await page.keyboard.press('Tab');
  await expectFocusRing(viewProjects(page));
  for (const { network, url } of getResume().basics.profiles) {
    await page.keyboard.press('Tab');
    const link = hero(page).getByRole('link', { name: network, exact: true });
    await expect(link).toHaveAttribute('href', url);
    await expectFocusRing(link);
  }
  // Then the email icon, last in the row, its mailto: href set by the page's email script.
  await page.keyboard.press('Tab');
  const email = hero(page).getByRole('link', { name: 'Email', exact: true });
  await expectFocusRing(email);
  expect((await email.getAttribute('href')) === mailtoHref(getEmailParts())).toBe(true);
});

for (const width of [375, 1280]) {
  for (const theme of THEMES) {
    test.describe(`Hero at ${width}px, ${theme}`, () => {
      test.use({ viewport: { width, height: 800 }, colorScheme: theme });

      test('no horizontal scroll; both CTAs fully visible', async ({ page }) => {
        await page.goto('/');
        await expectTheme(page, theme);

        const { scrollWidth, clientWidth } = await page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
        }));
        expect(scrollWidth).toBeLessThanOrEqual(clientWidth);

        for (const cta of [download(page), viewProjects(page)]) {
          await expect(cta).toBeInViewport({ ratio: 1 });
          const box = await cta.boundingBox();
          expect(box).not.toBeNull();
          expect(box!.x).toBeGreaterThanOrEqual(0);
          expect(box!.x + box!.width).toBeLessThanOrEqual(width);
        }
      });
    });
  }
}
