// Shared by render-og-image.ts and render-icons.ts: the site's own fonts from a build. The <Font /> @font-face styles
// come from dist/index.html, the font files from dist/_astro/fonts/, served to a Playwright page through page.route
// on a fake origin (nothing touches the network).

import fs from 'node:fs';
import path from 'node:path';
import type { Page } from '@playwright/test';

export const ROOT = path.join(import.meta.dirname, '..', '..');
export const DIST = path.join(ROOT, 'dist');
export const ORIGIN = 'https://og.invalid';

/** The <Font /> styles in dist/index.html (@font-face rules plus the --font-* variables). Exits without a build. */
export function readFontCss(dist: string = DIST): string {
  const indexHtml = path.join(dist, 'index.html');
  if (!fs.existsSync(indexHtml)) {
    console.error('dist/index.html not found: run npm run build first (the images use the built fonts).');
    process.exit(1);
  }
  const fontCss = [...fs.readFileSync(indexHtml, 'utf8').matchAll(/<style>([^<]*@font-face[^<]*)<\/style>/g)]
    .map(([, css]) => css)
    .join('\n');
  if (!fontCss.includes('--font-inter') || !fontCss.includes('--font-jetbrains-mono')) {
    console.error('No <Font /> styles for Inter and JetBrains Mono in dist/index.html.');
    process.exit(1);
  }
  return fontCss;
}

/** Serves `html` at ORIGIN/ and the built font files at ORIGIN/_astro/fonts/; everything else is a 404. */
export async function routeSite(page: Page, html: () => string, dist: string = DIST): Promise<void> {
  await page.route(`${ORIGIN}/**`, async (route) => {
    const { pathname } = new URL(route.request().url());
    if (pathname === '/') return route.fulfill({ contentType: 'text/html', body: html() });
    const file = path.join(dist, pathname);
    if (pathname.startsWith('/_astro/fonts/') && fs.existsSync(file)) {
      return route.fulfill({ contentType: 'font/woff2', body: fs.readFileSync(file) });
    }
    return route.fulfill({ status: 404 });
  });
}

/** Playwright's browser: Edge locally, Playwright's Chromium in CI (as in playwright.config.ts). */
export const browserChannel = process.env.CI ? undefined : 'msedge';
