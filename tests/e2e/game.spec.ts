// The 404 game (Task F.3) in a real browser, with the real CSP (`wrangler dev` locally; the deployed site in the live
// run, npm run test:live, where it's read-only too: it only plays). The rules are unit-tested in
// tests/game-engine.test.ts; the built markup and the file sizes in tests/not-found-page.test.ts.
//
// The canvas exposes test hooks that change nothing for visitors: data-game-state, data-player-y and data-motion. The
// game file's name has a hash, so it's found by watching which script loads when Play is pressed.

import { type Page } from '@playwright/test';
import { expect, test } from './fixtures.ts';
import { FIRST_HIT_MAX_MS } from '../../src/lib/game/engine.ts';
import { BEST_SCORE_KEY } from '../../src/lib/game/best-score.ts';
import { THEMES } from '../../src/lib/theme.ts';
import { unexpectedConsoleProblems, type ConsoleEntry } from './console-problems.ts';
import { cspViolations, expectTheme, themeToggle, watchSecurityErrors } from './helpers.ts';

const PATH = '/no-such-page';
/** The first obstacle reaches a character that never jumps within FIRST_HIT_MAX_MS (engine guarantee), plus margin. */
const GAME_OVER_WITHIN_MS = FIRST_HIT_MAX_MS + 2000;

const canvas = (page: Page) => page.locator('[data-game-canvas]');
const playButton = (page: Page) => page.getByRole('button', { name: /^(Play|Restart|Continue|Play again)$/ });
const expectState = (page: Page, state: string, timeout?: number) =>
  expect(canvas(page)).toHaveAttribute('data-game-state', state, timeout ? { timeout } : undefined);

/** Every script URL the page requests from now on. */
function recordScripts(page: Page): string[] {
  const urls: string[] = [];
  page.on('request', (request) => {
    if (request.resourceType() === 'script') urls.push(request.url());
  });
  return urls;
}

/** Loads the 404 page and waits until it's idle. */
async function open(page: Page) {
  const response = await page.goto(PATH);
  expect(response?.status()).toBe(404);
  await page.waitForLoadState('load');
  await expectState(page, 'idle');
}

/** A description of the focused element, for following the Tab order. */
const focused = (page: Page) =>
  page.evaluate(() => {
    const el = document.activeElement;
    if (!el || el === document.body) return 'body';
    if (el.hasAttribute('data-not-found-home')) return 'home';
    if (el.hasAttribute('data-game-play')) return 'play';
    if (el.hasAttribute('data-game-canvas')) return 'canvas';
    return el.tagName.toLowerCase();
  });

test('the page still answers 404, and Back to home comes before Play and the game in Tab order', async ({ page }) => {
  await open(page);
  await expect(page.getByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible();
  const order: string[] = [];
  for (let i = 0; i < 30 && !order.includes('canvas'); i++) {
    await page.keyboard.press('Tab');
    order.push(await focused(page));
  }
  const at = (name: string) => order.indexOf(name);
  expect(at('home')).toBeGreaterThanOrEqual(0);
  expect(at('home')).toBeLessThan(at('play'));
  expect(at('play')).toBeLessThan(at('canvas'));
  await expect(canvas(page)).toHaveAccessibleName('Lost page game');
  await expect(canvas(page)).toHaveAccessibleDescription(/Press Space or tap to play and jump/);
});

test('nothing moves and no game file loads until Play; Play loads it and starts at once', async ({ page }) => {
  const scripts = recordScripts(page);
  await open(page);
  const first = await canvas(page).screenshot();
  await page.waitForTimeout(500);
  expect((await canvas(page).screenshot()).equals(first)).toBe(true);
  await expectState(page, 'idle');
  const before = [...scripts];

  await playButton(page).click();
  await expectState(page, 'running');
  await expect(canvas(page)).toBeFocused();
  await expect(playButton(page)).toHaveText('Restart');
  const loaded = scripts.filter((url) => !before.includes(url));
  expect(loaded).toHaveLength(1);
  expect(new URL(loaded[0]!).pathname).toMatch(/^\/_astro\/.+\.js$/);
});

test.describe('Space on the focused game', () => {
  // Reduced motion turns off the site's smooth scrolling, so focusing the canvas scrolls it into view at once, and a
  // Space that scrolled the page would show at once too.
  test.use({ reducedMotion: 'reduce' });

  test('starts it without scrolling the page', async ({ page }) => {
    await open(page);
    await canvas(page).focus();
    const before = await page.evaluate(() => window.scrollY);
    await page.keyboard.press('Space');
    await expectState(page, 'running');
    expect(await page.evaluate(() => window.scrollY)).toBe(before);
  });
});

test.describe('on a touch screen', () => {
  test.use({ hasTouch: true });

  test('a tap starts the game, and another tap jumps', async ({ page }) => {
    await open(page);
    await canvas(page).tap();
    await expectState(page, 'running');
    await canvas(page).tap();
    await expect.poll(async () => Number(await canvas(page).getAttribute('data-player-y'))).toBeGreaterThan(0);
  });
});

test('Space jumps: the character goes up, then lands', async ({ page }) => {
  await open(page);
  await playButton(page).click();
  await expectState(page, 'running');
  await expect(canvas(page)).toHaveAttribute('data-player-y', '0');
  await page.keyboard.press('Space');
  await expect.poll(async () => Number(await canvas(page).getAttribute('data-player-y'))).toBeGreaterThan(20);
  await expect(canvas(page)).toHaveAttribute('data-player-y', '0');
});

test('not jumping ends the round in time; the result is announced once; Enter plays again', async ({ page }) => {
  await open(page);
  const status = page.locator('[data-game-status]');
  await expect(status).toHaveText('');
  await playButton(page).click();
  await expectState(page, 'over', GAME_OVER_WITHIN_MS);
  await expect(status).toHaveAttribute('aria-live', 'polite');
  await expect(status).toContainText('Game over.');
  await expect(status).toContainText('Press Enter or tap to play again.');

  const line = (await page.locator('[data-game-score]').textContent()) ?? '';
  const [, score, best] = line.match(/^Score (\d+) · Best (\d+)$/) ?? [];
  expect(Number(score)).toBeGreaterThan(0);
  expect(best).toBe(score);
  expect(await page.evaluate((key) => localStorage.getItem(key), BEST_SCORE_KEY)).toBe(best);

  await page.keyboard.press('Enter');
  await expectState(page, 'running');
  await expect(status).toHaveText('');
});

test('the game pauses when the tab is hidden, and the next press goes on', async ({ page }) => {
  await open(page);
  await playButton(page).click();
  await expectState(page, 'running');
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expectState(page, 'paused');
  await expect(playButton(page)).toHaveText('Continue');
  const y = await canvas(page).screenshot();
  await page.waitForTimeout(300);
  expect((await canvas(page).screenshot()).equals(y)).toBe(true);
  await page.keyboard.press('Space');
  await expectState(page, 'running');
});

/** The score shown in the score line. */
const shownScore = async (page: Page) =>
  Number((await page.locator('[data-game-score]').textContent())?.match(/Score (\d+)/)?.[1]);

/** Moves focus to the page itself (<body>), as after a click on plain text. */
const focusBody = (page: Page) => page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());

test('Restart restarts even in the Safari order: pointerdown, the canvas loses focus to nothing, then click', async ({
  page,
}) => {
  await open(page);
  await playButton(page).click();
  await expectState(page, 'running');
  await expect.poll(() => shownScore(page)).toBeGreaterThan(4);
  await expect(playButton(page)).toHaveText('Restart');
  // Safari and Firefox on macOS don't focus a clicked button: the canvas just loses focus (no relatedTarget).
  await playButton(page).dispatchEvent('pointerdown', { isPrimary: true });
  await canvas(page).evaluate((el) => el.blur());
  await playButton(page).evaluate((el) => (el as HTMLButtonElement).click());
  await expectState(page, 'running');
  await expect(page.locator('[data-game-score]')).toHaveText(/^Score [0-4] ·/);
});

test('Continue goes on with the same round', async ({ page }) => {
  await open(page);
  await playButton(page).click();
  await expectState(page, 'running');
  await expect.poll(() => shownScore(page)).toBeGreaterThan(4);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expectState(page, 'paused');
  const paused = await shownScore(page);
  await playButton(page).click();
  await expectState(page, 'running');
  expect(await shownScore(page)).toBeGreaterThanOrEqual(paused);
  await expect(canvas(page)).toBeFocused();
});

test('the canvas losing focus does not pause the game', async ({ page }) => {
  await open(page);
  await playButton(page).click();
  await expectState(page, 'running');
  await page.getByRole('link', { name: 'Back to home' }).focus();
  await page.waitForTimeout(300);
  await expectState(page, 'running');
  await focusBody(page);
  await page.waitForTimeout(300);
  await expectState(page, 'running');
});

test.describe('keys on the page itself', () => {
  // No smooth scrolling, so a scroll (from focusing the canvas, or a Space the game didn't stop) shows at once.
  test.use({ reducedMotion: 'reduce' });

  test('Space with focus on the page starts the game and gives it focus', async ({ page }) => {
    await open(page);
    await focusBody(page);
    expect(await page.evaluate(() => document.activeElement === document.body)).toBe(true);
    await page.keyboard.press('Space');
    await expectState(page, 'running');
    await expect(canvas(page)).toBeFocused();
  });

  test('Space with focus on the page jumps without scrolling it', async ({ page }) => {
    await open(page);
    await playButton(page).click();
    await expectState(page, 'running');
    await focusBody(page);
    const before = await page.evaluate(() => window.scrollY);
    await page.keyboard.press('Space');
    await expect.poll(async () => Number(await canvas(page).getAttribute('data-player-y'))).toBeGreaterThan(0);
    expect(await page.evaluate(() => window.scrollY)).toBe(before);
  });

  test('Enter with focus on the page plays again after game over', async ({ page }) => {
    await open(page);
    await playButton(page).click();
    await expectState(page, 'over', GAME_OVER_WITHIN_MS);
    await focusBody(page);
    await page.keyboard.press('Enter');
    await expectState(page, 'running');
  });

  test('Space on "Back to home" does not start the game, and Enter there still follows the link', async ({ page }) => {
    const scripts = recordScripts(page);
    await open(page);
    const atLoad = scripts.length;
    const home = page.getByRole('link', { name: 'Back to home' });
    await home.focus();
    await page.keyboard.press('Space');
    await page.waitForTimeout(300);
    await expectState(page, 'idle');
    expect(scripts.length).toBe(atLoad);
    await home.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('[data-hero]')).toBeVisible();
    expect(new URL(page.url()).pathname).toBe('/');
  });
});

test('the colors follow the theme toggle while playing', async ({ page }) => {
  await open(page);
  await playButton(page).click();
  await expectState(page, 'running');
  // The canvas's top-left pixel is the --surface token, in either theme.
  const matches = () =>
    page.evaluate(() => {
      const c = document.querySelector<HTMLCanvasElement>('[data-game-canvas]')!;
      const [r, g, b, a] = c.getContext('2d')!.getImageData(2, 2, 1, 1).data;
      // Normalized by a 2D context (the built CSS may shorten #ffffff to #fff).
      const probe = document.createElement('canvas').getContext('2d')!;
      probe.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--surface').trim();
      const hex = String(probe.fillStyle);
      const want = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
      return { got: [r, g, b], want, drawn: a === 255 };
    });
  // The first frame is drawn on the next animation frame.
  await expect.poll(async () => (await matches()).drawn).toBe(true);
  const before = await matches();
  expect(before.got).toEqual(before.want);
  await themeToggle(page).click();
  await expect.poll(async () => (await matches()).got).not.toEqual(before.got);
  const after = await matches();
  expect(after.got).toEqual(after.want);
});

for (const reducedMotion of ['reduce', 'no-preference'] as const) {
  test.describe(`prefers-reduced-motion: ${reducedMotion}`, () => {
    test.use({ reducedMotion });

    test('no autostart; Play runs the game, calmer with reduced motion', async ({ page }) => {
      await open(page);
      await page.waitForTimeout(500);
      await expectState(page, 'idle');
      await playButton(page).click();
      await expectState(page, 'running');
      await expect(canvas(page)).toHaveAttribute('data-motion', reducedMotion === 'reduce' ? 'reduced' : 'full');
    });
  });
}

test('no console problem and no CSP violation, before and during a round', async ({ page }) => {
  const securityErrors = await watchSecurityErrors(page);
  const entries: ConsoleEntry[] = [];
  page.on('console', (m) => entries.push({ type: m.type(), text: m.text(), url: m.location().url }));
  await open(page);
  await playButton(page).click();
  await page.keyboard.press('Space');
  await expectState(page, 'over', GAME_OVER_WITHIN_MS + 1000);
  expect(unexpectedConsoleProblems(entries, { expected404Url: page.url() })).toEqual([]);
  expect(securityErrors).toEqual([]);
  expect(await cspViolations(page)).toEqual([]);
});

test('no game on / or /resume: no markup, and neither the loader nor the game file is requested', async ({ page }) => {
  const scripts = recordScripts(page);
  await open(page);
  const atLoad = new Set(scripts);
  await playButton(page).click();
  await expectState(page, 'running');
  const game = scripts.filter((url) => !atLoad.has(url));
  const loader = [...atLoad].filter((url) => new URL(url).pathname.includes('LostPageGame'));
  expect(game).toHaveLength(1);
  expect(loader).toHaveLength(1);
  const paths = [...game, ...loader].map((url) => new URL(url).pathname);

  for (const path of ['/', '/resume']) {
    scripts.length = 0;
    await page.goto(path);
    await page.waitForLoadState('load');
    await expect(page.locator('[data-game]')).toHaveCount(0);
    expect(scripts.map((url) => new URL(url).pathname).filter((p) => paths.includes(p))).toEqual([]);
  }
});

for (const { width, height, edge } of [
  { width: 1280, height: 800, edge: 'bottom' },
  { width: 375, height: 667, edge: 'top' },
] as const) {
  test.describe(`${width}x${height}`, () => {
    test.use({ viewport: { width, height } });

    test(`the game's ${edge} edge is on screen without scrolling`, async ({ page }) => {
      await open(page);
      const box = await page.evaluate(() => {
        const r = document.querySelector('[data-game-canvas]')!.getBoundingClientRect();
        return { top: r.top, bottom: r.bottom, scrollY: window.scrollY, innerHeight: window.innerHeight };
      });
      expect(box.scrollY).toBe(0);
      expect(box[edge]).toBeLessThanOrEqual(box.innerHeight);
    });
  });
}

for (const width of [375, 1280]) {
  for (const theme of THEMES) {
    test.describe(`game at ${width}px, ${theme}`, () => {
      test.use({ viewport: { width, height: 800 }, colorScheme: theme });

      test('no horizontal scroll, and the game fits the column, before and during play', async ({ page }) => {
        await open(page);
        await expectTheme(page, theme);
        const check = async () => {
          const box = await page.evaluate(() => {
            const c = document.querySelector('[data-game-canvas]')!.getBoundingClientRect();
            const column = document.querySelector('[data-game]')!.getBoundingClientRect();
            return {
              scrollWidth: document.documentElement.scrollWidth,
              clientWidth: document.documentElement.clientWidth,
              canvas: { left: c.left, right: c.right, height: c.height },
              column: { left: column.left, right: column.right },
            };
          });
          expect(box.scrollWidth).toBeLessThanOrEqual(box.clientWidth);
          expect(box.canvas.left).toBeGreaterThanOrEqual(box.column.left);
          expect(box.canvas.right).toBeLessThanOrEqual(box.column.right);
          expect(box.canvas.right).toBeLessThanOrEqual(box.clientWidth);
          expect(box.canvas.height).toBeGreaterThan(100);
        };
        await check();
        await playButton(page).click();
        await expectState(page, 'running');
        await check();
      });
    });
  }
}
