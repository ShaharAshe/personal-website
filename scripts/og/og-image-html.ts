// The OG image's HTML (1200×630, dark theme), rendered to public/og-image.png by render-og-image.ts. Pure: the
// text comes from heroContent() (resume.yaml: name, title, tagline; never email or phone) and the colors from
// global.css's dark tokens. Fonts are the site's own Inter and JetBrains Mono, passed in as @font-face CSS.
//
// The text is centered so a square crop (WhatsApp) keeps the name and title, and sized for a ~500px-wide preview.
// render-og-image.ts checks that layout before writing the PNG.
//
// Stale check: ogSourceHash() is stored in the PNG (tEXt "og-source-sha256"); tests/og-image.test.ts recomputes it,
// so a change to the text, a token or this template fails npm test until npm run og is run again. The PNG also carries
// the CTF chain's clue 3 (Task F.2: tEXt "Comment", CTF_PNG_TEXT from src/lib/ctf.mts); ogStaleProblems() checks it
// too, so changing that clue fails npm test the same way.

import crypto from 'node:crypto';
import path from 'node:path';
import { CTF_PNG_TEXT } from '../../src/lib/ctf.mts';
import { readPngText } from './png.ts';
import type { Tokens } from './tokens.ts';

export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;
export const OG_HASH_KEY = 'og-source-sha256';
export const OG_IMAGE_FILE = path.join(import.meta.dirname, '..', '..', 'public', 'og-image.png');
/** WhatsApp skips preview images larger than this. */
export const OG_MAX_BYTES = 300 * 1024;

export interface OgContent {
  name: string;
  title: string;
  tagline: string;
}

const lf = (text: string) => text.replace(/\r\n?/g, '\n');

const escapeHtml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function token(tokens: Tokens, name: string): string {
  const value = tokens[name];
  if (!value) throw new Error(`global.css has no ${name} in its dark block`);
  return lf(value).trim();
}

export function ogImageHtml(content: OgContent, tokens: Tokens, fontCss = ''): string {
  const [name, title, tagline] = [content.name, content.title, content.tagline].map((t) => escapeHtml(lf(t).trim()));
  const bg = token(tokens, '--bg');
  const text = token(tokens, '--text');
  const muted = token(tokens, '--text-muted');
  const accent = token(tokens, '--accent');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<style>${fontCss}</style>
<style>
  * { margin: 0; box-sizing: border-box; }
  html, body { width: ${OG_WIDTH}px; height: ${OG_HEIGHT}px; overflow: hidden; }
  body {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
    background: ${bg};
    color: ${text};
    font-family: var(--font-inter, sans-serif);
  }
  /* The Hero's dot grid, in the outer side margins only (never under the text), fading out at the top and bottom. */
  body::before {
    content: '';
    position: absolute;
    inset: 0;
    background-image: radial-gradient(color-mix(in srgb, ${muted} 35%, transparent) 2px, transparent 2px);
    background-size: 24px 24px;
    mask-image:
      linear-gradient(to right, black 16px, transparent 64px, transparent 1136px, black 1184px),
      linear-gradient(to bottom, transparent, black 20%, black 80%, transparent);
    mask-composite: intersect;
  }
  /* The Hero's soft accent glow, behind the name. */
  body::after {
    content: '';
    position: absolute;
    inset: 0;
    background-image: radial-gradient(ellipse 45% 55% at 50% 40%, color-mix(in srgb, ${accent} 10%, transparent), transparent);
  }
  main { position: relative; z-index: 1; display: flex; flex-direction: column; align-items: center; }
  [data-og-name] { max-width: 600px; font-size: 96px; font-weight: 600; letter-spacing: -0.025em; line-height: 1.1; }
  [data-og-title] {
    margin-top: 24px;
    max-width: 600px;
    font-family: var(--font-jetbrains-mono, monospace);
    font-size: 30px;
    line-height: 1.35;
    text-wrap: balance;
    color: ${accent};
  }
  [data-og-tagline] { margin-top: 36px; max-width: 1080px; font-size: 30px; line-height: 1.4; text-wrap: balance; color: ${muted}; }
</style>
</head>
<body>
<main>
  <h1 data-og-name>${name}</h1>
  <p data-og-title>${title}</p>
  <p data-og-tagline>${tagline}</p>
</main>
</body>
</html>
`;
}

/** sha256 of the template without fonts, with LF line endings: the same on Windows and Linux. */
export function ogSourceHash(content: OgContent, tokens: Tokens): string {
  return crypto
    .createHash('sha256')
    .update(lf(ogImageHtml(content, tokens)), 'utf8')
    .digest('hex');
}

export interface PngTextChunk {
  keyword: string;
  text: string;
}

/** The tEXt chunks npm run og writes besides the hash: the CTF chain's clue 3. */
export const OG_EXTRA_TEXT: readonly PngTextChunk[] = [CTF_PNG_TEXT];

/**
 * Why a PNG is stale, as readable problems (empty when it's current): its stored hash isn't expectedHash, or one of
 * the extra tEXt chunks is missing or holds other text.
 */
export function ogStaleProblems(png: Buffer, expectedHash: string, extra = OG_EXTRA_TEXT): string[] {
  const problems: string[] = [];
  const stored = readPngText(png, OG_HASH_KEY);
  if (stored === undefined) problems.push(`no ${OG_HASH_KEY} chunk`);
  else if (stored !== expectedHash) problems.push(`${OG_HASH_KEY} doesn't match the template, text or tokens`);
  for (const { keyword, text } of extra) {
    const found = readPngText(png, keyword);
    if (found === undefined) problems.push(`no ${keyword} chunk`);
    else if (found !== text) problems.push(`the ${keyword} chunk doesn't match src/lib/ctf.mts`);
  }
  return problems;
}
