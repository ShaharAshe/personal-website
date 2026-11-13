// Theme toggle (Task 2.3) in a real browser: OS default, click + save, reload, keyboard, reduced motion,
// layout. The pure logic and the built markup are covered by tests/theme-toggle.test.ts (node:test).

import { type Page } from '@playwright/test';
import { expect, test } from './fixtures.ts';
import { getResume } from '../../src/lib/resume.ts';
import { nextTheme, THEME_STORAGE_KEY, THEMES } from '../../src/lib/theme.ts';
import { changeOsTheme, expectFocusRing, expectTheme, expectToggleFor, NAV_LINKS, themeToggle } from './helpers.ts';

/** The value saved under the key from src/lib/theme.ts, or null. */
function savedTheme(page: Page): Promise<string | null> {
  return page.evaluate((key) => localStorage.getItem(key), THEME_STORAGE_KEY);
}

for (const os of THEMES) {
  test(`first visit follows the OS (${os})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: os });
    await page.goto('/');

    await expectTheme(page, os);
    await expectToggleFor(page, os);
    await expect(page.locator('html')).not.toHaveAttribute('data-theme');
    expect(await savedTheme(page)).toBeNull();
  });
}

test('follows an OS change while the page is open, if nothing is saved', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');
  await expectToggleFor(page, 'dark');

  await changeOsTheme(page, 'light');
  await expectTheme(page, 'light');
  await expectToggleFor(page, 'light');

  await changeOsTheme(page, 'dark');
  await expectTheme(page, 'dark');
  await expectToggleFor(page, 'dark');
});

for (const os of THEMES) {
  test(`click switches and saves the theme (OS ${os})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: os });
    await page.goto('/');
    const other = nextTheme(os);

    await themeToggle(page).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', other);
    await expectTheme(page, other);
    await expectToggleFor(page, other);
    expect(await savedTheme(page)).toBe(other);

    await themeToggle(page).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', os);
    await expectTheme(page, os);
    await expectToggleFor(page, os);
    expect(await savedTheme(page)).toBe(os);
  });
}

for (const saved of THEMES) {
  test(`reload keeps the saved ${saved} theme over the opposite OS setting, with no flash`, async ({ page }) => {
    const os = nextTheme(saved);
    await page.emulateMedia({ colorScheme: os });

    // Records <html data-theme> the moment <body> is inserted: after the inline <head> script, before
    // anything is rendered and before the toggle's module script runs.
    await page.addInitScript(() => {
      new MutationObserver((_, observer) => {
        if (!document.body) return;
        document.documentElement.dataset.themeAtBody = document.documentElement.dataset.theme ?? 'none';
        observer.disconnect();
      }).observe(document, { childList: true, subtree: true });
    });

    await page.goto('/');
    await expectTheme(page, os);
    await themeToggle(page).click();
    expect(await savedTheme(page)).toBe(saved);

    await page.reload();
    const html = page.locator('html');
    await expect(html).toHaveAttribute('data-theme-at-body', saved);
    await expect(html).toHaveAttribute('data-theme', saved);
    await expectTheme(page, saved);
    await expectToggleFor(page, saved);
    // The icon animation only plays after a click, never on load.
    await expect(themeToggle(page)).not.toHaveAttribute('data-animate');
  });
}

test('keyboard: Tab reaches the toggle after the skip link, home link and nav links; Enter and Space switch it', async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');
  const nav = page.getByRole('navigation', { name: 'Main' });
  const toggle = themeToggle(page);
  await expectToggleFor(page, 'dark');

  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
  // The default 1280px viewport shows the home link (the name) before the section links.
  for (const name of [getResume().basics.name, ...NAV_LINKS]) {
    await page.keyboard.press('Tab');
    await expect(nav.getByRole('link', { name })).toBeFocused();
  }
  await page.keyboard.press('Tab');
  await expectFocusRing(toggle);

  await page.keyboard.press('Enter');
  await expectTheme(page, 'light');
  await expectToggleFor(page, 'light');

  await page.keyboard.press('Space');
  await expectTheme(page, 'dark');
  await expectToggleFor(page, 'dark');
  await expectFocusRing(toggle);
});

for (const reducedMotion of ['reduce', 'no-preference'] as const) {
  test(`icon animation with prefers-reduced-motion: ${reducedMotion}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark', reducedMotion });
    await page.goto('/');

    await themeToggle(page).click();
    await expectToggleFor(page, 'light');
    const icon = page.locator('[data-theme-icon="dark"]');
    if (reducedMotion === 'reduce') {
      await expect(icon).toHaveCSS('animation-name', 'none');
    } else {
      // Control: proves the check above would catch an animation.
      await expect(icon).not.toHaveCSS('animation-name', 'none');
    }
  });
}

for (const width of [375, 1280]) {
  for (const theme of THEMES) {
    test.describe(`layout at ${width}px, ${theme}`, () => {
      test.use({ viewport: { width, height: 800 }, colorScheme: theme });

      test('no horizontal scroll; toggle is 40x40', async ({ page }) => {
        await page.goto('/');
        await expectTheme(page, theme);

        const { scrollWidth, clientWidth } = await page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
        }));
        expect(scrollWidth).toBeLessThanOrEqual(clientWidth);

        const box = await themeToggle(page).boundingBox();
        expect(box).toMatchObject({ width: 40, height: 40 });
      });
    });
  }
}
