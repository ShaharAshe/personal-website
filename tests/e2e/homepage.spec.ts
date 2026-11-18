// The assembled homepage (Task 2.10) in a real browser: one column with aligned headings, one section gap,
// Back to top by mouse and keyboard, smooth scrolling only without reduced motion, the nav links, and the
// polish details at 375px and 1280px in both themes. What the built HTML contains is checked by
// tests/homepage.test.ts (npm test).

import { type Locator, type Page } from '@playwright/test';
import { expect, test } from './fixtures.ts';
import { THEMES } from '../../src/lib/theme.ts';
import { expectTheme, revealAll } from './helpers.ts';

const SECTION_IDS = ['experience', 'projects', 'skills', 'contact'];
const SECTION_GAP: Record<number, number> = { 375: 64, 1280: 96 };

const backToTop = (page: Page) => page.getByRole('contentinfo').getByRole('link', { name: 'Back to top' });
const scrollY = (page: Page) => page.evaluate(() => window.scrollY);

async function boxOf(locator: Locator) {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  return box!;
}

/**
 * The Hero's dot layer alone: hides the text and turns the glow off, then counts the different colors in part
 * of the Hero (x and width in page pixels). One color means no dots there.
 */
async function dotLayerColors(page: Page, x: number, width: number): Promise<number> {
  const hero = page.locator('[data-hero]');
  await hero.evaluate((el) => {
    el.classList.remove('hero-glow');
    (el.firstElementChild as HTMLElement).style.visibility = 'hidden';
  });
  const { y, height } = await boxOf(hero);
  const png = await page.screenshot({ clip: { x, y, width, height } });
  return page.evaluate(async (base64) => {
    // Decoded from a Blob, not a data: URL: the site's CSP (img-src 'self') blocks data: images, and
    // createImageBitmap fetches nothing, so img-src doesn't apply.
    const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
    const image = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext('2d')!;
    context.drawImage(image, 0, 0);
    const { data } = context.getImageData(0, 0, image.width, image.height);
    const colors = new Set<number>();
    for (let i = 0; i < data.length; i += 4) colors.add((data[i] << 16) | (data[i + 1] << 8) | data[i + 2]);
    return colors.size;
  }, png.toString('base64'));
}

async function expectAtPageTop(page: Page) {
  await expect.poll(() => scrollY(page)).toBe(0);
  await expect(page.locator('#top')).toBeFocused();
  // The next Tab starts from the top of the page.
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
}

test.describe('at 1280px', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('every section <h2> has the same left edge, and the nav ends at the column edge', async ({ page }) => {
    await page.goto('/');
    const headings = await Promise.all(SECTION_IDS.map((id) => boxOf(page.locator(`#${id} h2`))));
    for (const heading of headings) {
      expect(heading.x).toBe(headings[0].x);
      expect(heading.x + heading.width).toBe(headings[0].x + headings[0].width);
    }
    const toggle = await boxOf(page.locator('[data-theme-toggle]'));
    expect(toggle.x + toggle.width).toBe(headings[0].x + headings[0].width);
  });
});

for (const width of [375, 1280]) {
  test.describe(`Projects column at ${width}px`, () => {
    test.use({ viewport: { width, height: 800 } });

    test('the featured card comes first, and every card spans the column in one column', async ({ page }) => {
      await page.goto('/');
      const heading = await boxOf(page.locator('#projects h2'));
      const featured = await boxOf(page.locator('[data-project-card="featured"]').first());
      const moreProjects = await boxOf(page.getByRole('heading', { level: 3, name: 'More projects' }));
      expect(featured.y).toBeLessThan(moreProjects.y);

      let previousBottom = moreProjects.y;
      for (const card of [
        featured,
        ...(await Promise.all((await page.locator('[data-project-card="portfolio"]').all()).map(boxOf))),
      ]) {
        expect(card.x).toBe(heading.x);
        expect(card.width).toBe(heading.width);
        if (card !== featured) {
          expect(card.y).toBeGreaterThanOrEqual(previousBottom);
          previousBottom = card.y + card.height;
        }
      }
    });

    test('every project card title starts at the same x (same padding on every card)', async ({ page }) => {
      await page.goto('/');
      const titles = await Promise.all((await page.locator('[data-project-title]').all()).map(boxOf));
      expect(titles.length).toBeGreaterThan(1);
      for (const title of titles) expect(title.x).toBe(titles[0].x);
    });
  });
}

test('Back to top by mouse: scrolls to the top and moves focus there', async ({ page }) => {
  await page.goto('/');
  await backToTop(page).scrollIntoViewIfNeeded();
  await expect.poll(() => scrollY(page)).toBeGreaterThan(0);
  await backToTop(page).click();
  await expectAtPageTop(page);
});

test('Back to top by keyboard: Enter scrolls to the top and moves focus there', async ({ page }) => {
  await page.goto('/');
  // Focus by keyboard (Shift+Tab, Tab), so it's a real keyboard activation.
  await backToTop(page).focus();
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Tab');
  await expect(backToTop(page)).toBeFocused();
  await expect.poll(() => scrollY(page)).toBeGreaterThan(0);
  await page.keyboard.press('Enter');
  await expectAtPageTop(page);
});

test('Back to top is the last Tab stop on the page', async ({ page }) => {
  await page.goto('/');
  await backToTop(page).focus();
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  const stillInPage = await page.evaluate(() => !!document.activeElement?.closest('main, footer, header'));
  expect(stillInPage).toBe(false);
});

for (const [reducedMotion, expected] of [
  ['reduce', 'auto'],
  ['no-preference', 'smooth'],
] as const) {
  test(`scroll-behavior is ${expected} with prefers-reduced-motion: ${reducedMotion}`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion });
    await page.goto('/');
    await expect(page.locator('html')).toHaveCSS('scroll-behavior', expected);
  });
}

for (const [link, id] of [
  ['Experience', 'experience'],
  ['Projects', 'projects'],
  ['Contact', 'contact'],
] as const) {
  test(`the nav "${link}" link lands on its section`, async ({ page }) => {
    await page.goto('/');
    await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: link }).click();
    await expect(page).toHaveURL(new RegExp(`#${id}$`));
    // The section's top reaches the viewport top, or the page can't scroll any further (Contact is short).
    await expect
      .poll(() =>
        page.evaluate((sectionId) => {
          const top = document.getElementById(sectionId)!.getBoundingClientRect().top;
          const root = document.documentElement;
          const atBottom = Math.ceil(window.scrollY + window.innerHeight) >= root.scrollHeight;
          return Math.abs(top) <= 1 || (atBottom && top > 0);
        }, id),
      )
      .toBe(true);
    await expect(page.locator(`#${id} h2`)).toBeInViewport();
  });
}

for (const width of [375, 1280]) {
  for (const theme of THEMES) {
    test.describe(`homepage at ${width}px, ${theme}`, () => {
      test.use({ viewport: { width, height: 800 }, colorScheme: theme });

      test('no Hero dot inside the 720px text column', async ({ page }) => {
        await page.goto('/');
        const columnWidth = Math.min(720, width);
        expect(await dotLayerColors(page, (width - columnWidth) / 2, columnWidth)).toBe(1);
      });

      if (width > 720) {
        test('the Hero dots show in the margins', async ({ page }) => {
          await page.goto('/');
          expect(await dotLayerColors(page, 0, (width - 720) / 2)).toBeGreaterThan(1);
        });
      }

      test('no horizontal scroll on the full page', async ({ page }) => {
        await page.goto('/');
        await expectTheme(page, theme);
        const { scrollWidth, clientWidth } = await page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
        }));
        expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
        const footer = await boxOf(page.getByRole('contentinfo'));
        expect(footer.x + footer.width).toBeLessThanOrEqual(width);
      });

      test('one gap between sections: previous section bottom to next <h2>', async ({ page }) => {
        await page.goto('/');
        // The headings move during their section's entrance (Task 3.4): measure the final layout.
        await revealAll(page);
        const previous = ['[data-hero]', '#experience', '#projects', '#skills'];
        for (const [i, id] of SECTION_IDS.entries()) {
          const before = await boxOf(page.locator(previous[i]));
          const heading = await boxOf(page.locator(`#${id} h2`));
          expect(heading.y - (before.y + before.height), `gap above #${id}`).toBeCloseTo(SECTION_GAP[width], 0);
        }
        // And the same space between Contact and the footer.
        const contact = await boxOf(page.locator('#contact [data-contact-github]'));
        const footer = await boxOf(page.getByRole('contentinfo'));
        expect(footer.y - (contact.y + contact.height), 'gap above the footer').toBeCloseTo(SECTION_GAP[width], 0);
      });

      test('the Hero icons line up with the text and keep their 40px hit area', async ({ page }) => {
        await page.goto('/');
        const hero = page.locator('[data-hero]');
        const title = await boxOf(hero.locator('h1'));
        const links = hero.locator('[data-social]');
        const icon = await boxOf(links.first().locator('svg'));
        expect(icon.x).toBeCloseTo(title.x, 0);
        for (const link of await links.all()) {
          const box = await boxOf(link);
          expect(box.width).toBe(40);
          expect(box.height).toBe(40);
        }
      });

      test('the timeline dot is centered on the line', async ({ page }) => {
        await page.goto('/');
        const timeline = await boxOf(page.locator('#experience ol'));
        const dots = page.locator('#experience [data-role] > span[aria-hidden="true"]');
        await expect(dots).not.toHaveCount(0);
        for (const dot of await dots.all()) {
          const box = await boxOf(dot);
          // The line is the list's 1px left border.
          expect(Math.abs(box.x + box.width / 2 - (timeline.x + 0.5))).toBeLessThanOrEqual(1);
        }
      });

      test('revealing the email elements moves nothing below them', async ({ page }) => {
        await page.goto('/');
        await expect(page.locator('[data-copy-email]')).toBeVisible();
        const positions = () =>
          Promise.all(
            ['[data-contact-github]', '#experience h2'].map(
              async (selector) => (await boxOf(page.locator(selector))).y,
            ),
          );
        const revealed = await positions();
        // Put the page back in its state before the email script ran.
        await page.evaluate(() => {
          for (const el of document.querySelectorAll<HTMLElement>('[data-email-reveal]')) el.hidden = true;
        });
        const hidden = await positions();
        expect(hidden).toEqual(revealed);
      });
    });
  }
}
