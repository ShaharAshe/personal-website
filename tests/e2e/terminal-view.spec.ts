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
 * The space inside a bracketed link, from layout boxes only (glyph ink differs between platforms, so it isn't used).
 * The brackets are pseudo-elements, which have no box to measure, so for the measurement they're swapped for real
 * spans with the same character and the same computed margins, in the same places. Then, to the boxes of the first and
 * last non-space characters (so whitespace rendered as extra space counts as space): from "[" to the link's first
 * content, from its last content (on its last line) to "]", and between the icon and the text. A "]" stranded away
 * from the text (a wrapped flex link) shows as a large right gap. Everything is put back after.
 */
function bracketGaps(link: Locator): Promise<{ left: number; right: number; inner: number; lines: number }> {
  return link.evaluate((a) => {
    const visible = [...a.childNodes].filter((n) => n instanceof Element || n.textContent!.trim());
    const standIn = (text: string, pseudo: '::before' | '::after') => {
      const style = getComputedStyle(a, pseudo);
      const span = document.createElement('span');
      span.textContent = text;
      span.style.marginInlineStart = style.marginInlineStart;
      span.style.marginInlineEnd = style.marginInlineEnd;
      return span;
    };
    const open = standIn('[', '::before');
    const close = standIn(']', '::after');

    // A constructed stylesheet: the CSP blocks an injected <style>, not CSSOM.
    const sheet = new CSSStyleSheet();
    sheet.replaceSync('[data-measuring]::before, [data-measuring]::after { content: none !important; }');
    const sheets = document.adoptedStyleSheets;
    document.adoptedStyleSheets = [...sheets, sheet];
    a.setAttribute('data-measuring', '');
    a.prepend(open);
    a.append(close);

    /** The text node holding a child's text: the node itself, or the first text inside an element (the address span). */
    const textOf = (node: Node): Text => {
      if (node instanceof Text) return node;
      return document.createTreeWalker(node, NodeFilter.SHOW_TEXT).nextNode() as Text;
    };
    /** The layout box of a text's first or last non-space character. */
    const charBox = (text: Text, which: 'first' | 'last'): DOMRect => {
      const content = text.data;
      const index = which === 'first' ? content.search(/\S/) : content.trimEnd().length - 1;
      const range = document.createRange();
      range.setStart(text, index);
      range.setEnd(text, index + 1);
      return range.getClientRects()[0]!;
    };
    /** A child's left or right edge: an icon's box, or its text's first or last character. */
    const edge = (node: Node, side: 'left' | 'right'): number =>
      node instanceof SVGElement
        ? node.getBoundingClientRect()[side]
        : charBox(textOf(node), side === 'left' ? 'first' : 'last')[side];

    const first = visible[0]!;
    const last = visible.at(-1)!;
    const icon = visible.find((node) => node instanceof SVGElement)!;
    const text = visible.find((node) => !(node instanceof SVGElement))!;
    const textRange = document.createRange();
    textRange.selectNodeContents(textOf(text));
    const result = {
      left: edge(first, 'left') - open.getBoundingClientRect().right,
      right: close.getBoundingClientRect().left - edge(last, 'right'),
      inner: icon === first ? edge(text, 'left') - edge(icon, 'right') : edge(icon, 'left') - edge(text, 'right'),
      // From the text's own line boxes (an icon's box is centered, so its top isn't a line's top).
      lines: new Set([...textRange.getClientRects()].map((box) => Math.round(box.top))).size,
    };

    open.remove();
    close.remove();
    a.removeAttribute('data-measuring');
    document.adoptedStyleSheets = sheets;
    return result;
  });
}

/** A neutral label for a link in test output: never its text (it can be the email address) or its URL. */
async function linkLabel(link: Locator, section: string, index: number): Promise<string> {
  const href = (await link.getAttribute('href')) ?? '';
  const kind = href.startsWith('mailto:') ? 'mailto' : href.startsWith('http') ? 'external' : 'internal';
  return `${section} link ${index} (${kind})`;
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
      for (const [path, section, selector] of [
        ['/', 'footer', 'footer a:not([data-no-brackets])'],
        ['/', 'contact', '[data-contact] a:not([data-no-brackets])'],
        ['/', 'hero', '[data-hero] a:not([data-no-brackets])'],
        ['/resume', 'resume contact line', '[data-resume-contact] a:not([data-no-brackets])'],
      ] as const) {
        test(`links with an icon have even space inside their brackets: ${path} ${section}`, async ({ page }) => {
          await page.goto(path);
          await page.evaluate(() => document.fonts.ready);
          const links = await page
            .locator(selector)
            .filter({ has: page.locator('svg') })
            .all();
          if (section === 'hero') expect(links).toHaveLength(0);
          for (const [index, link] of links.entries()) {
            if (!(await link.isVisible())) continue;
            const { left, right, inner } = await bracketGaps(link);
            const label = await linkLabel(link, section, index);
            // Layout boxes: "[" to the content, the icon to the text, and the content to "]" are all the same 0.5ch, on
            // any platform, up to subpixel rounding. Extra rendered whitespace would show in one of them.
            const gaps = `"[" ${left.toFixed(1)}, icon ${inner.toFixed(1)}, "]" ${right.toFixed(1)}px`;
            expect(left, `${label}: space after "["`).toBeGreaterThan(0);
            expect(Math.abs(left - right), `${label}: ${gaps}`).toBeLessThanOrEqual(0.5);
            expect(Math.abs(left - inner), `${label}: ${gaps}`).toBeLessThanOrEqual(0.5);
          }
        });
      }
    });
  }

  // CI's Chromium on Linux lays text out on whole pixels: each mono character is 10px, not 9.6px, and the Contact card's
  // LinkedIn link no longer fits one line at 1280px. 0.4px of letter-spacing reproduces that here.
  test('a bracketed link that wraps keeps "]" right after its last word', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(() => {
      const sheet = new CSSStyleSheet();
      sheet.replaceSync('[data-contact-linkedin] { letter-spacing: 0.4px; }');
      document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
    });
    const link = page.locator('[data-contact-linkedin]');
    const { left, right, inner, lines } = await bracketGaps(link);
    expect(lines, 'the link wraps, as on CI').toBe(2);
    const gaps = `"[" ${left.toFixed(1)}, icon ${inner.toFixed(1)}, "]" ${right.toFixed(1)}px`;
    expect(Math.abs(left - right), gaps).toBeLessThanOrEqual(0.5);
    expect(Math.abs(left - inner), gaps).toBeLessThanOrEqual(0.5);
    // Wrapping keeps the 40px target height, now with two lines.
    expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(40);
  });

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
      // Neutral labels in any failure output: the index and data-* attribute names, never text, URLs or values.
      const unmarked = await page.evaluate(() =>
        [...document.querySelectorAll('a')]
          .map((a, index) => ({ a, index }))
          .filter(({ a }) => !a.hasAttribute('data-no-brackets'))
          .filter(({ a }) => !getComputedStyle(a, '::before').content.includes('['))
          .map(({ a, index }) => {
            const names = a.getAttributeNames().filter((name) => name.startsWith('data-'));
            return `link ${index} [${names.join(' ')}]`;
          }),
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
