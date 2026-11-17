// Terminal view (Task F.7) in a real browser, with the real CSP (wrangler dev): the footer switch and aria-pressed,
// saving and the no-flash reload, the keyboard, the hidden theme toggle, [brackets] kept out of accessible names (read
// from Chromium's own accessibility tree), the look itself, print, prefers-contrast and reduced motion, the 404 game's
// repaint, and no console or CSP problems. The layout checks (nav on one row, Hero CTAs, /resume contact line, game
// column, no horizontal scroll) run in terminal view too, in their own specs (LOOKS in helpers.ts). The doodle's
// repaint is in doodle.spec.ts (the doodle build). Values and tokens: tests/theme-*.test.ts, design-tokens.test.ts.

import { type Locator, type Page } from '@playwright/test';
import { expect, test } from './fixtures.ts';
import { FIRST_HIT_MAX_MS } from '../../src/lib/game/engine.ts';
import { STYLE_STORAGE_KEY, THEME_STORAGE_KEY } from '../../src/lib/theme.ts';
import { unexpectedConsoleProblems, type ConsoleEntry } from './console-problems.ts';
import {
  cspViolations,
  expectFocusRing,
  expectTheme,
  NAV_LINKS,
  saveStyleBeforeLoad,
  styleToggle,
  themeToggle,
  watchSecurityErrors,
} from './helpers.ts';

const PAGES = ['/', '/resume', '/no-such-page'];
const html = (page: Page) => page.locator('html');
const savedStyle = (page: Page) => page.evaluate((key) => localStorage.getItem(key), STYLE_STORAGE_KEY);

async function expectTerminal(page: Page, on: boolean): Promise<void> {
  if (on) await expect(html(page)).toHaveAttribute('data-style', 'terminal');
  else await expect(html(page)).not.toHaveAttribute('data-style');
  await expect(styleToggle(page)).toHaveAttribute('aria-pressed', String(on));
}

/**
 * The visible space inside a bracketed link: from the ink of "[" to the first ink of its content (icon or text), and
 * from the last ink of its content to the ink of "]". Glyph ink comes from canvas measureText in the link's own font;
 * an icon's ink from its path's getBBox(), scaled to its rendered size.
 */
function bracketGaps(link: Locator): Promise<{ left: number; right: number }> {
  return link.evaluate((a) => {
    const cs = getComputedStyle(a);
    const ctx = document.createElement('canvas').getContext('2d')!;
    ctx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    const rect = a.getBoundingClientRect();
    const contentLeft = rect.left + parseFloat(cs.paddingLeft) + parseFloat(cs.borderLeftWidth);
    const contentRight = rect.right - parseFloat(cs.paddingRight) - parseFloat(cs.borderRightWidth);
    const open = ctx.measureText('[');
    const close = ctx.measureText(']');
    const openInkRight = contentLeft + open.actualBoundingBoxRight;
    const closeInkLeft = contentRight - close.width - close.actualBoundingBoxLeft;

    /** Ink edges of a child: an <svg> by its drawing, a text node by its first or last visible character. */
    const ink = (node: Node, edge: 'left' | 'right'): number => {
      if (node instanceof SVGSVGElement) {
        const box = node.getBBox();
        const r = node.getBoundingClientRect();
        const scale = r.width / node.viewBox.baseVal.width;
        // getBBox() leaves out the stroke: a stroked icon's ink reaches half the stroke width further.
        const style = getComputedStyle(node.firstElementChild ?? node);
        const half = style.stroke === 'none' ? 0 : parseFloat(style.strokeWidth) / 2;
        return edge === 'left' ? r.left + (box.x - half) * scale : r.left + (box.x + box.width + half) * scale;
      }
      if (node instanceof Element) return ink(edge === 'left' ? node.firstChild! : node.lastChild!, edge);
      const text = node.textContent!;
      const index = edge === 'left' ? text.search(/\S/) : text.trimEnd().length - 1;
      const range = document.createRange();
      range.setStart(node, index);
      range.setEnd(node, index + 1);
      const r = range.getBoundingClientRect();
      const glyph = ctx.measureText(text[index]!);
      return edge === 'left' ? r.left - glyph.actualBoundingBoxLeft : r.left + glyph.actualBoundingBoxRight;
    };
    const visible = [...a.childNodes].filter((n) => n instanceof Element || n.textContent!.trim());
    return {
      left: ink(visible[0]!, 'left') - openInkRight,
      right: closeInkLeft - ink(visible.at(-1)!, 'right'),
    };
  });
}

/** The computed CSS of one element (or its pseudo-element). */
const cssOf = (locator: Locator, property: string, pseudo?: string) =>
  locator.evaluate((el, [prop, pseudoElt]) => getComputedStyle(el, pseudoElt).getPropertyValue(prop!), [
    property,
    pseudo,
  ] as const);

test('the switch is a button in the footer; a click toggles terminal view, saves it, and aria-pressed follows', async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/');
  await expectTerminal(page, false);
  await expectTheme(page, 'light');
  expect(await savedStyle(page)).toBeNull();

  await styleToggle(page).click();
  await expectTerminal(page, true);
  // Always dark, over a light OS.
  await expectTheme(page, 'dark');
  expect(await savedStyle(page)).toBe('terminal');

  await styleToggle(page).click();
  await expectTerminal(page, false);
  await expectTheme(page, 'light');
  expect(await savedStyle(page)).toBe('regular');
});

for (const path of PAGES) {
  test(`reload keeps terminal view on ${path}, set before first paint`, async ({ page }) => {
    // Records <html data-style> the moment <body> is inserted: after the inline <head> script, before anything is
    // rendered and before the toggle script runs.
    await page.addInitScript(() => {
      new MutationObserver((_, observer) => {
        if (!document.body) return;
        document.documentElement.dataset.styleAtBody = document.documentElement.dataset.style ?? 'none';
        observer.disconnect();
      }).observe(document, { childList: true, subtree: true });
    });
    await page.goto(path);
    await expect(html(page)).toHaveAttribute('data-style-at-body', 'none');
    await styleToggle(page).click();
    await expectTerminal(page, true);

    await page.reload();
    await expect(html(page)).toHaveAttribute('data-style-at-body', 'terminal');
    await expectTerminal(page, true);
  });
}

test('the switch shows a visible [on] marker in terminal view, kept out of its accessible name', async ({ page }) => {
  await page.goto('/');
  const marker = () => cssOf(styleToggle(page), 'content', '::after');
  expect(await marker()).toBe('none');

  await styleToggle(page).click();
  await expectTerminal(page, true);
  expect(await marker()).toContain('[on]');
  await expect(styleToggle(page)).toHaveAccessibleName('Terminal view');
  // Chromium's own name for the button, not Playwright's.
  const cdp = await page.context().newCDPSession(page);
  const { nodes } = (await cdp.send('Accessibility.getFullAXTree')) as {
    nodes: { role?: { value: string }; name?: { value: string } }[];
  };
  const buttons = nodes.filter((n) => n.role?.value === 'button').map((n) => n.name?.value ?? '');
  expect(buttons).toContain('Terminal view');
  expect(buttons.filter((name) => /\bon\b|\[|>_/.test(name))).toEqual([]);

  // Reload: the marker is there from the start (keyed on <html data-style>), and it goes when terminal view is off.
  await page.reload();
  expect(await marker()).toContain('[on]');
  await styleToggle(page).click();
  await expectTerminal(page, false);
  expect(await marker()).toBe('none');
});

test('keyboard: Tab reaches the switch with a focus ring; Enter and Space toggle it', async ({ page }) => {
  await page.goto('/no-such-page');
  const toggle = styleToggle(page);
  for (let i = 0; i < 40 && !(await toggle.evaluate((el) => el === document.activeElement)); i++) {
    await page.keyboard.press('Tab');
  }
  await expectFocusRing(toggle);

  await page.keyboard.press('Enter');
  await expectTerminal(page, true);
  await expectFocusRing(toggle);

  await page.keyboard.press('Space');
  await expectTerminal(page, false);
  await expectFocusRing(toggle);
});

test('in terminal view the theme toggle is hidden and out of the Tab order; the saved theme comes back after', async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');
  await themeToggle(page).click();
  await expectTheme(page, 'light');

  await styleToggle(page).click();
  await expectTheme(page, 'dark');
  await expect(page.locator('[data-theme-toggle]')).toBeHidden();
  // Tab from the top: the skip link, the home link, the nav links, then straight into the page.
  await page.keyboard.press('Tab');
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => document.activeElement?.hasAttribute('data-theme-toggle'))).toBe(false);
  }
  expect(await page.evaluate((key) => localStorage.getItem(key), THEME_STORAGE_KEY)).toBe('light');

  await styleToggle(page).click();
  await expectTheme(page, 'light');
  await expect(themeToggle(page)).toBeVisible();
});

test.describe('in terminal view', () => {
  test.beforeEach(({ page }) => saveStyleBeforeLoad(page, 'terminal'));

  test('text links show [brackets] that are not in the accessible name (Chromium’s accessibility tree)', async ({
    page,
  }) => {
    await page.goto('/');
    const nav = page.getByRole('navigation', { name: 'Main' });
    const resume = nav.getByRole('link', { name: 'Resume', exact: true });
    expect(await cssOf(resume, 'content', '::before')).toContain('[');
    expect(await cssOf(resume, 'content', '::after')).toContain(']');
    await expect(resume).toHaveAccessibleName('Resume');

    // The browser's own names, not Playwright's: the brackets' alt text ("") must win.
    const cdp = await page.context().newCDPSession(page);
    const { nodes } = (await cdp.send('Accessibility.getFullAXTree')) as {
      nodes: { role?: { value: string }; name?: { value: string } }[];
    };
    const linkNames = nodes.filter((n) => n.role?.value === 'link').map((n) => n.name?.value ?? '');
    for (const name of NAV_LINKS) expect(linkNames).toContain(name);
    expect(linkNames.filter((name) => /[[\]]/.test(name))).toEqual([]);
  });

  test.describe('at 375px', () => {
    test.use({ viewport: { width: 375, height: 800 } });

    test('the nav links drop their brackets (to stay on one row), the current page keeps its underline', async ({
      page,
    }) => {
      await page.goto('/resume');
      const nav = page.getByRole('navigation', { name: 'Main' });
      for (const a of await nav.locator('li a').all()) expect(await cssOf(a, 'content', '::before')).toBe('none');
      const current = nav.getByRole('link', { name: 'Resume', exact: true });
      await expect(current).toHaveAttribute('aria-current', 'page');
      expect(await cssOf(current, 'text-decoration-line')).toBe('underline');
      // Links in the page still have them.
      const home = page.locator('[data-resume-home] a');
      expect(await cssOf(home, 'content', '::before')).toContain('[');
    });
  });

  for (const width of [375, 1280]) {
    test.describe(`brackets at ${width}px`, () => {
      test.use({ viewport: { width, height: 800 } });

      // The footer, the /resume contact line, Contact, and the Hero (whose links are all marked: none to measure).
      for (const [path, selector] of [
        ['/', 'footer a:not([data-no-brackets])'],
        ['/', '[data-contact] a:not([data-no-brackets])'],
        ['/', '[data-hero] a:not([data-no-brackets])'],
        ['/resume', '[data-resume-contact] a:not([data-no-brackets])'],
      ] as const) {
        test(`links with an icon have even space inside their brackets: ${path} ${selector.split(' ')[0]}`, async ({
          page,
        }) => {
          await page.goto(path);
          await page.evaluate(() => document.fonts.ready);
          const links = await page
            .locator(selector)
            .filter({ has: page.locator('svg') })
            .all();
          if (selector.startsWith('[data-hero]')) expect(links).toHaveLength(0);
          for (const link of links) {
            if (!(await link.isVisible())) continue;
            const { left, right } = await bracketGaps(link);
            const name = (await link.textContent())!.trim();
            console.log(`${width}px ${name}: [${left.toFixed(1)}px … ${right.toFixed(1)}px]`);
            // The spacing is the same 0.5ch on both sides; what's left is ink: the side bearings of the glyphs next to
            // the brackets and the empty edge of an icon's drawing (Back to top's narrow chevron: 1.5px). Before the
            // even gap the footer's LinkedIn was 5.6 vs 1.4px.
            expect(Math.abs(left - right), `${name}: ${left.toFixed(1)} vs ${right.toFixed(1)}`).toBeLessThanOrEqual(
              1.6,
            );
          }
        });
      }
    });
  }

  for (const width of [640, 1280]) {
    test.describe(`footer at ${width}px`, () => {
      test.use({ viewport: { width, height: 800 } });

      test('the copyright is one line, and the links and the switch share one row below it', async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => document.fonts.ready);
        const footer = page.getByRole('contentinfo');
        const copyright = footer.locator('[data-footer-copyright]');
        const lines = await copyright.evaluate((el) => {
          const range = document.createRange();
          range.selectNodeContents(el);
          return new Set([...range.getClientRects()].map((r) => Math.round(r.top))).size;
        });
        expect(lines).toBe(1);
        const items = await footer.locator('li > *').all();
        const tops = await Promise.all(items.map(async (item) => Math.round((await item.boundingBox())!.y)));
        expect(new Set(tops).size).toBe(1);
        expect(tops[0]).toBeGreaterThan((await copyright.boundingBox())!.y);
      });
    });
  }

  // At the default 1280px, where every text link has brackets (below sm the nav links drop them, see above).
  for (const path of PAGES) {
    test(`every link on ${path} either shows brackets or is marked data-no-brackets`, async ({ page }) => {
      await page.goto(path);
      await expect(html(page)).toHaveAttribute('data-style', 'terminal');
      const unmarked = await page.evaluate(() =>
        [...document.querySelectorAll('a')]
          .filter((a) => !a.hasAttribute('data-no-brackets'))
          .filter((a) => !getComputedStyle(a, '::before').content.includes('['))
          .map((a) => a.outerHTML.slice(0, 120)),
      );
      expect(unmarked).toEqual([]);
      // And the marked ones really have none.
      for (const a of await page.locator('a[data-no-brackets]').all()) {
        expect(await cssOf(a, 'content', '::before')).toBe('none');
      }
    });
  }

  test('the look: mono everywhere, a glow, dashed square card borders, control edges in --text-muted', async ({
    page,
  }) => {
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
    const root = page.locator('html');
    const muted = await cssOf(root, '--text-muted');
    expect(muted).toBe('#3fb054');

    for (const el of [page.locator('h1'), page.locator('[data-hero-tagline]'), page.locator('nav a').first()]) {
      expect(await cssOf(el, 'font-family')).toMatch(/JetBrains Mono/);
    }
    expect(await cssOf(page.locator('h1'), 'text-shadow')).toMatch(/0px 0px/);

    const card = page.locator('[data-contact-card="email"]');
    expect(await cssOf(card, 'border-top-style')).toBe('dashed');
    expect(await cssOf(card, 'border-top-left-radius')).toBe('0px');

    const viewProjects = page.locator('[data-hero]').getByRole('link', { name: 'View Projects' });
    expect(await cssOf(viewProjects, 'border-top-color')).toBe('rgb(63, 176, 84)');
    expect(await cssOf(viewProjects, 'border-top-style')).toBe('dashed');

    // Topic chips (text on the --border fill) have no glow.
    const chip = page.locator('[data-project-topic]').first();
    if (await chip.count()) expect(await cssOf(chip, 'text-shadow')).toBe('none');
  });

  test('prefers-contrast: more removes the glow', async ({ page }) => {
    await page.emulateMedia({ contrast: 'more' });
    await page.goto('/');
    await expect(html(page)).toHaveAttribute('data-style', 'terminal');
    for (const el of [page.locator('h1'), page.locator('nav a').first(), page.locator('footer p').first()]) {
      expect(await cssOf(el, 'text-shadow')).toBe('none');
    }
    await page.emulateMedia({ contrast: 'no-preference' });
    expect(await cssOf(page.locator('h1'), 'text-shadow')).not.toBe('none');
  });

  test('print uses the regular print style: white, the regular fonts, no brackets, no glow', async ({ page }) => {
    await page.goto('/resume');
    await page.emulateMedia({ media: 'print' });
    // The built CSS is minified (#ffffff becomes #fff).
    expect(await cssOf(html(page), '--bg')).toMatch(/^#fff(fff)?$/);
    expect(await cssOf(page.locator('body'), 'background-color')).toBe('rgb(255, 255, 255)');
    const h1 = page.locator('h1');
    expect(await cssOf(h1, 'font-family')).toMatch(/Inter/);
    expect(await cssOf(h1, 'font-family')).not.toMatch(/JetBrains Mono/);
    expect(await cssOf(h1, 'text-shadow')).toBe('none');
    const profile = page.locator('[data-resume-profile]').first();
    expect(await cssOf(profile, 'content', '::before')).not.toContain('[');
    // The print stylesheet's own link URL is still there.
    expect(await cssOf(profile, 'content', '::after')).toContain('http');
  });

  for (const reducedMotion of ['reduce', 'no-preference'] as const) {
    test(`switching starts no animation or transition (prefers-reduced-motion: ${reducedMotion})`, async ({ page }) => {
      await page.emulateMedia({ reducedMotion });
      await page.goto('/');
      await styleToggle(page).click();
      await expectTerminal(page, false);
      expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
      expect(await cssOf(page.locator('body'), 'transition-duration')).toBe('0s');
    });
  }
});

test('the 404 game repaints in the terminal palette (it observes data-style)', async ({ page }) => {
  await page.goto('/no-such-page');
  await page.getByRole('button', { name: 'Play' }).click();
  const canvas = page.locator('[data-game-canvas]');
  // Never jumping, the round ends within FIRST_HIT_MAX_MS. Game over is a still frame, so only the data-style observer
  // can repaint it.
  await expect(canvas).toHaveAttribute('data-game-state', 'over', { timeout: FIRST_HIT_MAX_MS + 3000 });
  const corner = () =>
    canvas.evaluate((c: HTMLCanvasElement) => [...c.getContext('2d')!.getImageData(1, 1, 1, 1).data.slice(0, 3)]);
  const before = await corner();
  await styleToggle(page).click();
  await expectTerminal(page, true);
  // The canvas fill is --surface: #050805 in terminal view.
  await expect.poll(corner).toEqual([5, 8, 5]);
  expect(before).not.toEqual([5, 8, 5]);
});

test('no console problem and no CSP violation in terminal view, on every page', async ({ page }) => {
  const securityErrors = await watchSecurityErrors(page);
  const entries: ConsoleEntry[] = [];
  page.on('console', (m) => entries.push({ type: m.type(), text: m.text(), url: m.location().url }));
  await page.goto('/');
  await styleToggle(page).click();
  for (const path of PAGES) {
    await page.goto(path);
    await page.waitForLoadState('load');
    await expectTerminal(page, true);
  }
  expect(unexpectedConsoleProblems(entries, { expected404Url: page.url() })).toEqual([]);
  expect(securityErrors).toEqual([]);
  expect(await cspViolations(page)).toEqual([]);
});
