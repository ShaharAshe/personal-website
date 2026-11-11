// The site icons' HTML (Task 2.13a), rendered to public/favicon.ico (16, 32, 48) and public/apple-touch-icon.png (180)
// by render-icons.ts. Pure: the initials come from basics.name in resume.yaml (never typed), the colors from
// global.css's dark tokens (--accent on --bg, one version for both themes: it's dark, so it reads on light and dark
// browser chrome). The font is the site's own JetBrains Mono, passed in as @font-face CSS.
//
// Each size is its own template, rendered at its real pixel size so the glyphs are hinted for it (not a big image
// scaled down). The favicon sizes are a rounded square with transparent corners; the apple-touch-icon is a full,
// opaque square (iOS rounds it itself and fills transparent pixels with black).
//
// Stale check: iconSourceHash() is stored in every PNG (tEXt "icon-source-sha256"); tests/site-icons.test.ts
// recomputes it, so a change to the name, a token or this template fails npm test until npm run og is run again.

import crypto from 'node:crypto';
import path from 'node:path';
import { SITE_ICONS } from '../../src/lib/seo.ts';
import type { Tokens } from './tokens.ts';

export const ICON_HASH_KEY = 'icon-source-sha256';
const PUBLIC = path.join(import.meta.dirname, '..', '..', 'public');
export const FAVICON_FILE = path.join(PUBLIC, SITE_ICONS.favicon.path.slice(1));
export const APPLE_TOUCH_ICON_FILE = path.join(PUBLIC, SITE_ICONS.appleTouch.path.slice(1));

export interface IconStyle {
  /** Rounded square with transparent corners (favicon) or a full opaque square (apple-touch-icon). */
  rounded: boolean;
  fontSize: number;
  radius: number;
  /** Thickens the strokes at tiny sizes, where JetBrains Mono 400 (the only weight the site loads) gets thin. */
  stroke: number;
}

/** The look per size, tuned by eye on the 8× review (npm run screenshots → screenshots/icons.png). */
export const ICON_STYLES: Record<number, IconStyle> = {
  16: { rounded: true, fontSize: 11, radius: 3, stroke: 0.4 },
  32: { rounded: true, fontSize: 20, radius: 6, stroke: 0 },
  48: { rounded: true, fontSize: 30, radius: 9, stroke: 0 },
  180: { rounded: false, fontSize: 92, radius: 0, stroke: 0 },
};

export const ICON_SIZES = [...SITE_ICONS.favicon.sizes, SITE_ICONS.appleTouch.size];

const lf = (text: string) => text.replace(/\r\n?/g, '\n');

const escapeHtml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** "Shahar Asher" → "SA": the first letters of the first and last words, uppercased. One word → one letter. */
export function initialsOf(name: string): string {
  const words = lf(name).trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) throw new Error('basics.name is empty: no initials for the site icon');
  const picked = words.length === 1 ? [words[0]] : [words[0], words[words.length - 1]];
  return picked.map((w) => [...w][0].toLocaleUpperCase('en')).join('');
}

function token(tokens: Tokens, name: string): string {
  const value = tokens[name];
  if (!value) throw new Error(`global.css has no ${name} in its dark block`);
  return lf(value).trim();
}

export function iconHtml(initials: string, tokens: Tokens, size: number, fontCss = ''): string {
  const style = ICON_STYLES[size];
  if (!style) throw new Error(`no icon style for ${size}px`);
  const bg = token(tokens, '--bg');
  const accent = token(tokens, '--accent');
  const stroke = style.stroke > 0 ? `-webkit-text-stroke: ${style.stroke}px ${accent};` : '';
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<style>${fontCss}</style>
<style>
  * { margin: 0; box-sizing: border-box; }
  html, body { width: ${size}px; height: ${size}px; overflow: hidden; background: transparent; }
  main {
    width: ${size}px;
    height: ${size}px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: ${bg};
    border-radius: ${style.rounded ? style.radius : 0}px;
  }
  [data-icon-text] {
    font-family: var(--font-jetbrains-mono, monospace);
    font-size: ${style.fontSize}px;
    font-weight: 400;
    line-height: 1;
    /* Centers the capitals themselves, not the line box with its descender space. */
    text-box: trim-both cap alphabetic;
    white-space: nowrap;
    color: ${accent};
    ${stroke}
  }
</style>
</head>
<body>
<main><span data-icon-text>${escapeHtml(lf(initials).trim())}</span></main>
</body>
</html>
`;
}

/** sha256 of every size's template without fonts, with LF line endings: the same on Windows and Linux. */
export function iconSourceHash(initials: string, tokens: Tokens): string {
  const hash = crypto.createHash('sha256');
  for (const size of ICON_SIZES) hash.update(`${size}\n${lf(iconHtml(initials, tokens, size))}`, 'utf8');
  return hash.digest('hex');
}
