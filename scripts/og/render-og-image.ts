// npm run og: renders public/og-image.png (1200×630) from resume.yaml and the design tokens, with the Playwright
// already installed (Edge locally, Playwright's Chromium in CI, as in playwright.config.ts). The PNG is committed;
// tests/og-image.test.ts fails when it's stale (its tEXt hash no longer matches the template, text or tokens).
//
// Needs a build first: the site's own fonts come from dist/ (the <Font /> @font-face styles in dist/index.html and
// the files in dist/_astro/fonts/), served to the page through page.route. Run npm run build again afterwards so
// dist/ gets the new image.
//
// Before writing, it checks the layout: the name and title inside the center 630×630 square (a WhatsApp crop), the
// tagline at most two lines, nothing outside 1200×630, and the PNG under 300 KB (WhatsApp skips larger images).
//
// Usage: node scripts/og/render-og-image.ts

import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { heroContent } from '../../src/lib/hero.ts';
import { getResume } from '../../src/lib/resume.ts';
import { ORIGIN, ROOT, browserChannel, readFontCss, routeSite } from './fonts.ts';
import {
  OG_HASH_KEY,
  OG_HEIGHT,
  OG_IMAGE_FILE,
  OG_MAX_BYTES,
  OG_WIDTH,
  ogImageHtml,
  ogSourceHash,
} from './og-image-html.ts';
import { withPngText } from './png.ts';
import { readDarkTokens } from './tokens.ts';

// The <Font /> styles: @font-face rules plus the :root --font-inter / --font-jetbrains-mono variables.
const fontCss = readFontCss();

const { name, title, tagline } = heroContent(getResume());
const content = { name, title, tagline };
const tokens = readDarkTokens();

const browser = await chromium.launch({ channel: browserChannel });
try {
  const page = await browser.newPage({ viewport: { width: OG_WIDTH, height: OG_HEIGHT }, deviceScaleFactor: 1 });
  await routeSite(page, () => ogImageHtml(content, tokens, fontCss));
  await page.goto(`${ORIGIN}/`);
  await page.evaluate(() => document.fonts.ready);

  const layout = await page.evaluate(() => {
    const box = (selector: string) => {
      const el = document.querySelector(selector)!;
      const { left, right, top, bottom, height } = el.getBoundingClientRect();
      return { left, right, top, bottom, lines: Math.round(height / parseFloat(getComputedStyle(el).lineHeight)) };
    };
    const fontsLoaded = [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family);
    return {
      name: box('[data-og-name]'),
      title: box('[data-og-title]'),
      tagline: box('[data-og-tagline]'),
      fontsLoaded,
    };
  });

  const problems: string[] = [];
  const square = { left: (OG_WIDTH - OG_HEIGHT) / 2, right: (OG_WIDTH + OG_HEIGHT) / 2 };
  for (const key of ['name', 'title'] as const) {
    const b = layout[key];
    if (b.left < square.left || b.right > square.right) problems.push(`the ${key} is outside the center square`);
  }
  if (layout.tagline.lines > 2) problems.push(`the tagline is ${layout.tagline.lines} lines (at most 2)`);
  for (const [key, b] of Object.entries({ name: layout.name, title: layout.title, tagline: layout.tagline })) {
    if (b.left < 0 || b.top < 0 || b.right > OG_WIDTH || b.bottom > OG_HEIGHT) problems.push(`the ${key} overflows`);
  }
  if (
    !layout.fontsLoaded.some((f) => f.startsWith('Inter')) ||
    !layout.fontsLoaded.some((f) => f.startsWith('JetBrains'))
  ) {
    problems.push(`the site fonts did not load (loaded: ${layout.fontsLoaded.join(', ') || 'none'})`);
  }

  const png = withPngText(
    await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: OG_WIDTH, height: OG_HEIGHT } }),
    OG_HASH_KEY,
    ogSourceHash(content, tokens),
  );
  if (png.length >= OG_MAX_BYTES) problems.push(`the PNG is ${png.length} bytes (must be under ${OG_MAX_BYTES})`);

  console.log(
    `name ${layout.name.lines} line(s), title ${layout.title.lines}, tagline ${layout.tagline.lines}; ` +
      `PNG ${(png.length / 1024).toFixed(1)} KB`,
  );
  if (problems.length > 0) {
    console.error(`OG image not written:\n  ${problems.join('\n  ')}`);
    process.exitCode = 1;
  } else {
    fs.writeFileSync(OG_IMAGE_FILE, png);
    console.log(`Wrote ${path.relative(ROOT, OG_IMAGE_FILE)}. Run npm run build so dist/ gets it.`);
  }
} finally {
  await browser.close();
}
