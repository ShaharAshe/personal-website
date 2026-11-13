// Shared helpers for the e2e specs (not a spec itself: the e2e project only runs *.spec.ts).

import { expect, type Locator, type Page } from '@playwright/test';
import { COPY_FEEDBACK_MS } from '../../src/lib/email-client.ts';
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

/**
 * Clicks a copy button and checks its feedback: the check icon replaces the copy icon, and both are back after
 * COPY_FEEDBACK_MS, with the button's box identical throughout. Needs page.clock.install() before page.goto. The
 * clipboard check reports only true/false, so a failure never prints the address.
 */
export async function expectCopyIconSwap(page: Page, button: Locator, address: string): Promise<void> {
  const copyIcon = button.locator('svg[data-icon="copy"]');
  const checkIcon = button.locator('svg[data-icon="check"]');
  await expect(copyIcon).toBeVisible();
  await expect(checkIcon).toBeHidden();
  // In page coordinates: the click scrolls the button into view, which changes boundingBox()'s viewport-relative y.
  const box = () =>
    button.evaluate((el) => {
      const { x, y, width, height } = el.getBoundingClientRect();
      return { x: x + scrollX, y: y + scrollY, width, height };
    });
  const before = await box();

  await button.click();
  await expect(checkIcon).toBeVisible();
  await expect(copyIcon).toBeHidden();
  expect(await box()).toEqual(before);
  expect((await page.evaluate(() => navigator.clipboard.readText())) === address).toBe(true);

  await page.clock.runFor(COPY_FEEDBACK_MS);
  await expect(copyIcon).toBeVisible();
  await expect(checkIcon).toBeHidden();
  expect(await box()).toEqual(before);
}

/** After a failed copy: the copy icon stays, and no check icon shows. */
export async function expectNoCheckIcon(button: Locator): Promise<void> {
  await expect(button.locator('svg[data-icon="check"]')).toBeHidden();
  await expect(button.locator('svg[data-icon="copy"]')).toBeVisible();
}

/** With reduced motion the swap has no transition or animation. Call it with the page set to reduced motion. */
export async function expectInstantCopySwap(button: Locator): Promise<void> {
  await button.click();
  await expect(button.locator('svg[data-icon="check"]')).toBeVisible();
  const timings = await button.evaluate((el) =>
    [...el.querySelectorAll('[data-copy-idle], [data-copy-done], svg')].map((part) => {
      const { transitionDuration, animationName } = getComputedStyle(part);
      return { transitionDuration, animationName };
    }),
  );
  for (const timing of timings) expect(timing).toEqual({ transitionDuration: '0s', animationName: 'none' });
}

/** The nav link labels, in Tab order after the skip link. */
export const NAV_LINKS = ['Experience', 'Projects', 'Resume', 'Contact'];

// Console text the browser prints for any response-header problem: a CSP block (older Chromium starts it with
// "Refused to"; current Chromium says "...violates the following Content Security Policy directive"), or a header it
// can't parse or a feature name it doesn't know ("Error with Permissions-Policy header: Unrecognized feature: ...").
const SECURITY_CONSOLE =
  /Refused to|Content[- ]Security[- ]Policy|Permissions[- ]Policy|Unrecognized feature|Error with .* header/i;

declare global {
  interface Window {
    __cspViolations?: string[];
  }
}

/**
 * Records every securitypolicyviolation event (from before the first inline script runs) and every console message
 * about a response header (CSP, Permissions-Policy, ...). Returns the console list; the events are read with
 * cspViolations().
 *
 * Header-parse errors are logged by the browser itself when the response arrives (a DevTools Log entry), not by page
 * code, so page.on('console') may not see them. The CDP Log domain does; both browsers used here are Chromium.
 */
export async function watchSecurityErrors(page: Page): Promise<string[]> {
  const consoleErrors: string[] = [];
  const record = (text: string) => {
    if (SECURITY_CONSOLE.test(text) && !consoleErrors.includes(text)) consoleErrors.push(text);
  };
  page.on('console', (message) => record(message.text()));
  const cdp = await page.context().newCDPSession(page);
  cdp.on('Log.entryAdded', ({ entry }) => record(entry.text));
  await cdp.send('Log.enable');
  await page.addInitScript(() => {
    window.__cspViolations = [];
    document.addEventListener('securitypolicyviolation', (event) => {
      window.__cspViolations?.push(`${event.effectiveDirective} blocked ${event.blockedURI || 'inline'}`);
    });
  });
  return consoleErrors;
}

export const cspViolations = (page: Page) => page.evaluate(() => window.__cspViolations ?? []);
