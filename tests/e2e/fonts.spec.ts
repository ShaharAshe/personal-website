// Font loading (Task 3.4a, design-doc §9.3) in a real browser, with the real _headers (wrangler dev here; also in the
// live run, playwright.live.config.ts):
// - /_astro/* is served immutable, cached for a year; files without a content hash in their name are not;
// - on a slow network with a warm cache, the Hero's fonts are ready at its first render;
// - the Inter preloads start before first paint in the regular style, and terminal view never requests Inter; without
//   JavaScript the CSS still loads every font;
// - no "preloaded but not used" warning and no unused preload on any page, in either style; every face used on the
//   first screen is preloaded, and every preload is used there;
// - the size-adjusted fallbacks (src/lib/font-fallbacks.mts): the local fonts resolve, 600 is drawn bold, and widths
//   stay close to the web font's; with every font held back until after first paint, the swap shifts the layout by
//   at most 0.01.
// The built HTML (preload markup, the fallback CSS, the cache rule) is checked by npm test: tests/font-preloads.test.ts,
// tests/font-fallbacks.test.ts, tests/cache-headers.test.ts. CLS from first paint on a normal load is in
// tests/e2e/motion.spec.ts.

import { type Page, type Route } from '@playwright/test';
import { expect, test } from './fixtures.ts';
import { LOOKS, useLook, type Look } from './helpers.ts';

const NOT_FOUND = '/no-such-page';
const PAGES = ['/', '/resume', NOT_FOUND];
const IMMUTABLE = 'public, max-age=31536000, immutable';
const FONT_FILE = /\/_astro\/fonts\/[\w-]+\.woff2/;
const [DARK, , TERMINAL_LOOK] = LOOKS;
/** One look per style: the theme doesn't change which fonts load. */
const STYLES: Look[] = [DARK, TERMINAL_LOOK];
/** The largest layout shift the forced swap may cause, per page (see design-doc §9.3). */
const MAX_SWAP_SHIFT = 0.01;

interface Face {
  /** The family as declared, without quotes. */
  family: string;
  weight: string;
  /** Path of the woff2 file. */
  url: string;
}

declare global {
  interface Window {
    __reveal?: Record<string, string>;
    __shifts?: { value: number; sources: string[] }[];
    __firstFrame?: number;
  }
}

/** Every web-font @font-face on the page (the ones with a /_astro/fonts/ file). */
const webFaces = (page: Page): Promise<Face[]> =>
  page.evaluate(() => {
    const faces: { family: string; weight: string; url: string }[] = [];
    for (const sheet of document.styleSheets) {
      for (const rule of sheet.cssRules) {
        if (!(rule instanceof CSSFontFaceRule)) continue;
        const url = rule.style.getPropertyValue('src').match(/url\("?([^")]+)"?\)/)?.[1];
        if (!url?.includes('/_astro/fonts/')) continue;
        faces.push({
          family: rule.style.getPropertyValue('font-family').replace(/^["']|["']$/g, ''),
          weight: rule.style.getPropertyValue('font-weight'),
          url: new URL(url, location.href).pathname,
        });
      }
    }
    return faces;
  });

/** The font preloads in the DOM (after the head script ran), as paths. */
const preloadedFonts = (page: Page): Promise<string[]> =>
  page.evaluate(() =>
    [...document.querySelectorAll<HTMLLinkElement>('link[rel="preload"][as="font"]')]
      .map((link) => new URL(link.href).pathname)
      .sort(),
  );

/**
 * Records when the page's first rendering update starts (window.__firstFrame), from an init script: the first
 * requestAnimationFrame callback runs right before the first paint. Not the paint timing entries: the local Edge doesn't
 * record any.
 */
const recordFirstFrame = (page: Page) =>
  page.addInitScript(() => {
    requestAnimationFrame(() => {
      window.__firstFrame = performance.now();
    });
  });

const nextFrames = (page: Page) =>
  page.evaluate(async () => {
    const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));
    await frame();
    await frame();
  });

// --- Caching ---

test.describe('cache headers', () => {
  test('files under /_astro/ (a font, the stylesheet) are cached for a year, immutable', async ({ request }) => {
    const html = await (await request.get('/')).text();
    const font = html.match(FONT_FILE)?.[0];
    const css = html.match(/\/_astro\/[\w.-]+\.css/)?.[0];
    expect(font, 'no font URL in the homepage').toBeTruthy();
    expect(css, 'no stylesheet URL in the homepage').toBeTruthy();
    for (const url of [font!, css!]) {
      const response = await request.get(url);
      expect(response.status(), url).toBe(200);
      expect(response.headers()['cache-control'], url).toBe(IMMUTABLE);
    }
  });

  for (const path of [
    ...PAGES,
    '/og-image.png',
    '/favicon.ico',
    '/favicon.svg',
    '/favicon-dark.svg',
    '/favicon-light.svg',
    '/favicon-terminal.svg',
    '/apple-touch-icon.png',
    '/resume.pdf',
    '/robots.txt',
    '/sitemap.xml',
  ]) {
    test(`${path} (no content hash in its name) is not cached long`, async ({ request }) => {
      const response = await request.get(path);
      const cacheControl = response.headers()['cache-control'] ?? '';
      expect(cacheControl).not.toContain('immutable');
      expect(cacheControl).not.toMatch(/max-age=[1-9]/);
    });
  }
});

// --- Ready at first render, warm cache ---

for (const look of STYLES) {
  test(`${look.name}: warm cache on a slow network, the Hero's fonts are ready at its first render`, async ({
    page,
  }) => {
    await useLook(page, look);
    await page.goto('/resume');
    await page.evaluate(() => document.fonts.ready);

    // From the next page load on: at the first render that shows the Hero, is the first family of each Hero part's
    // font (the web font) loaded? From pagereveal (the first rendering opportunity) on, every rendering update is
    // checked, in a requestAnimationFrame callback (which runs right before that update paints), until the whole Hero
    // is in the DOM: with the stylesheet cached, the first render can come before the parser reaches <body>.
    await page.addInitScript(() => {
      if (location.pathname !== '/') return;
      const parts = {
        name: '#hero-title',
        role: '[data-hero-role]',
        tagline: '[data-hero-tagline]',
        'Download Resume': '[data-hero] a[download]',
        'View Projects': '[data-hero] a[href="/#projects"]',
      };
      const check = () => {
        const elements = Object.entries(parts).map(
          ([part, selector]) => [part, document.querySelector(selector)] as const,
        );
        if (elements.some(([, element]) => !element)) {
          requestAnimationFrame(check);
          return;
        }
        window.__reveal = Object.fromEntries(
          elements.map(([part, element]) => {
            const style = getComputedStyle(element!);
            const family = style.fontFamily.split(',')[0]!.trim();
            const font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${family}`;
            const ready = document.fonts.check(font, element!.textContent?.trim() || 'x');
            return [part, ready ? 'ready' : `not ready: ${font}`];
          }),
        );
      };
      addEventListener('pagereveal', check, { once: true });
    });

    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Network.enable');
    // About a slow 3G link: 400 ms round trips, 400 kbit/s down.
    await cdp.send('Network.emulateNetworkConditions', {
      offline: false,
      latency: 400,
      downloadThroughput: 50_000,
      uploadThroughput: 25_000,
    });
    await page.goto('/');
    await page.waitForFunction(() => window.__reveal !== undefined);
    const reveal = await page.evaluate(() => window.__reveal);
    expect(reveal).toEqual({
      name: 'ready',
      role: 'ready',
      tagline: 'ready',
      'Download Resume': 'ready',
      'View Projects': 'ready',
    });
  });
}

// --- Which fonts are requested, and when ---

test('regular style: every Inter font request starts before first paint', async ({ page }) => {
  await recordFirstFrame(page);
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
  const inter = (await webFaces(page)).filter(({ family }) => family.startsWith('Inter-')).map(({ url }) => url);
  const { requests, firstPaint } = await page.evaluate(() => ({
    requests: performance
      .getEntriesByType('resource')
      .map((entry) => ({ url: new URL(entry.name).pathname, start: entry.startTime })),
    firstPaint: window.__firstFrame,
  }));
  expect(firstPaint, 'no rendering update recorded').toBeDefined();
  expect(inter).toHaveLength(3);
  for (const url of inter) {
    const request = requests.find((entry) => entry.url === url);
    expect(request, `${url} was never requested`).toBeDefined();
    expect(request!.start, `${url} started after first paint`).toBeLessThan(firstPaint!);
  }
});

test('terminal view: no Inter font is requested at all', async ({ page }) => {
  const requested: string[] = [];
  page.on('request', (request) => requested.push(new URL(request.url()).pathname));
  await useLook(page, TERMINAL_LOOK);
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
  await page.waitForLoadState('load');
  const faces = await webFaces(page);
  const inter = faces.filter(({ family }) => family.startsWith('Inter-')).map(({ url }) => url);
  const mono = faces.filter(({ family }) => family.startsWith('JetBrains Mono-')).map(({ url }) => url);
  expect(inter).toHaveLength(3);
  expect(requested.filter((url) => inter.includes(url))).toEqual([]);
  expect(requested.filter((url) => mono.includes(url))).toEqual(mono);
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('the CSS alone still loads every font the homepage uses', async ({ page, request }) => {
    const html = await (await request.get('/')).text();
    const expected = [...new Set([...html.matchAll(new RegExp(FONT_FILE, 'g'))].map(([url]) => url))].sort();
    expect(expected).toHaveLength(4);
    const loaded = new Map<string, number>();
    page.on('response', (response) => {
      const url = new URL(response.url()).pathname;
      if (FONT_FILE.test(url)) loaded.set(url, response.status());
    });
    await page.goto('/');
    await expect.poll(() => [...loaded.keys()].sort()).toEqual(expected);
    expect([...loaded.values()].every((status) => status === 200)).toBe(true);
  });
});

// --- Preloads: used, and nothing else ---

// Chrome's DevTools warning: "The resource ... was preloaded using link preload but not used within a few seconds from
// the window's load event". Neither the Edge nor the Chromium used here reports it to page.on('console') or the CDP
// Log/Audits domains (checked in Task 3.4a, headless and headed, on a build whose terminal view preloaded unused Inter),
// so the message check only catches a browser that does. The guard is the same condition, checked directly: every
// preloaded file belongs to a FontFace that is loaded (used) 5 s after load. On that build, terminal view failed it.
const UNUSED_PRELOAD = /preloaded using link preload but not used/i;

for (const look of STYLES) {
  for (const path of PAGES) {
    test(`${path}, ${look.name}: no "preloaded but not used" warning 5 s after load; every preload is in use`, async ({
      page,
    }) => {
      const messages: string[] = [];
      page.on('console', (message) => messages.push(message.text()));
      // The warning is the browser's own (a DevTools Log entry); page.on('console') may not see it (helpers.ts).
      const cdp = await page.context().newCDPSession(page);
      cdp.on('Log.entryAdded', ({ entry }) => messages.push(entry.text));
      await cdp.send('Log.enable');
      await useLook(page, look);
      await page.goto(path);
      await page.waitForLoadState('load');
      await page.waitForTimeout(5_500);
      expect(messages.filter((text) => UNUSED_PRELOAD.test(text))).toEqual([]);

      const faces = await webFaces(page);
      const preloads = await preloadedFonts(page);
      // Regular: Inter 400/500/600 and JetBrains Mono 400. Terminal: JetBrains Mono only.
      expect(preloads).toHaveLength(look === TERMINAL_LOOK ? 1 : 4);
      const status = await page.evaluate(
        (wanted) =>
          wanted.map(({ family, weight, url }) => {
            const face = [...document.fonts].find(
              (candidate) => candidate.family.replace(/^["']|["']$/g, '') === family && candidate.weight === weight,
            );
            return `${url}: ${face?.status ?? 'no FontFace'}`;
          }),
        faces.filter(({ url }) => preloads.includes(url)),
      );
      expect(status.sort()).toEqual(preloads.map((url) => `${url}: loaded`));
    });
  }
}

/** The web-font files the text on the first screen is drawn with: each text's first family, at its nearest weight. */
const firstScreenFaces = (page: Page, faces: Face[]): Promise<string[]> =>
  page.evaluate((faces) => {
    const used = new Set<string>();
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const element = node.parentElement;
      if (!element || !node.textContent?.trim() || !element.checkVisibility({ visibilityProperty: true })) continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      const visible = [...range.getClientRects()].some(
        (rect) =>
          rect.width > 0 && rect.bottom > 0 && rect.top < innerHeight && rect.right > 0 && rect.left < innerWidth,
      );
      if (!visible) continue;
      const style = getComputedStyle(element);
      const family = style.fontFamily
        .split(',')[0]!
        .trim()
        .replace(/^["']|["']$/g, '');
      const candidates = faces.filter((face) => face.family === family);
      if (candidates.length === 0) continue;
      const weight = Number(style.fontWeight);
      const nearest = candidates.reduce((best, face) =>
        Math.abs(Number(face.weight) - weight) < Math.abs(Number(best.weight) - weight) ? face : best,
      );
      used.add(nearest.url);
    }
    return [...used].sort();
  }, faces);

for (const look of STYLES) {
  for (const path of PAGES) {
    test(`${path}, ${look.name}: the first screen at 375px and 1280px uses exactly the preloaded faces`, async ({
      page,
    }) => {
      await useLook(page, look);
      const union = new Set<string>();
      for (const width of [375, 1280]) {
        await page.setViewportSize({ width, height: 800 });
        await page.goto(path);
        await page.evaluate(() => document.fonts.ready);
        const preloads = await preloadedFonts(page);
        const used = await firstScreenFaces(page, await webFaces(page));
        for (const url of used) expect(preloads, `${width}px uses ${url}, which isn't preloaded`).toContain(url);
        used.forEach((url) => union.add(url));
      }
      expect([...union].sort(), 'a preloaded face is not used on the first screen').toEqual(await preloadedFonts(page));
    });
  }
}

// --- The fallbacks ---

test.describe('the size-adjusted fallbacks', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('the first fallback families resolve to a local font on this system (Arial/Courier New or Liberation)', async ({
    page,
  }) => {
    await page.goto('/');
    const statuses = await page.evaluate(async () => {
      const wanted = ['Inter fallback', 'JetBrains Mono fallback'];
      const faces = [...document.fonts].filter((face) => wanted.includes(face.family.replace(/^["']|["']$/g, '')));
      await Promise.allSettled(faces.map((face) => face.load()));
      return faces.map((face) => `${face.family.replace(/^["']|["']$/g, '')} ${face.weight}: ${face.status}`);
    });
    expect(statuses).toEqual([
      'Inter fallback 400: loaded',
      'Inter fallback 500: loaded',
      'Inter fallback 600: loaded',
      'JetBrains Mono fallback 400: loaded',
    ]);
  });

  test('the weight-600 fallback is drawn bold', async ({ page }) => {
    await page.goto('/');
    const ink = await page.evaluate(async () => {
      // Without the family, the canvas would draw the default font, bold and regular, and pass for the wrong reason.
      const declared = [...document.fonts].some(
        (face) => face.family.replace(/^["']|["']$/g, '') === 'Inter fallback' && face.weight === '600',
      );
      if (!declared) return null;
      const text = document.querySelector('#hero-title')?.textContent?.trim() ?? 'Hamburgefonstiv';
      const inkOf = async (weight: number) => {
        const font = `${weight} 48px "Inter fallback"`;
        await document.fonts.load(font, text);
        const canvas = document.createElement('canvas');
        canvas.width = 800;
        canvas.height = 80;
        const context = canvas.getContext('2d')!;
        context.font = font;
        context.fillText(text, 0, 60);
        const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
        let sum = 0;
        for (let i = 3; i < data.length; i += 4) sum += data[i]!;
        return sum;
      };
      return { regular: await inkOf(400), bold: await inkOf(600) };
    });
    expect(ink, 'no "Inter fallback" 600 face on the page').not.toBeNull();
    expect(ink!.regular).toBeGreaterThan(0);
    expect(ink!.bold / ink!.regular).toBeGreaterThan(1.15);
  });

  test("with the fallbacks alone, the Hero's parts keep close to the web font's width", async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
    const widths = await page.evaluate(async () => {
      const parts = {
        name: '#hero-title',
        role: '[data-hero-role]',
        tagline: '[data-hero-tagline]',
        'Download Resume': '[data-hero] a[download]',
        'View Projects': '[data-hero] a[href="/#projects"]',
      };
      const results: Record<string, number> = {};
      for (const [part, selector] of Object.entries(parts)) {
        const element = document.querySelector(selector)!;
        const style = getComputedStyle(element);
        const text = element.textContent!.trim().replace(/\s+/g, ' ');
        const [, ...fallbacks] = style.fontFamily.split(',');
        // Loads the fallback faces this text needs; it rejects when one family's local fonts are all missing (Roboto,
        // DejaVu on most systems), which is fine: that family is skipped.
        await document.fonts.load(`${style.fontWeight} ${style.fontSize} ${fallbacks.join(',')}`, text).catch(() => {});
        const measure = (family: string) => {
          const span = document.createElement('span');
          span.textContent = text;
          span.style.cssText = `position:absolute;visibility:hidden;white-space:nowrap;font-size:${style.fontSize};font-weight:${style.fontWeight};letter-spacing:${style.letterSpacing};font-family:${family}`;
          document.body.append(span);
          const width = span.getBoundingClientRect().width;
          span.remove();
          return width;
        };
        results[part] = measure(fallbacks.join(',')) / measure(style.fontFamily);
      }
      return results;
    });
    test.info().annotations.push({ type: 'fallback width / web font width', description: JSON.stringify(widths) });
    for (const [part, ratio] of Object.entries(widths)) {
      expect(Math.abs(ratio - 1), `${part}: ${ratio.toFixed(4)}`).toBeLessThan(0.05);
    }
  });
});

// --- The swap itself, forced after first paint ---

for (const look of LOOKS) {
  for (const width of [375, 1280]) {
    test.describe(`forced swap, ${look.name}, ${width}px`, () => {
      test.use({ reducedMotion: 'no-preference', colorScheme: look.colorScheme, viewport: { width, height: 800 } });

      for (const path of PAGES) {
        test(`${path}: fonts held until after first paint, the swap shifts the layout by at most ${MAX_SWAP_SHIFT}`, async ({
          page,
        }) => {
          const held: Route[] = [];
          let released = false;
          await page.route(FONT_FILE, (route) => (released ? route.continue() : void held.push(route)));
          await useLook(page, look);
          await page.addInitScript(() => {
            const shifts: { value: number; sources: string[] }[] = [];
            window.__shifts = shifts;
            const describe = (node: Node | null) =>
              node instanceof Element ? `${node.tagName.toLowerCase()}${node.id ? `#${node.id}` : ''}` : String(node);
            new PerformanceObserver((list) => {
              for (const entry of list.getEntries() as (PerformanceEntry & {
                value: number;
                sources: { node: Node | null }[];
              })[]) {
                shifts.push({ value: entry.value, sources: entry.sources.map(({ node }) => describe(node)) });
              }
            }).observe({ type: 'layout-shift', buffered: true });
          });

          await recordFirstFrame(page);
          await page.goto(path, { waitUntil: 'domcontentloaded' });
          await page.waitForFunction(() => window.__firstFrame !== undefined);
          // Past the swap period's short block: the fallbacks are on screen.
          await page.waitForTimeout(300);
          await nextFrames(page);
          expect(held.length, 'no font request was held: nothing to swap').toBeGreaterThan(0);

          released = true;
          await Promise.all(held.splice(0).map((route) => route.continue()));
          await page.evaluate(() => document.fonts.ready);
          await nextFrames(page);

          // The web fonts did arrive: the <h1>'s first family is loaded.
          const h1Ready = await page.evaluate(() => {
            const style = getComputedStyle(document.querySelector('h1')!);
            return document.fonts.check(`${style.fontWeight} ${style.fontSize} ${style.fontFamily.split(',')[0]}`);
          });
          expect(h1Ready).toBe(true);

          const shifts = await page.evaluate(() => window.__shifts ?? []);
          const total = shifts.reduce((sum, { value }) => sum + value, 0);
          test.info().annotations.push({
            type: 'swap layout shift',
            description: `${total.toFixed(5)} ${JSON.stringify(shifts)}`,
          });
          expect(total).toBeLessThanOrEqual(MAX_SWAP_SHIFT);
        });
      }
    });
  }
}
