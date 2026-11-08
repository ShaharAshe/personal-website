// Reads the dark-theme design tokens (--bg, --text, ...) from src/styles/global.css for the OG image. Line endings
// are normalized first, so the result is the same on Windows (CRLF checkout) and Linux.

import fs from 'node:fs';
import path from 'node:path';

export const GLOBAL_CSS = path.join(import.meta.dirname, '..', '..', 'src', 'styles', 'global.css');

export type Tokens = Record<string, string>;

const DARK_SELECTOR = ":root,\n:root[data-theme='dark'] {";

/** Custom properties in global.css's dark block, from the CSS text. */
export function darkTokens(css: string): Tokens {
  const text = css.replace(/\r\n?/g, '\n');
  const start = text.indexOf(DARK_SELECTOR);
  if (start === -1) throw new Error(`no "${DARK_SELECTOR}" block in global.css`);
  const body = text.slice(start + DARK_SELECTOR.length, text.indexOf('}', start));
  return Object.fromEntries(
    [...body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map(([, name, value]) => [name, value.trim()]),
  );
}

export function readDarkTokens(cssPath: string = GLOBAL_CSS): Tokens {
  return darkTokens(fs.readFileSync(cssPath, 'utf8'));
}
