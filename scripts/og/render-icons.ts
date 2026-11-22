// Second half of npm run og: renders the site icons (Task 2.13a) from basics.name in resume.yaml and the dark design
// tokens, with the Playwright already installed (Edge locally, Playwright's Chromium in CI) and the site's own
// JetBrains Mono from dist/ (so it needs a build first, like the OG image).
//
//   public/favicon.ico           16, 32 and 48 px PNGs, rounded square with transparent corners
//   public/apple-touch-icon.png  180 px, full opaque square (iOS rounds it and fills transparency with black)
//   public/favicon.svg           Task 2.21: the same icon as glyph outlines, dark or light through prefers-color-scheme
//                                (scripts/og/icon-svg.ts), no browser involved
//
// Each size is rendered at its real pixel size. Every PNG carries the source hash (tEXt "icon-source-sha256"), the SVG
// its own in a comment; tests/site-icons.test.ts fails when one is stale. Before writing, it checks that JetBrains Mono
// loaded (for the SVG: that the outlines come from it) and the initials sit inside the square with padding.
//
// Usage: node scripts/og/render-icons.ts

import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { getResume } from '../../src/lib/resume.ts';
import { SITE_ICONS } from '../../src/lib/seo.ts';
import { DIST, ORIGIN, ROOT, browserChannel, readFontCss, routeSite } from './fonts.ts';
import { writeIco } from './ico.ts';
import {
  APPLE_TOUCH_ICON_FILE,
  FAVICON_FILE,
  ICON_HASH_KEY,
  ICON_SIZES,
  ICON_STYLES,
  iconHtml,
  iconSourceHash,
  initialsOf,
} from './icon-html.ts';
import {
  FAVICON_SVG_FILE,
  SVG_GEOMETRY,
  faviconSvg,
  iconSvgSourceHash,
  jetBrainsMonoFile,
  layoutGlyphs,
  readGlyphs,
} from './icon-svg.ts';
import { withPngText } from './png.ts';
import { readDarkTokens, readLightTokens } from './tokens.ts';

const fontCss = readFontCss();
const initials = initialsOf(getResume().basics.name);
const tokens = readDarkTokens();
const light = readLightTokens();
const hash = iconSourceHash(initials, tokens);

const problems: string[] = [];
const pngs = new Map<number, Buffer>();

// The SVG: outlines from the built JetBrains Mono, inside the same padding as the 32px PNG.
const outlines = readGlyphs(jetBrainsMonoFile(fontCss, DIST), initials);
if (!outlines.familyName.startsWith('JetBrains Mono')) {
  problems.push(`favicon.svg: the outlines come from ${outlines.familyName}, not JetBrains Mono`);
}
const { box } = layoutGlyphs(outlines);
const svgPad = Math.round(SVG_GEOMETRY.size * 0.08);
if (
  box.left < svgPad ||
  box.top < svgPad ||
  box.right > SVG_GEOMETRY.size - svgPad ||
  box.bottom > SVG_GEOMETRY.size - svgPad
) {
  problems.push(`favicon.svg: the initials leave the ${svgPad}px padding (${JSON.stringify(box)})`);
}
const svg = faviconSvg(initials, tokens, light, outlines, iconSvgSourceHash(initials, tokens, light));

// Grayscale antialiasing: LCD (subpixel) text leaves colored fringes, which show on a tiny icon.
const browser = await chromium.launch({ channel: browserChannel, args: ['--disable-lcd-text'] });
try {
  for (const size of ICON_SIZES) {
    const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
    await routeSite(page, () => iconHtml(initials, tokens, size, fontCss));
    await page.goto(`${ORIGIN}/`);
    await page.evaluate(() => document.fonts.ready);

    const layout = await page.evaluate(() => {
      const { left, right, top, bottom } = document.querySelector('[data-icon-text]')!.getBoundingClientRect();
      const fontsLoaded = [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family);
      return { left, right, top, bottom, fontsLoaded };
    });
    if (!layout.fontsLoaded.some((f) => f.startsWith('JetBrains'))) {
      problems.push(`${size}px: JetBrains Mono did not load (loaded: ${layout.fontsLoaded.join(', ') || 'none'})`);
    }
    // At least 1px (8% at larger sizes) between the initials and the edge.
    const pad = Math.max(1, Math.round(size * 0.08));
    if (layout.left < pad || layout.top < pad || layout.right > size - pad || layout.bottom > size - pad) {
      problems.push(`${size}px: the initials leave the ${pad}px padding (${JSON.stringify(layout)})`);
    }

    const png = await page.screenshot({
      type: 'png',
      clip: { x: 0, y: 0, width: size, height: size },
      omitBackground: ICON_STYLES[size].rounded,
    });
    pngs.set(size, withPngText(png, ICON_HASH_KEY, hash));
    await page.close();
  }
} finally {
  await browser.close();
}

if (problems.length > 0) {
  console.error(`Icons not written:\n  ${problems.join('\n  ')}`);
  process.exit(1);
}

const ico = writeIco(SITE_ICONS.favicon.sizes.map((size) => pngs.get(size)!));
const apple = pngs.get(SITE_ICONS.appleTouch.size)!;
fs.writeFileSync(FAVICON_FILE, ico);
fs.writeFileSync(APPLE_TOUCH_ICON_FILE, apple);
fs.writeFileSync(FAVICON_SVG_FILE, svg);
for (const [file, bytes] of [
  [FAVICON_FILE, ico.length],
  [APPLE_TOUCH_ICON_FILE, apple.length],
  [FAVICON_SVG_FILE, Buffer.byteLength(svg)],
] as const) {
  console.log(`Wrote ${path.relative(ROOT, file)} (${bytes} bytes).`);
}
console.log(`Initials "${initials}". Run npm run build so dist/ gets the icons.`);
