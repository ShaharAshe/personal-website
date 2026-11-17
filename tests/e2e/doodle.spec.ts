// The doodle (Task F.4) in a real browser, with the real CSP: the doodle preview build (dist-doodle/, built by
// npm run doodle:build, default pi-day) served by its own wrangler dev on port 4323 (playwright.config.ts). The rules
// are unit-tested in tests/doodles.test.ts; the built markup and file sizes in tests/doodles-dist.test.ts.
//
// The doodle exposes test hooks that change nothing for visitors: data-doodle-state ("idle" | "playing") and
// data-doodle-plays (how many times it played). The animation file's name has a hash, so it's found by watching which
// script loads.
//
// Wikipedia is never loaded: a click listener on window (it runs after the doodle's own) records whether the click
// was cancelled and then cancels it, so "would navigate" is checked without leaving the site.

import { type Locator, type Page } from '@playwright/test';
import { expect, test } from './fixtures.ts';
import { doodleById, type Doodle } from '../../src/lib/doodles/doodles.ts';
import { MOTION_MS } from '../../src/lib/doodles/motion.ts';
import { DOODLE_PORT } from '../../scripts/doodles/doodle-server.ts';
import { unexpectedConsoleProblems, type ConsoleEntry } from './console-problems.ts';
import { cspViolations, expectTheme, LOOKS, useLook, watchSecurityErrors } from './helpers.ts';

test.use({ baseURL: `http://127.0.0.1:${DOODLE_PORT}` });

const root = (page: Page) => page.locator('[data-doodle]');
const link = (page: Page) => page.locator('[data-doodle-link]');
const bubble = (page: Page) => page.locator('[data-doodle-bubble]');
const hint = (page: Page) => page.locator('[data-doodle-hint]');
const plays = async (page: Page) => Number(await root(page).getAttribute('data-doodle-plays'));
const runningAnimations = (page: Page) => page.evaluate(() => document.getAnimations().length);

declare global {
  interface Window {
    __doodleClicks?: boolean[];
  }
}

/** Opens the homepage and returns the doodle it was built with. */
async function open(page: Page): Promise<Doodle> {
  await page.goto('/');
  await page.waitForLoadState('load');
  const id = await root(page).getAttribute('data-doodle');
  const doodle = doodleById(id ?? '');
  expect(doodle, `dist-doodle/ has an unknown doodle "${id}"`).toBeTruthy();
  // Record every click on the link: was it cancelled by the page (true) or left to navigate (false)? Then cancel it.
  await page.evaluate(() => {
    window.__doodleClicks = [];
    window.addEventListener('click', (event) => {
      if (!(event.target as Element).closest('[data-doodle-link]')) return;
      window.__doodleClicks?.push(event.defaultPrevented);
      event.preventDefault();
    });
  });
  return doodle!;
}

const clicks = (page: Page) => page.evaluate(() => window.__doodleClicks ?? []);

/** Every script URL the page requests from now on. */
function recordScripts(page: Page): string[] {
  const urls: string[] = [];
  page.on('request', (request) => {
    if (request.resourceType() === 'script') urls.push(request.url());
  });
  return urls;
}
const animationFile = (urls: string[]) => urls.filter((url) => /\/_astro\/play\.[^/]+\.js$/.test(url));

/** Waits for one play to finish: back to idle, nothing running. */
async function expectPlayedTo(page: Page, count: number) {
  await expect.poll(() => plays(page)).toBe(count);
  await expect(root(page)).toHaveAttribute('data-doodle-state', 'idle', { timeout: MOTION_MS + 1500 });
  expect(await runningAnimations(page)).toBe(0);
}

const away = (page: Page) => page.mouse.move(1, 1);

test('the doodle is a link to its English Wikipedia article, named for the day and described by the bubble', async ({
  page,
}) => {
  const doodle = await open(page);
  const a = page.getByRole('link', { name: doodle.label, exact: true });
  await expect(a).toHaveCount(1);
  await expect(a).toHaveAttribute('href', doodle.wikipedia);
  expect(doodle.wikipedia).toMatch(/^https:\/\/en\.wikipedia\.org\/wiki\//);
  await expect(a).toHaveAccessibleDescription(doodle.bubble);
  await expect(a).not.toHaveAttribute('target', /.*/);
  await expect(bubble(page)).toBeHidden();
});

test('nothing moves and no animation file loads before the first hover', async ({ page }) => {
  const scripts = recordScripts(page);
  await open(page);
  await page.waitForTimeout(500);
  expect(await plays(page)).toBe(0);
  expect(await runningAnimations(page)).toBe(0);
  expect(animationFile(scripts)).toEqual([]);

  await link(page).hover();
  await expect(bubble(page)).toBeVisible();
  await expect.poll(() => animationFile(scripts).length).toBe(1);
});

test('hover shows the bubble and plays the animation once; it plays again only on the next hover', async ({ page }) => {
  const doodle = await open(page);
  await link(page).hover();
  await expect(bubble(page)).toBeVisible();
  await expect(bubble(page)).toContainText(doodle.bubble);
  await expect(bubble(page)).toContainText('Read more on Wikipedia');
  await expect(root(page)).toHaveAttribute('data-doodle-state', 'playing');
  expect(await runningAnimations(page)).toBeGreaterThan(0);
  await expectPlayedTo(page, 1);

  // Still on it: no replay, no loop. Moving onto the bubble keeps it open (WCAG 1.4.13, hoverable).
  await page.waitForTimeout(500);
  await bubble(page).locator('#doodle-bubble-text').hover();
  await expect(bubble(page)).toBeVisible();
  expect(await plays(page)).toBe(1);
  expect(await runningAnimations(page)).toBe(0);

  await away(page);
  await expect(bubble(page)).toBeHidden();
  await link(page).hover();
  await expect(bubble(page)).toBeVisible();
  await expectPlayedTo(page, 2);
});

test('Esc closes the bubble without moving the pointer or focus', async ({ page }) => {
  await open(page);
  await link(page).hover();
  await expect(bubble(page)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(bubble(page)).toBeHidden();

  await away(page);
  await link(page).focus();
  await expect(bubble(page)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(bubble(page)).toBeHidden();
  await expect(link(page)).toBeFocused();
});

test('keyboard focus shows the bubble and plays once; Tab away closes it; Enter follows the link', async ({ page }) => {
  await open(page);
  await link(page).focus();
  await expect(bubble(page)).toBeVisible();
  await expectPlayedTo(page, 1);
  await page.keyboard.press('Enter');
  expect(await clicks(page)).toEqual([false]);

  await page.keyboard.press('Tab');
  await expect(link(page)).not.toBeFocused();
  await expect(bubble(page)).toBeHidden();
});

test('a click follows the link to Wikipedia (not cancelled)', async ({ page }) => {
  const doodle = await open(page);
  await link(page).click();
  expect(await clicks(page)).toEqual([false]);
  await expect(link(page)).toHaveAttribute('href', doodle.wikipedia);
});

test("the bubble never covers the Hero's name, buttons or links, and they stay clickable", async ({ page }) => {
  await open(page);
  await link(page).hover();
  await expect(bubble(page)).toBeVisible();
  const hero = page.locator('[data-hero]');
  const targets: Locator[] = [
    hero.locator('h1'),
    hero.getByRole('link', { name: 'Download Resume' }),
    hero.getByRole('link', { name: 'View Projects' }),
    ...(await hero.getByRole('list', { name: 'Profiles' }).getByRole('link').all()),
  ];
  const panel = (await bubble(page).locator('.doodle-bubble').boundingBox())!;
  for (const target of targets) {
    if (!(await target.isVisible())) continue;
    const box = (await target.boundingBox())!;
    const overlaps =
      box.x < panel.x + panel.width &&
      panel.x < box.x + box.width &&
      box.y < panel.y + panel.height &&
      panel.y < box.y + box.height;
    expect(overlaps, `the bubble overlaps ${await target.textContent()}`).toBe(false);
    // The element itself is what's under its center: nothing on top of it.
    const onTop = await target.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      return !!hit && (el === hit || el.contains(hit));
    });
    expect(onTop).toBe(true);
  }
});

test('no console problems and no CSP violations while it plays, under the real CSP', async ({ page }) => {
  const securityErrors = await watchSecurityErrors(page);
  const entries: ConsoleEntry[] = [];
  page.on('console', (m) => entries.push({ type: m.type(), text: m.text(), url: m.location().url }));
  // dist-doodle/_headers is applied (wrangler dev --assets), so a violation here would be a real one.
  const response = await page.request.get('/');
  const csp = response.headers()['content-security-policy'] ?? '';
  expect(csp).toMatch(/script-src 'self'/);
  expect(csp).not.toMatch(/unsafe-inline/);
  await open(page);
  await link(page).hover();
  await expectPlayedTo(page, 1);
  await link(page).focus();
  expect(securityErrors).toEqual([]);
  expect(await cspViolations(page)).toEqual([]);
  expect(unexpectedConsoleProblems(entries)).toEqual([]);
});

test.describe('touch', () => {
  test.use({ hasTouch: true });

  test('the first tap shows the bubble with "Tap again" and animates; the second follows the link', async ({
    page,
  }) => {
    await open(page);
    await link(page).tap();
    await expect(bubble(page)).toBeVisible();
    await expect(hint(page)).toBeVisible();
    await expect(hint(page)).toHaveText('Tap again to read more on Wikipedia');
    await expectPlayedTo(page, 1);
    expect(await clicks(page)).toEqual([true]);

    await link(page).tap();
    expect(await clicks(page)).toEqual([true, false]);
  });

  test('a tap elsewhere closes the bubble, and the next tap on the doodle is a first tap again', async ({ page }) => {
    await open(page);
    await link(page).tap();
    await expect(bubble(page)).toBeVisible();
    // Tapping the bubble's own text keeps it.
    await bubble(page).locator('#doodle-bubble-text').tap();
    await expect(bubble(page)).toBeVisible();
    await page.locator('[data-hero] h1').tap();
    await expect(bubble(page)).toBeHidden();

    await link(page).tap();
    await expect(bubble(page)).toBeVisible();
    expect(await clicks(page)).toEqual([true, true]);
  });
});

test.describe('prefers-reduced-motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('hover and focus show only the bubble: the shape stays still and no animation file loads', async ({ page }) => {
    const scripts = recordScripts(page);
    await open(page);
    await link(page).hover();
    await expect(bubble(page)).toBeVisible();
    await page.waitForTimeout(500);
    expect(await runningAnimations(page)).toBe(0);
    expect(await plays(page)).toBe(0);
    await away(page);
    await link(page).focus();
    await expect(bubble(page)).toBeVisible();
    await link(page).click();
    expect(await clicks(page)).toEqual([false]);
    expect(await plays(page)).toBe(0);
    expect(animationFile(scripts)).toEqual([]);
  });
});

test.describe('prefers-reduced-motion on touch', () => {
  test.use({ reducedMotion: 'reduce', hasTouch: true });

  test('the first tap shows the bubble with no animation, the second follows the link', async ({ page }) => {
    await open(page);
    await link(page).tap();
    await expect(hint(page)).toBeVisible();
    await page.waitForTimeout(300);
    expect(await runningAnimations(page)).toBe(0);
    await link(page).tap();
    expect(await clicks(page)).toEqual([true, false]);
    expect(await plays(page)).toBe(0);
  });
});

// Terminal view (Task F.7): the doodle is drawn in the tokens, so it turns terminal green with the rest of the page, and
// it's an icon-only link, so it has no [brackets]. Every other link on the doodle build has them.
test('in terminal view the doodle repaints in the terminal palette, and only marked links lack brackets', async ({
  page,
}) => {
  await open(page);
  const colors = () =>
    link(page).evaluate((el) => {
      const root = getComputedStyle(document.documentElement);
      return { dot: getComputedStyle(el).color, muted: root.getPropertyValue('--text-muted').trim() };
    });
  const regular = await colors();
  await page.getByRole('contentinfo').getByRole('button', { name: 'Terminal view', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-style', 'terminal');
  const terminal = await colors();
  expect(terminal.muted).toBe('#3fb054');
  expect(terminal.dot).toBe('rgb(63, 176, 84)');
  expect(terminal.dot).not.toBe(regular.dot);
  expect(await linksWithoutBrackets(page)).toEqual([]);
  await expect(link(page)).toHaveAttribute('data-no-brackets', '');
});

/** Links that neither show terminal brackets nor carry data-no-brackets (should be none). */
function linksWithoutBrackets(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    [...document.querySelectorAll('a')]
      .filter((a) => !a.hasAttribute('data-no-brackets'))
      .filter((a) => !getComputedStyle(a, '::before').content.includes('['))
      .map((a) => a.outerHTML.slice(0, 120)),
  );
}

for (const width of [375, 1280]) {
  for (const look of LOOKS) {
    test.describe(`${width}px ${look.name}`, () => {
      test.use({ viewport: { width, height: 800 }, colorScheme: look.colorScheme });

      test('no horizontal scroll with the bubble open, and the doodle inside the column, apart from the icons', async ({
        page,
      }) => {
        await useLook(page, look);
        await open(page);
        await page.evaluate(() => document.fonts.ready);
        await expectTheme(page, look.scheme);
        await link(page).hover();
        await expect(bubble(page)).toBeVisible();
        const { scrollWidth, clientWidth } = await page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
        }));
        expect(scrollWidth).toBeLessThanOrEqual(clientWidth);

        const column = (await page.locator('[data-hero] h1').locator('..').boundingBox())!;
        const doodle = (await link(page).boundingBox())!;
        const panel = (await bubble(page).locator('.doodle-bubble').boundingBox())!;
        expect(doodle.x + doodle.width).toBeLessThanOrEqual(column.x + column.width + 0.5);
        expect(panel.x).toBeGreaterThanOrEqual(0);
        expect(panel.x + panel.width).toBeLessThanOrEqual(width);
        // A touch target well over 44×44, and at least 24px from the last profile icon.
        expect(doodle.width).toBeGreaterThanOrEqual(44);
        expect(doodle.height).toBeGreaterThanOrEqual(44);
        const icons = (await page.getByRole('list', { name: 'Profiles' }).boundingBox())!;
        expect(doodle.x - (icons.x + icons.width)).toBeGreaterThanOrEqual(24);
      });
    });
  }
}
