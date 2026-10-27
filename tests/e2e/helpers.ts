// Shared helpers for the e2e specs (not a spec itself: the e2e project only runs *.spec.ts).

import { expect, type Locator, type Page } from '@playwright/test';
import { nextTheme, type Theme } from '../../src/lib/theme.ts';

/** The theme toggle, by role and accessible name (the name is set once the script runs). */
export function themeToggle(page: Page): Locator {
  return page.getByRole('button', { name: /^Switch to (light|dark) theme$/ });
}

/**
 * Changes the emulated OS theme while a page is open. Browsers fire matchMedia `change` events during
 * a rendering update ("evaluate media queries and report changes" in the HTML spec), and with several
 * browsers running in parallel a headless page may not get one on its own, so the toggle's listener
 * would never run. Waiting for an animation frame gives it that rendering update. Not needed before
 * page.goto: the page reads the OS setting when it loads.
 */
export async function changeOsTheme(page: Page, theme: Theme): Promise<void> {
  await page.emulateMedia({ colorScheme: theme });
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));
}

/**
 * Asserts the theme on screen. global.css sets `color-scheme` per theme (from data-theme, else the OS
 * setting), so this checks what the page renders without hardcoding any color.
 */
export async function expectTheme(page: Page, theme: Theme): Promise<void> {
  await expect(page.locator('html')).toHaveCSS('color-scheme', theme);
}

/** Asserts the toggle shows the icon and label for switching away from `theme`. */
export async function expectToggleFor(page: Page, theme: Theme): Promise<void> {
  const target = nextTheme(theme);
  await expect(themeToggle(page)).toHaveAccessibleName(`Switch to ${target} theme`);
  await expect(page.locator(`[data-theme-icon="${target}"]`)).toBeVisible();
  await expect(page.locator(`[data-theme-icon="${theme}"]`)).toBeHidden();
}

/** Asserts the element is focused by keyboard and draws a visible outline. */
export async function expectFocusRing(locator: Locator): Promise<void> {
  await expect(locator).toBeFocused();
  const ring = await locator.evaluate((el) => {
    const style = getComputedStyle(el);
    return {
      focusVisible: el.matches(':focus-visible'),
      outlineStyle: style.outlineStyle,
      outlineWidth: parseFloat(style.outlineWidth),
    };
  });
  expect(ring.focusVisible).toBe(true);
  expect(ring.outlineStyle).not.toBe('none');
  expect(ring.outlineWidth).toBeGreaterThan(0);
}

/** The nav link labels, in Tab order after the skip link. */
export const NAV_LINKS = ['Experience', 'Projects', 'Resume', 'Contact'];
