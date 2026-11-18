// Shared helpers for the e2e specs (not a spec itself: the e2e project only runs *.spec.ts).

import { expect, type Locator, type Page } from '@playwright/test';
import { COPY_FEEDBACK_MS } from '../../src/lib/email-client.ts';
import { nextTheme, STYLE_STORAGE_KEY, TERMINAL, type Theme, type ViewStyle } from '../../src/lib/theme.ts';

/** The theme toggle, by role and accessible name (the name is set once the script runs). */
export function themeToggle(page: Page): Locator {
  return page.getByRole('button', { name: /^Switch to (light|dark) theme$/ });
}

/** The terminal view switch in the footer (Task F.7). */
export function styleToggle(page: Page): Locator {
  return page.getByRole('contentinfo').getByRole('button', { name: 'Terminal view', exact: true });
}

/**
 * The looks the layout checks run in: both themes, and terminal view (Task F.7). Terminal runs over a light OS, so the
 * same checks also show it stays dark. `scheme` is the color-scheme the page must end up with (for expectTheme).
 */
export const LOOKS = [
  { name: 'dark', colorScheme: 'dark', style: 'regular', scheme: 'dark' },
  { name: 'light', colorScheme: 'light', style: 'regular', scheme: 'light' },
  { name: 'terminal', colorScheme: 'light', style: TERMINAL, scheme: 'dark' },
] as const satisfies readonly { name: string; colorScheme: Theme; style: ViewStyle; scheme: Theme }[];

export type Look = (typeof LOOKS)[number];

/** Saves the style before every page load from now on, as a returning visitor's choice. Call before page.goto. */
export async function saveStyleBeforeLoad(page: Page, style: ViewStyle): Promise<void> {
  await page.addInitScript(([key, value]) => localStorage.setItem(key, value), [STYLE_STORAGE_KEY, style] as const);
}

/** Puts the page in `look` for the next page.goto: terminal view is saved first; the themes come from colorScheme. */
export async function useLook(page: Page, look: Look): Promise<void> {
  if (look.style === TERMINAL) await saveStyleBeforeLoad(page, TERMINAL);
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

/**
 * Waits until every section in `sections` (elements with data-reveal) is in its final state after the entrance
 * (Task 3.4): data-reveal bare or "done", and every child at opacity 1 with no transform. It checks the final state
 * itself, not "no animation running": between data-reveal becoming "done" and the style recalc that starts the
 * transitions, nothing animates yet, but the content is still 12px down. Reading computed styles forces that recalc,
 * so this can't pass early. No sections (e.g. /resume) passes at once.
 *
 * Clock-safe: no timers or requestAnimationFrame in the page, which page.clock.install() fakes (expect.poll waits on the
 * Node side). The entrance itself uses neither: an IntersectionObserver and CSS transitions, which the fake clock
 * doesn't touch.
 */
export async function waitForRevealed(sections: Locator): Promise<void> {
  await expect
    .poll(() =>
      sections.evaluateAll((elements) =>
        elements.every((section) => {
          const state = section.getAttribute('data-reveal');
          if (state !== '' && state !== 'done') return false;
          return [...section.children].every((child) => {
            const { opacity, transform } = getComputedStyle(child);
            return opacity === '1' && transform === 'none';
          });
        }),
      ),
    )
    .toBe(true);
}

/**
 * Brings in every homepage section's entrance (Task 3.4): scrolls each section into view in turn, waits until all are
 * in their final state, then goes back to the top. Layout checks then measure the final layout with motion on, as a
 * visitor sees it. Clock-safe, like waitForRevealed.
 */
export async function revealAll(page: Page): Promise<void> {
  // One section at a time, each waited for: the observer only reports a section that crosses into view, so jumping past
  // one in a single step would leave it waiting.
  for (const section of await page.locator('[data-reveal]').all()) {
    await section.evaluate((el) => el.scrollIntoView({ behavior: 'instant', block: 'start' }));
    await waitForRevealed(section);
  }
  await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
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
  // In view and in its final place first: scrolling to it starts its section's entrance (Task 3.4), which moves it.
  await button.scrollIntoViewIfNeeded();
  // From the button up, not page.locator(...).filter({ has: button }): `has` matches the button's selector inside the
  // section, and the contact button's selector starts with the section itself ([data-contact]), so it matched nothing
  // and the wait passed at once.
  const section = button.locator('xpath=ancestor::*[@data-reveal]');
  // An empty match would pass the wait at once: on a page with entrances (the homepage), the button must be in one.
  if ((await page.locator('[data-reveal]').count()) > 0) await expect(section).toHaveCount(1);
  await waitForRevealed(section);
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
