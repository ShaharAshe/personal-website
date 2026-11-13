// Projects (Task 2.8) in a real browser: the Hero's "View Projects" and the nav's "Projects" bring the section
// into view, every link in it is reachable by Tab with a focus ring, and the layout at 375px and 1280px in
// both themes. What the built HTML contains is checked by tests/projects-section.test.ts (npm test).
// Expected counts come from getProjects() plus the project page files that exist, never fixed numbers, so
// adding a page in Task 3.1 (a "Read more" link) needs no test change.

import path from 'node:path';
import { type Page } from '@playwright/test';
import { expect, test } from './fixtures.ts';
import { THEMES } from '../../src/lib/theme.ts';
import { getProjects } from '../../src/lib/projects.ts';
import { listProjectPageFiles } from '../../src/lib/project-pages-loader.ts';
import { projectsSection, type ProjectPageEntry } from '../../src/lib/projects-section.ts';
import { expectFocusRing, expectTheme } from './helpers.ts';

// One entry per existing page file. Only the link matters here (the frontmatter doesn't change the count),
// and ids are lowercased like Astro's glob loader does; the helper matches them ignoring case.
function existingPages(): ProjectPageEntry[] {
  return listProjectPageFiles(path.join('src', 'content', 'projects')).map((file) => ({
    id: path.basename(file, path.extname(file)).toLowerCase(),
    data: {},
  }));
}

const expected = projectsSection(getProjects(), existingPages());
const cards = [...expected.featured, ...expected.portfolio];
const linkCount =
  cards.reduce((sum, card) => sum + 1 + (card.demo ? 1 : 0) + (card.page ? 1 : 0), 0) + expected.practice.length;

const projects = (page: Page) => page.locator('#projects');
const heading = (page: Page) => projects(page).getByRole('heading', { level: 2, name: 'Projects' });

test('the Hero "View Projects" button brings the section into view', async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-hero]').getByRole('link', { name: 'View Projects' }).click();
  await expect(page).toHaveURL(/#projects$/);
  await expect(heading(page)).toBeInViewport();
});

test('the nav "Projects" link brings the section into view', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Projects' }).click();
  await expect(page).toHaveURL(/#projects$/);
  await expect(heading(page)).toBeInViewport();
});

test('keyboard: after the full-resume link, Tab reaches every project link in order, with a focus ring', async ({
  page,
}) => {
  await page.goto('/');
  const fullResume = page.locator('#experience').getByRole('link', { name: /^View full resume/ });
  // Focus by keyboard (Shift+Tab, Tab), so :focus-visible applies.
  await fullResume.focus();
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Tab');
  await expect(fullResume).toBeFocused();

  const links = projects(page).getByRole('link');
  await expect(links).toHaveCount(linkCount);
  for (let i = 0; i < linkCount; i++) {
    await page.keyboard.press('Tab');
    await expectFocusRing(links.nth(i));
  }
});

for (const width of [375, 1280]) {
  for (const theme of THEMES) {
    test.describe(`Projects at ${width}px, ${theme}`, () => {
      test.use({ viewport: { width, height: 800 }, colorScheme: theme });

      test('no horizontal scroll; every card and practice link is visible and inside the viewport width', async ({
        page,
      }) => {
        await page.goto('/');
        await expectTheme(page, theme);

        const { scrollWidth, clientWidth } = await page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
        }));
        expect(scrollWidth).toBeLessThanOrEqual(clientWidth);

        const items = projects(page).locator('[data-project-card], [data-practice-link]');
        await expect(items).toHaveCount(cards.length + expected.practice.length);
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
