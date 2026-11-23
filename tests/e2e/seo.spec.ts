// Task 2.13 checks that need a real browser: the header home link (visible from 640px, hidden below), its focus
// ring, the nav fitting on one row at 640px (where the link first appears) and 375px, in both themes and terminal
// view, no horizontal scroll, sitemap.xml
// parsing as XML, and the OG image being served. The built head tags are checked in tests/seo-dist.test.ts.
// The site icons (2.13a, 2.21), and the SVG icon link following the saved theme, terminal view and every click (2.21a).

import { type APIRequestContext, type Page } from '@playwright/test';
import { expect, test } from './fixtures.ts';
import { getResume } from '../../src/lib/resume.ts';
import { SITE_ICONS } from '../../src/lib/seo.ts';
import { FAVICON_LINK_SELECTOR, STYLE_STORAGE_KEY, TERMINAL, THEME_STORAGE_KEY } from '../../src/lib/theme.ts';
import {
  cspViolations,
  expectFocusRing,
  expectTheme,
  LOOKS,
  styleToggle,
  themeToggle,
  useLook,
  watchSecurityErrors,
} from './helpers.ts';

const NAME = getResume().basics.name;
const PAGES = ['/', '/resume', '/no-such-page'];

const homeLink = (page: Page) => page.getByRole('navigation', { name: 'Main' }).locator('[data-home-link]');

async function expectNoHorizontalScroll(page: Page): Promise<void> {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
}

for (const path of PAGES) {
  test.describe(`header on ${path}`, () => {
    test.describe('at 1280px', () => {
      test.use({ viewport: { width: 1280, height: 800 } });

      test('the home link shows the name and goes to /', async ({ page }) => {
        await page.goto(path);
        await expect(homeLink(page)).toBeVisible();
        await expect(homeLink(page)).toHaveText(NAME);
        await expect(homeLink(page)).toHaveAttribute('href', '/');
        await homeLink(page).click();
        await expect(page).toHaveURL(/\/$/);
        expect(new URL(page.url()).pathname).toBe('/');
      });

      test('the home link is the first Tab stop after the skip link, with a focus ring', async ({ page }) => {
        await page.goto(path);
        await page.keyboard.press('Tab'); // skip link
        await page.keyboard.press('Tab');
        await expectFocusRing(homeLink(page));
      });

      test('the home link sits at the left edge of the 720px column', async ({ page }) => {
        await page.goto(path);
        const box = (await homeLink(page).boundingBox())!;
        const nav = (await page.getByRole('navigation', { name: 'Main' }).boundingBox())!;
        // The nav has px-4 (16px) padding inside its 720px column.
        expect(Math.round(box.x)).toBe(Math.round(nav.x + 16));
      });
    });

    test.describe('at 375px', () => {
      test.use({ viewport: { width: 375, height: 800 } });

      test('the home link is hidden', async ({ page }) => {
        await page.goto(path);
        await expect(homeLink(page)).toBeHidden();
      });
    });
  });
}

// 640px (sm) is where the home link first appears: the tightest width where the whole nav must fit on one row. 375px
// is the narrowest checked width, without the home link. In both themes and in terminal view (Task F.7), where mono
// text and [brackets] make the links wider (and the theme toggle is hidden).
for (const look of LOOKS) {
  for (const width of [375, 640, 1280]) {
    test.describe(`${width}px ${look.name}`, () => {
      test.use({ viewport: { width, height: 800 }, colorScheme: look.colorScheme });
      test.beforeEach(({ page }) => useLook(page, look));

      for (const path of PAGES) {
        test(`no horizontal scroll on ${path}`, async ({ page }) => {
          await page.goto(path);
          await page.evaluate(() => document.fonts.ready);
          await expectTheme(page, look.scheme);
          await expectNoHorizontalScroll(page);
        });

        if (width === 1280) continue;
        const withHome = width === 640;

        test(`the nav fits on one row${withHome ? ' with the home link' : ''} on ${path}`, async ({ page }) => {
          await page.goto(path);
          await page.evaluate(() => document.fonts.ready);
          await expect(homeLink(page)).toBeVisible({ visible: withHome });

          const nav = page.getByRole('navigation', { name: 'Main' });
          const toggle = themeToggle(page);
          const items = [
            ...(withHome ? [homeLink(page)] : []),
            ...(await nav.locator('li a').all()),
            ...((await toggle.isVisible()) ? [toggle] : []),
          ];
          expect(await toggle.isVisible()).toBe(look.style !== 'terminal');
          const boxes = await Promise.all(items.map(async (item) => (await item.boundingBox())!));
          const navBox = (await nav.boundingBox())!;
          const centers = boxes.map((b) => b.y + b.height / 2);
          // One row: every item shares the same vertical center.
          for (const center of centers) expect(Math.abs(center - centers[0])).toBeLessThanOrEqual(2);
          // Nothing overflows the nav, and the items don't overlap (left to right, in order).
          for (const [i, b] of boxes.entries()) {
            expect(b.x).toBeGreaterThanOrEqual(navBox.x);
            expect(b.x + b.width).toBeLessThanOrEqual(navBox.x + navBox.width + 0.5);
            if (i > 0) expect(b.x).toBeGreaterThanOrEqual(boxes[i - 1].x + boxes[i - 1].width);
          }
          if (!withHome) return;
          // The name doesn't wrap: its text is one line box.
          const lineBoxes = await homeLink(page).evaluate((el) => {
            const range = document.createRange();
            range.selectNodeContents(el);
            return range.getClientRects().length;
          });
          expect(lineBoxes).toBe(1);
        });
      }
    });
  }
}

test('/sitemap.xml parses as XML in the browser and lists absolute URLs', async ({ page, request }) => {
  const response = await request.get('/sitemap.xml');
  expect(response.status()).toBe(200);
  const xml = await response.text();
  await page.goto('/');
  const result = await page.evaluate((text) => {
    const doc = new DOMParser().parseFromString(text, 'application/xml');
    return {
      error: doc.getElementsByTagName('parsererror').length > 0,
      root: doc.documentElement.localName,
      namespace: doc.documentElement.namespaceURI,
      locs: [...doc.getElementsByTagName('loc')].map((loc) => loc.textContent),
    };
  }, xml);
  expect(result.error).toBe(false);
  expect(result.root).toBe('urlset');
  expect(result.namespace).toBe('http://www.sitemaps.org/schemas/sitemap/0.9');
  expect(result.locs).toHaveLength(2);
  for (const loc of result.locs) expect(loc).toMatch(/^https:\/\//);
});

test('/robots.txt is served as text with a Sitemap line', async ({ request }) => {
  const response = await request.get('/robots.txt');
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toMatch(/^text\/plain/);
  expect(await response.text()).toMatch(/^Sitemap: https:\/\/\S+\/sitemap\.xml$/m);
});

test('/og-image.png is served as a PNG', async ({ request }) => {
  const response = await request.get('/og-image.png');
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toBe('image/png');
});

// The site icons (Task 2.13a; favicon.svg from Task 2.21).
const ICON_PATHS = ['/favicon.ico', '/favicon.svg', '/apple-touch-icon.png'];
const isIcon = (url: string) => ICON_PATHS.includes(new URL(url).pathname);

for (const iconPath of ICON_PATHS) {
  test(`${iconPath} answers 200 with an image Content-Type`, async ({ request }) => {
    const response = await request.get(iconPath);
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toMatch(/^image\//);
  });
}

for (const path of PAGES) {
  test(`${path} logs no failed icon request, and its icon links load`, async ({ page }) => {
    const failed: string[] = [];
    page.on('requestfailed', (request) => {
      if (isIcon(request.url())) failed.push(`${request.url()}: ${request.failure()?.errorText}`);
    });
    page.on('response', (response) => {
      if (isIcon(response.url()) && response.status() >= 400) failed.push(`${response.url()}: ${response.status()}`);
    });
    await page.goto(path);
    const hrefs = await page
      .locator('head link[rel="icon"], head link[rel="apple-touch-icon"]')
      .evaluateAll((links) => links.map((link) => (link as HTMLLinkElement).href));
    expect(hrefs.map((href) => new URL(href).pathname).sort()).toEqual([...ICON_PATHS].sort());
    const results = await page.evaluate(
      (urls) =>
        Promise.all(
          urls.map(async (url) => {
            const response = await fetch(url);
            return { status: response.status, type: response.headers.get('content-type') ?? '' };
          }),
        ),
      hrefs,
    );
    for (const { status, type } of results) {
      expect(status).toBe(200);
      expect(type).toMatch(/^image\//);
    }
    await page.waitForLoadState('networkidle');
    expect(failed).toEqual([]);
  });
}

// Task 2.21: the SVG is a plain static file. Only the /* rule applies: no X-Clue (that's favicon.ico's, F.2) and no
// long cache (its name has no content hash). favicon.ico's X-Clue is checked by tests/e2e/ctf.spec.ts. The fixed
// variants (Task 2.21a) and the terminal icon (Task 2.21b) are served the same way.
for (const svgPath of [
  SITE_ICONS.svg.path,
  SITE_ICONS.svgFixed.dark,
  SITE_ICONS.svgFixed.light,
  SITE_ICONS.svgTerminal,
]) {
  test(`${svgPath} answers 200 as image/svg+xml, without X-Clue or a long cache`, async ({ request }) => {
    const svg = await request.get(svgPath);
    expect(svg.status()).toBe(200);
    expect(svg.headers()['content-type']).toBe('image/svg+xml');
    expect(svg.headers()['x-clue']).toBeUndefined();
    const cacheControl = svg.headers()['cache-control'] ?? '';
    expect(cacheControl).not.toContain('immutable');
    expect(cacheControl).not.toMatch(/max-age=[1-9]/);
  });
}

// --- The tab icon follows the site's choice (Task 2.21a) ---
// The head script points the SVG icon link at the chosen theme's fixed variant before first paint, or in terminal view at
// the ">_" icon (Task 2.21b); with no choice it stays /favicon.svg. Every click on the theme toggle or the terminal view switch changes it at
// once. Headless browsers don't fetch favicons themselves, so each test fetches the href it ends on.

const iconLink = (page: Page) => page.locator(`head ${FAVICON_LINK_SELECTOR}`);

/** Records the icon link's href in the first animation frame, which runs before the first paint. */
async function recordFirstFrameIcon(page: Page): Promise<void> {
  await page.addInitScript((selector) => {
    requestAnimationFrame(() => {
      (window as unknown as { __firstFrameIcon?: string | null }).__firstFrameIcon = document
        .querySelector(selector)
        ?.getAttribute('href');
    });
  }, FAVICON_LINK_SELECTOR);
}
const firstFrameIcon = (page: Page) =>
  page.evaluate(() => (window as unknown as { __firstFrameIcon?: string | null }).__firstFrameIcon);

/** Fails the test on any icon request that fails or answers 400+. Call before page.goto. */
function watchIconRequests(page: Page): string[] {
  const failed: string[] = [];
  const isFavicon = (url: string) => /^\/favicon[\w-]*\.(svg|ico)$/.test(new URL(url).pathname);
  page.on('requestfailed', (request) => {
    if (isFavicon(request.url())) failed.push(`${request.url()}: ${request.failure()?.errorText}`);
  });
  page.on('response', (response) => {
    if (isFavicon(response.url()) && response.status() >= 400) failed.push(`${response.url()}: ${response.status()}`);
  });
  return failed;
}

/** The icon link has `href`, and that file loads as an SVG. */
async function expectIcon(page: Page, href: string): Promise<void> {
  await expect(iconLink(page)).toHaveAttribute('href', href);
  const result = await page.evaluate(async (url) => {
    const response = await fetch(url);
    return { status: response.status, type: response.headers.get('content-type') };
  }, href);
  expect(result, href).toEqual({ status: 200, type: SITE_ICONS.svg.type });
}

const SAVED_CASES = [
  { name: 'nothing saved', values: {}, icon: SITE_ICONS.svg.path },
  { name: 'a saved light theme', values: { [THEME_STORAGE_KEY]: 'light' }, icon: SITE_ICONS.svgFixed.light },
  { name: 'a saved dark theme', values: { [THEME_STORAGE_KEY]: 'dark' }, icon: SITE_ICONS.svgFixed.dark },
  { name: 'terminal view', values: { [STYLE_STORAGE_KEY]: TERMINAL }, icon: SITE_ICONS.svgTerminal },
  {
    name: 'terminal view over a saved light theme',
    values: { [STYLE_STORAGE_KEY]: TERMINAL, [THEME_STORAGE_KEY]: 'light' },
    icon: SITE_ICONS.svgTerminal,
  },
  {
    name: 'terminal view over a saved dark theme',
    values: { [STYLE_STORAGE_KEY]: TERMINAL, [THEME_STORAGE_KEY]: 'dark' },
    icon: SITE_ICONS.svgTerminal,
  },
] as const;

for (const path of PAGES) {
  test.describe(`tab icon on ${path}`, () => {
    for (const { name, values, icon } of SAVED_CASES) {
      test(`${name}: the icon link is ${icon} before first paint, with no CSP violation`, async ({ page }) => {
        const securityErrors = await watchSecurityErrors(page);
        const failed = watchIconRequests(page);
        await page.addInitScript((saved) => {
          for (const [key, value] of Object.entries(saved)) localStorage.setItem(key, value);
        }, values);
        await recordFirstFrameIcon(page);
        await page.goto(path);
        expect(await firstFrameIcon(page)).toBe(icon);
        await expectIcon(page, icon);
        // The ICO link never changes (Safari's icon).
        await expect(page.locator('head link[rel="icon"]').first()).toHaveAttribute('href', SITE_ICONS.favicon.path);
        expect(await cspViolations(page)).toEqual([]);
        expect(securityErrors).toEqual([]);
        expect(failed).toEqual([]);
      });
    }

    test('the theme toggle switches the icon both ways, at once', async ({ page }) => {
      const failed = watchIconRequests(page);
      await page.addInitScript((key) => {
        if (!sessionStorage.getItem('seeded')) {
          localStorage.setItem(key, 'light');
          sessionStorage.setItem('seeded', '1');
        }
      }, THEME_STORAGE_KEY);
      await page.goto(path);
      await expectIcon(page, SITE_ICONS.svgFixed.light);
      await themeToggle(page).click();
      await expectIcon(page, SITE_ICONS.svgFixed.dark);
      await themeToggle(page).click();
      await expectIcon(page, SITE_ICONS.svgFixed.light);
      expect(failed).toEqual([]);
    });

    test('with nothing saved, the first click gives the opposite theme of the OS its variant', async ({ page }) => {
      await page.emulateMedia({ colorScheme: 'light' });
      await page.goto(path);
      await expectIcon(page, SITE_ICONS.svg.path);
      await themeToggle(page).click();
      await expectIcon(page, SITE_ICONS.svgFixed.dark);
    });

    for (const theme of ['light', 'dark'] as const) {
      test(`a saved ${theme} theme: terminal view gives the terminal icon, and turning it off restores the theme's`, async ({
        page,
      }) => {
        const securityErrors = await watchSecurityErrors(page);
        const failed = watchIconRequests(page);
        await page.addInitScript(
          ([key, value]) => {
            if (!sessionStorage.getItem('seeded')) {
              localStorage.setItem(key, value);
              sessionStorage.setItem('seeded', '1');
            }
          },
          [THEME_STORAGE_KEY, theme] as const,
        );
        await page.goto(path);
        await expectIcon(page, SITE_ICONS.svgFixed[theme]);
        await styleToggle(page).click();
        await expectIcon(page, SITE_ICONS.svgTerminal);
        await styleToggle(page).click();
        await expectIcon(page, SITE_ICONS.svgFixed[theme]);
        expect(await cspViolations(page)).toEqual([]);
        expect(securityErrors).toEqual([]);
        expect(failed).toEqual([]);
      });
    }

    test('no saved theme: terminal on gives the terminal icon, off brings back /favicon.svg, also after a reload', async ({
      page,
    }) => {
      const failed = watchIconRequests(page);
      await page.goto(path);
      await expectIcon(page, SITE_ICONS.svg.path);

      await styleToggle(page).click();
      await expectIcon(page, SITE_ICONS.svgTerminal);
      await page.reload();
      await expectIcon(page, SITE_ICONS.svgTerminal);

      await styleToggle(page).click();
      await expectIcon(page, SITE_ICONS.svg.path);
      await page.reload();
      await expectIcon(page, SITE_ICONS.svg.path);
      expect(await page.evaluate((key) => localStorage.getItem(key), THEME_STORAGE_KEY)).toBeNull();
      expect(failed).toEqual([]);
    });
  });
}

// The colors really switch with the browser's color scheme, in an image context like the tab bar's, under the site's
// real CSP (the /* rule's style-src has no hash for the SVG's own <style>; in image context it doesn't apply). Each
// scheme gets its own context, so no decoded image is shared. Sampled at 64×64: a tile pixel above the letters and one
// inside the A's crossbar (viewBox 22, 18.6). The expected colors come from the served file (dark: the attributes,
// light: the media query); tests/site-icons.test.ts ties those to the tokens.
async function svgColors(request: APIRequestContext) {
  const text = await (await request.get('/favicon.svg')).text();
  const pick = (re: RegExp) => text.match(re)?.[1] ?? 'missing';
  return {
    dark: {
      bg: pick(/<rect class="bg" [^>]*fill="(#[0-9a-f]{6})"/),
      fg: pick(/<path class="fg" fill="(#[0-9a-f]{6})"/),
    },
    light: { bg: pick(/\.bg\{fill:(#[0-9a-f]{6})\}/), fg: pick(/\.fg\{fill:(#[0-9a-f]{6})\}/) },
  };
}
const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const near = (actual: number[], hex: string) => actual.slice(0, 3).every((v, i) => Math.abs(v - rgb(hex)[i]) <= 6);

for (const scheme of ['dark', 'light'] as const) {
  test.describe(`favicon.svg under prefers-color-scheme: ${scheme}`, () => {
    test.use({ colorScheme: scheme });

    test(`shows the ${scheme} colors as an image`, async ({ page, request }) => {
      const colors = await svgColors(request);
      const expected = colors[scheme];
      // The two variants differ, so a pass in both schemes means the colors switched.
      const other = colors[scheme === 'dark' ? 'light' : 'dark'];
      expect(expected.bg).not.toBe(other.bg);
      expect(expected.fg).not.toBe(other.fg);
      await page.goto('/');
      const { tile, letter } = await page.evaluate(async () => {
        const image = new Image();
        image.src = '/favicon.svg';
        await image.decode();
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 64;
        const context = canvas.getContext('2d')!;
        context.drawImage(image, 0, 0, 64, 64);
        const pixel = (x: number, y: number) => [...context.getImageData(x, y, 1, 1).data];
        return { tile: pixel(32, 4), letter: pixel(44, 37) };
      });
      expect(near(tile, expected.bg), `tile ${tile} vs ${expected.bg}`).toBe(true);
      expect(near(letter, expected.fg), `letter ${letter} vs ${expected.fg}`).toBe(true);
      expect(tile[3]).toBe(255);
    });
  });
}

// iOS fills transparent pixels with black, so every pixel of the apple-touch-icon must be fully opaque.
test('/apple-touch-icon.png has no transparent pixel', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const image = new Image();
    image.src = '/apple-touch-icon.png';
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext('2d')!;
    context.drawImage(image, 0, 0);
    const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
    let notOpaque = 0;
    for (let i = 3; i < data.length; i += 4) if (data[i] !== 255) notOpaque++;
    return { width: canvas.width, height: canvas.height, notOpaque };
  });
  expect(result).toEqual({ width: 180, height: 180, notOpaque: 0 });
});
