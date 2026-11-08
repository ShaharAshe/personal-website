// Task 2.13 checks that need a real browser: the header home link (visible from 640px, hidden below), its focus
// ring, the nav fitting on one row at 640px (where the link first appears), no horizontal scroll, sitemap.xml
// parsing as XML, and the OG image being served. The built head tags are checked in tests/seo-dist.test.ts.

import { expect, test, type Page } from '@playwright/test';
import { getResume } from '../../src/lib/resume.ts';
import { THEMES } from '../../src/lib/theme.ts';
import { expectFocusRing, themeToggle } from './helpers.ts';

const NAME = getResume().basics.name;
const PAGES = ['/', '/resume', '/no-such-page'];

const homeLink = (page: Page) => page.getByRole('navigation', { name: 'Main' }).locator('[data-home-link]');

async function expectNoHorizontalScroll(page: Page): Promise<void> {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
}

for (const path of PAGES) {
  test.describe(`header on ${path}`, () => {
    test.describe('at 1280px', () => {
      test.use({ viewport: { width: 1280, height: 800 } });

      test('the home link shows the name and goes to /', async ({ page }) => {
        await page.goto(path);
        await expect(homeLink(page)).toBeVisible();
        await expect(homeLink(page)).toHaveText(NAME);
        await expect(homeLink(page)).toHaveAttribute('href', '/');
        await homeLink(page).click();
        await expect(page).toHaveURL(/\/$/);
        expect(new URL(page.url()).pathname).toBe('/');
      });

      test('the home link is the first Tab stop after the skip link, with a focus ring', async ({ page }) => {
        await page.goto(path);
        await page.keyboard.press('Tab'); // skip link
        await page.keyboard.press('Tab');
        await expectFocusRing(homeLink(page));
      });

      test('the home link sits at the left edge of the 720px column', async ({ page }) => {
        await page.goto(path);
        const box = (await homeLink(page).boundingBox())!;
        const nav = (await page.getByRole('navigation', { name: 'Main' }).boundingBox())!;
        // The nav has px-4 (16px) padding inside its 720px column.
        expect(Math.round(box.x)).toBe(Math.round(nav.x + 16));
      });
    });

    test.describe('at 375px', () => {
      test.use({ viewport: { width: 375, height: 800 } });

      test('the home link is hidden', async ({ page }) => {
        await page.goto(path);
        await expect(homeLink(page)).toBeHidden();
      });
    });
  });
}

// 640px (sm) is where the home link first appears: the tightest width where the whole nav must fit on one row.
for (const theme of THEMES) {
  for (const width of [375, 640, 1280]) {
    test.describe(`${width}px ${theme}`, () => {
      test.use({ viewport: { width, height: 800 }, colorScheme: theme });

      for (const path of PAGES) {
        test(`no horizontal scroll on ${path}`, async ({ page }) => {
          await page.goto(path);
          await page.evaluate(() => document.fonts.ready);
          await expectNoHorizontalScroll(page);
        });

        if (width !== 640) continue;

        test(`the nav fits on one row with the home link on ${path}`, async ({ page }) => {
          await page.goto(path);
          await page.evaluate(() => document.fonts.ready);
          await expect(homeLink(page)).toBeVisible();

          const nav = page.getByRole('navigation', { name: 'Main' });
          const items = [homeLink(page), ...(await nav.locator('li a').all()), themeToggle(page)];
          const boxes = await Promise.all(items.map(async (item) => (await item.boundingBox())!));
          const navBox = (await nav.boundingBox())!;
          const centers = boxes.map((b) => b.y + b.height / 2);
          // One row: every item shares the same vertical center.
          for (const center of centers) expect(Math.abs(center - centers[0])).toBeLessThanOrEqual(2);
          // Nothing overflows the nav, and the items don't overlap (left to right, in order).
          for (const [i, b] of boxes.entries()) {
            expect(b.x).toBeGreaterThanOrEqual(navBox.x);
            expect(b.x + b.width).toBeLessThanOrEqual(navBox.x + navBox.width + 0.5);
            if (i > 0) expect(b.x).toBeGreaterThanOrEqual(boxes[i - 1].x + boxes[i - 1].width);
          }
          // The name doesn't wrap: its text is one line box.
          const lineBoxes = await homeLink(page).evaluate((el) => {
            const range = document.createRange();
            range.selectNodeContents(el);
            return range.getClientRects().length;
          });
          expect(lineBoxes).toBe(1);
        });
      }
    });
  }
}

test('/sitemap.xml parses as XML in the browser and lists absolute URLs', async ({ page, request }) => {
  const response = await request.get('/sitemap.xml');
  expect(response.status()).toBe(200);
  const xml = await response.text();
  await page.goto('/');
  const result = await page.evaluate((text) => {
    const doc = new DOMParser().parseFromString(text, 'application/xml');
    return {
      error: doc.getElementsByTagName('parsererror').length > 0,
      root: doc.documentElement.localName,
      namespace: doc.documentElement.namespaceURI,
      locs: [...doc.getElementsByTagName('loc')].map((loc) => loc.textContent),
    };
  }, xml);
  expect(result.error).toBe(false);
  expect(result.root).toBe('urlset');
  expect(result.namespace).toBe('http://www.sitemaps.org/schemas/sitemap/0.9');
  expect(result.locs).toHaveLength(2);
  for (const loc of result.locs) expect(loc).toMatch(/^https:\/\//);
});

test('/robots.txt is served as text with a Sitemap line', async ({ request }) => {
  const response = await request.get('/robots.txt');
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toMatch(/^text\/plain/);
  expect(await response.text()).toMatch(/^Sitemap: https:\/\/\S+\/sitemap\.xml$/m);
});

test('/og-image.png is served as a PNG', async ({ request }) => {
  const response = await request.get('/og-image.png');
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toBe('image/png');
});
