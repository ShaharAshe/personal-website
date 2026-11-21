// Motion (Task 3.4, design-doc §10) in a real browser, with the real CSP (wrangler dev here; also in the live run,
// playwright.live.config.ts): the section entrance (once, never hiding anything without JS, in print, with reduced
// motion or for a /#hash target), the project card's hover lift (transform only), the theme and terminal view
// crossfade and the cross-document View Transition (opacity only), no layout shift, and nothing at all with
// prefers-reduced-motion: reduce. Every test also fails on a console problem or a CSP violation. The built CSS and HTML
// are checked by tests/reveal.test.ts (npm test).
//
// Every test sets reducedMotion itself: left unset, the browser follows the OS setting.

import { type Page } from '@playwright/test';
import { expect, test } from './fixtures.ts';
import { type ConsoleEntry, unexpectedConsoleProblems } from './console-problems.ts';
import {
  LOOKS,
  cspViolations,
  expectTheme,
  styleToggle,
  themeToggle,
  useLook,
  waitForRevealed,
  watchSecurityErrors,
} from './helpers.ts';

const SECTIONS = ['experience', 'projects', 'skills', 'contact'];
const NOT_FOUND = '/no-such-page';

// --- Console and CSP, after every test ---

let consoleEntries: ConsoleEntry[] = [];
let securityErrors: string[] = [];

test.beforeEach(async ({ page }) => {
  consoleEntries = [];
  page.on('console', (m) => consoleEntries.push({ type: m.type(), text: m.text(), url: m.location().url }));
  securityErrors = await watchSecurityErrors(page);
});

test.afterEach(async ({ page }) => {
  const expected404Url = new URL(NOT_FOUND, page.url()).href;
  expect(unexpectedConsoleProblems(consoleEntries, { expected404Url })).toEqual([]);
  expect(securityErrors).toEqual([]);
  expect(await cspViolations(page)).toEqual([]);
});

// --- Helpers ---

interface Recorded {
  /** animationstart / transitionrun events anywhere in the document, as "type:name". */
  events: string[];
  /** Calls to document.startViewTransition(). */
  startCalls: number;
  /** For a page reached by navigation: whether it arrived with a View Transition (pagereveal). */
  arrivedWithTransition: boolean | null;
  /** The View Transition animations once the last transition was ready. */
  transitionAnimations: { pseudo: string; properties: string[]; duration: number }[] | null;
}

declare global {
  interface Window {
    __motion?: Recorded;
  }
}

/** Records every animation and transition from the first moment of every page load (call before page.goto). */
async function recordMotion(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const motion: Recorded = { events: [], startCalls: 0, arrivedWithTransition: null, transitionAnimations: null };
    window.__motion = motion;
    document.addEventListener('animationstart', (e) => motion.events.push(`animationstart:${e.animationName}`), true);
    document.addEventListener('transitionrun', (e) => motion.events.push(`transitionrun:${e.propertyName}`), true);

    const SKIP = new Set(['offset', 'computedOffset', 'easing', 'composite']);
    const describe = () =>
      document
        .getAnimations()
        .map((animation) => animation.effect as KeyframeEffect)
        .filter((effect) => effect.pseudoElement?.startsWith('::view-transition'))
        .map((effect) => ({
          pseudo: effect.pseudoElement ?? '',
          properties: [...new Set(effect.getKeyframes().flatMap((frame) => Object.keys(frame)))]
            .filter((key) => !SKIP.has(key))
            .sort(),
          duration: Number(effect.getTiming().duration),
        }));
    const watch = (transition: ViewTransition) =>
      transition.ready.then(
        () => (motion.transitionAnimations = describe()),
        () => {},
      );

    const start = Document.prototype.startViewTransition;
    if (start) {
      Document.prototype.startViewTransition = function (this: Document, ...args: Parameters<typeof start>) {
        motion.startCalls++;
        const transition = start.apply(this, args);
        void watch(transition);
        return transition;
      } as typeof start;
    }
    window.addEventListener('pagereveal', (event) => {
      const { viewTransition } = event as Event & { viewTransition: ViewTransition | null };
      motion.arrivedWithTransition = viewTransition !== null;
      if (viewTransition) void watch(viewTransition);
    });
  });
}

const recorded = (page: Page) => page.evaluate(() => window.__motion!);
const runningAnimations = (page: Page) => page.evaluate(() => document.getAnimations().length);

/** Scrolls to the bottom in half-screen steps, a frame or two each, then waits out any entrance. */
async function scrollThrough(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));
    for (let y = 0; y < document.documentElement.scrollHeight; y += innerHeight / 2) {
      scrollTo({ top: y, behavior: 'instant' });
      await frame();
      await frame();
    }
    scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' });
    await frame();
  });
  await page.waitForTimeout(700);
}

/**
 * A section's data-reveal value, and the opacity and transform of the section and its children (the entrance moves the
 * children, global.css), each as the distinct values joined by " | ": one value when they all agree.
 */
const visibilityOf = (page: Page, id: string) =>
  page.locator(id === 'hero' ? '[data-hero]' : `#${id}`).evaluate((el) => {
    const styles = [el, ...el.children].map((node) => getComputedStyle(node));
    const distinct = (values: string[]) => [...new Set(values)].join(' | ');
    return {
      opacity: distinct(styles.map((style) => style.opacity)),
      transform: distinct(styles.map((style) => style.transform)),
      state: el.getAttribute('data-reveal'),
    };
  });

async function expectSectionsFullyVisible(page: Page): Promise<void> {
  for (const id of ['hero', ...SECTIONS]) {
    expect(await visibilityOf(page, id), id).toMatchObject({ opacity: '1', transform: 'none' });
  }
}

/** Waits until nothing on the page is animating. Not a guard before a measurement: see waitForRevealed (helpers.ts). */
const settle = (page: Page) => expect.poll(() => runningAnimations(page)).toBe(0);

// --- Visible without JS and in print ---

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false, reducedMotion: 'no-preference', viewport: { width: 1280, height: 800 } });

  test('every homepage section is fully visible, before and after scrolling', async ({ page }) => {
    await page.goto('/');
    await expectSectionsFullyVisible(page);
    await page.mouse.wheel(0, 10000);
    await expectSectionsFullyVisible(page);
  });
});

for (const look of LOOKS) {
  test.describe(`print, ${look.name}`, () => {
    test.use({ reducedMotion: 'no-preference', colorScheme: look.colorScheme, viewport: { width: 1280, height: 800 } });

    test('every homepage section is fully visible in print, even one still waiting for its entrance', async ({
      page,
    }) => {
      await useLook(page, look);
      await page.goto('/');
      // Control: on screen, Contact is below the fold and its content waits hidden for its entrance.
      expect(await visibilityOf(page, 'contact')).toMatchObject({ opacity: '1 | 0', state: 'pending' });
      await page.emulateMedia({ media: 'print' });
      await expectSectionsFullyVisible(page);
    });
  });
}

// --- Reduced motion: nothing moves ---

test.describe('prefers-reduced-motion: reduce', () => {
  test.use({ reducedMotion: 'reduce', colorScheme: 'dark', viewport: { width: 1280, height: 800 } });

  test('no animation while scrolling, hovering a card, switching theme and style, and navigating', async ({ page }) => {
    await recordMotion(page);
    await page.goto('/');
    const nothingMoves = async (step: string) => {
      expect(await runningAnimations(page), step).toBe(0);
      expect((await recorded(page)).events, step).toEqual([]);
      expect((await recorded(page)).startCalls, step).toBe(0);
    };

    await expectSectionsFullyVisible(page);
    await scrollThrough(page);
    await nothingMoves('scrolling');
    for (const id of SECTIONS) expect((await visibilityOf(page, id)).state, id).toBe('');

    const card = page.locator('[data-project-card]').first();
    await card.hover({ position: { x: 8, y: 8 } });
    await nothingMoves('hovering a card');
    await expect(card).toHaveCSS('transform', 'none');

    await themeToggle(page).click();
    await expectTheme(page, 'light');
    await nothingMoves('switching the theme');

    await styleToggle(page).click();
    await expect(page.locator('html')).toHaveAttribute('data-style', 'terminal');
    await nothingMoves('switching to terminal view');

    await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Resume' }).click();
    await page.waitForURL('**/resume');
    // pagereveal fires at the new page's first rendering opportunity, which can come after "load": wait for it.
    await expect.poll(async () => (await recorded(page)).arrivedWithTransition).not.toBeNull();
    expect((await recorded(page)).arrivedWithTransition).toBe(false);
    await nothingMoves('navigating to /resume');
  });
});

// --- Normal motion ---

for (const width of [375, 1280]) {
  test.describe(`section entrance at ${width}px`, () => {
    test.use({ reducedMotion: 'no-preference', viewport: { width, height: 800 } });

    test('a section below the fold enters once (a keyframes animation), never replayed', async ({ page }) => {
      await page.goto('/');
      const skills = page.locator('#skills');
      // The section's own box never moves (a /#hash jump scrolls to it); its children wait hidden, 12px down.
      expect(await visibilityOf(page, 'skills')).toEqual({
        opacity: '1 | 0',
        transform: 'none | matrix(1, 0, 0, 1, 0, 12)',
        state: 'pending',
      });
      // Every animation or transition that starts in the section, as "<child index>:<name>" (-1 = the section itself).
      await skills.evaluate((el) => {
        const runs: string[] = [];
        const record = (e: Event, name: string) => {
          const index = e.target === el ? -1 : [...el.children].indexOf(e.target as Element);
          runs.push(`${index}:${name}`);
        };
        el.addEventListener('animationstart', (e) => record(e, (e as AnimationEvent).animationName));
        el.addEventListener('transitionrun', (e) => record(e, (e as TransitionEvent).propertyName));
        (el as HTMLElement & { runs?: string[] }).runs = runs;
      });
      const runs = () => skills.evaluate((el) => [...((el as HTMLElement & { runs?: string[] }).runs ?? [])].sort());
      const expected = await skills.evaluate((el) => [...el.children].map((_, i) => `${i}:reveal-in`).sort());

      await skills.evaluate((el) => el.scrollIntoView({ behavior: 'instant', block: 'start' }));
      await expect(skills).toHaveAttribute('data-reveal', 'done');
      await waitForRevealed(skills);
      expect(await visibilityOf(page, 'skills')).toEqual({ opacity: '1', transform: 'none', state: 'done' });
      expect(await runs()).toEqual(expected);

      // Away and back: no second entrance.
      await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
      await page.waitForTimeout(200);
      await skills.evaluate((el) => el.scrollIntoView({ behavior: 'instant', block: 'start' }));
      await page.waitForTimeout(700);
      expect(await runs()).toEqual(expected);
      expect(await visibilityOf(page, 'skills')).toEqual({ opacity: '1', transform: 'none', state: 'done' });

      // A later style change (the theme, terminal view on and off) doesn't replay it either: the entrance is a keyframes
      // animation (Task 3.4a), which would restart only if its animation property changed.
      await themeToggle(page).click();
      await styleToggle(page).click();
      await styleToggle(page).click();
      await skills.evaluate((el) => el.scrollIntoView({ behavior: 'instant', block: 'start' }));
      await page.waitForTimeout(700);
      expect(await runs()).toEqual(expected);
      expect(await visibilityOf(page, 'skills')).toEqual({ opacity: '1', transform: 'none', state: 'done' });
    });

    // Opened fresh with a hash (not scrolled to): the target is never hidden, wherever the browser's jump lands.
    for (const id of ['contact', 'projects']) {
      test(`/#${id} opened directly shows the section fully visible within a second`, async ({ page }) => {
        await page.goto(`/#${id}`);
        await expect
          .poll(() => visibilityOf(page, id), { timeout: 1000, intervals: [50] })
          .toMatchObject({ opacity: '1', transform: 'none' });
        expect((await visibilityOf(page, id)).state).not.toBe('pending');
      });
    }
  });
}

for (const look of LOOKS) {
  test.describe(`card hover, ${look.name}`, () => {
    test.use({ reducedMotion: 'no-preference', colorScheme: look.colorScheme, viewport: { width: 1280, height: 800 } });

    test('hovering a project card changes its transform and nothing else', async ({ page }) => {
      await useLook(page, look);
      await page.goto('/');
      const card = page.locator('[data-project-card]').first();
      await card.evaluate((el) => el.scrollIntoView({ behavior: 'instant', block: 'center' }));
      await waitForRevealed(page.locator('#projects'));
      // Off the card first, so it starts unhovered, and at rest.
      await page.mouse.move(1, 1);
      await expect(card).toHaveCSS('transform', 'none');
      const style = () =>
        card.evaluate((el) => {
          const computed = getComputedStyle(el);
          return Object.fromEntries([...computed].map((name) => [name, computed.getPropertyValue(name)]));
        });
      const before = await style();
      expect(before['transition-property']).toBe('transform');

      await card.hover({ position: { x: 8, y: 8 } });
      // The final value itself, not "no animation running" (which can pass before the transition starts): mid-way the
      // matrix holds a fraction of -2.
      await expect(card).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 0, -2)');
      const after = await style();
      const changed = Object.keys(after).filter((name) => after[name] !== before[name]);
      expect(changed).toEqual(['transform']);
      expect(after.transform).toBe('matrix(1, 0, 0, 1, 0, -2)');
    });
  });
}

test.describe('crossfades', () => {
  test.use({ reducedMotion: 'no-preference', colorScheme: 'dark', viewport: { width: 1280, height: 800 } });

  /** Every View Transition animation: only the root's old and new snapshots, opacity only, 200ms. */
  async function expectOpacityCrossfade(page: Page): Promise<void> {
    await expect.poll(async () => (await recorded(page)).transitionAnimations).not.toBeNull();
    const animations = (await recorded(page)).transitionAnimations!;
    expect(animations.length).toBeGreaterThan(0);
    for (const { pseudo, properties, duration } of animations) {
      expect(pseudo).toMatch(/^::view-transition-(old|new)\(root\)$/);
      // The UA's crossfade is two animations per snapshot: the fade (opacity) and a plus-lighter blend (mix-blend-mode,
      // no movement: it keeps the mid-fade from dimming). Nothing else may animate.
      expect(
        properties.filter((p) => p !== 'opacity' && p !== 'mixBlendMode'),
        pseudo,
      ).toEqual([]);
      expect(duration).toBe(200);
    }
    expect(animations.some(({ properties }) => properties.includes('opacity'))).toBe(true);
  }

  test('the theme switch crossfades', async ({ page }) => {
    await recordMotion(page);
    await page.goto('/');
    await themeToggle(page).click();
    await expectTheme(page, 'light');
    expect((await recorded(page)).startCalls).toBe(1);
    await expectOpacityCrossfade(page);
  });

  test('the terminal view switch crossfades, both ways', async ({ page }) => {
    await recordMotion(page);
    await page.goto('/');
    await styleToggle(page).click();
    await expect(page.locator('html')).toHaveAttribute('data-style', 'terminal');
    await expect(styleToggle(page)).toHaveAttribute('aria-pressed', 'true');
    await expectOpacityCrossfade(page);
    await settle(page);
    await styleToggle(page).click();
    await expect(page.locator('html')).not.toHaveAttribute('data-style', /./);
    await expect(styleToggle(page)).toHaveAttribute('aria-pressed', 'false');
    expect((await recorded(page)).startCalls).toBe(2);
  });

  // A cross-document View Transition is best-effort: the browser may skip it and just navigate (seen in 2 of 10 runs
  // on Linux). So this doesn't require one; when one runs, it must be the opacity-only crossfade. That the site opts in
  // is checked deterministically by the CSSOM test below.
  test('a link to another page: when the browser runs a transition, it is the opacity crossfade', async ({ page }) => {
    await recordMotion(page);
    await page.goto('/');
    await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Resume' }).click();
    await page.waitForURL('**/resume');
    await expect.poll(async () => (await recorded(page)).arrivedWithTransition).not.toBeNull();
    if ((await recorded(page)).arrivedWithTransition) await expectOpacityCrossfade(page);
  });

  test('the page opts in: @view-transition { navigation: auto } inside a no-preference query', async ({ page }) => {
    await page.goto('/');
    const parents = await page.evaluate(() => {
      const found: string[] = [];
      const walk = (rules: CSSRuleList) => {
        for (const rule of rules) {
          if (rule.cssText.startsWith('@view-transition')) {
            const parent = rule.parentRule;
            // As the browser parsed it (CSSViewTransitionRule.navigation), not just as text.
            const navigation = (rule as CSSRule & { navigation?: string }).navigation;
            found.push(`${parent instanceof CSSMediaRule ? parent.media.mediaText : 'top level'} → ${navigation}`);
          }
          if ('cssRules' in rule) walk((rule as CSSGroupingRule).cssRules);
        }
      };
      for (const sheet of document.styleSheets) walk(sheet.cssRules);
      return found;
    });
    expect(parents).toEqual(['(prefers-reduced-motion: no-preference) → auto']);
  });
});

// --- No layout shift ---

interface Shift {
  time: number;
  value: number;
  hadRecentInput: boolean;
  sources: string[];
}

for (const look of LOOKS) {
  test.describe(`layout shift, ${look.name}`, () => {
    test.use({ reducedMotion: 'no-preference', colorScheme: look.colorScheme, viewport: { width: 375, height: 800 } });

    // Nothing shifts from the first paint to the bottom of the page: the entrance and the card hover (3.4), and the
    // font swap on a normal first visit (cold cache), which the preloads (Task 3.4a) bring in before first paint. The
    // swap forced after first paint, which measures the fallbacks themselves, is in tests/e2e/fonts.spec.ts. Every shift
    // is recorded with its time and sources, so a failure says what moved.
    for (const path of ['/', '/resume', NOT_FOUND]) {
      test(`${path}: no layout shift from first paint, while scrolling to the bottom`, async ({ page }) => {
        await useLook(page, look);
        await page.addInitScript(() => {
          const shifts: Shift[] = [];
          (window as Window & { __shifts?: Shift[] }).__shifts = shifts;
          const describe = (node: Node | null) =>
            node instanceof Element ? `${node.tagName.toLowerCase()}${node.id ? `#${node.id}` : ''}` : String(node);
          new PerformanceObserver((list) => {
            for (const entry of list.getEntries() as (PerformanceEntry & {
              value: number;
              hadRecentInput: boolean;
              sources: { node: Node | null }[];
            })[]) {
              shifts.push({
                time: Math.round(entry.startTime),
                value: entry.value,
                hadRecentInput: entry.hadRecentInput,
                sources: entry.sources.map(({ node }) => describe(node)),
              });
            }
          }).observe({ type: 'layout-shift', buffered: true });
        });
        await page.goto(path);
        await page.evaluate(async () => {
          await document.fonts.ready;
          const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));
          await frame();
          await frame();
        });
        await scrollThrough(page);
        const shifts = await page.evaluate(() => (window as Window & { __shifts?: Shift[] }).__shifts ?? []);
        const total = shifts.reduce((sum, { value }) => sum + value, 0);
        test.info().annotations.push({ type: 'layout shift from first paint', description: total.toFixed(5) });
        expect(shifts).toEqual([]);
      });
    }
  });
}
