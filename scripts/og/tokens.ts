// Reads the dark-theme design tokens (--bg, --text, ...) from src/styles/global.css for the OG image. Line endings
// are normalized first, so the result is the same on Windows (CRLF checkout) and Linux.

import fs from 'node:fs';
import path from 'node:path';

export const GLOBAL_CSS = path.join(import.meta.dirname, '..', '..', 'src', 'styles', 'global.css');

export type Tokens = Record<string, string>;

const DARK_SELECTOR = ":root,\n:root[data-theme='dark'] {";
// The explicit light block (Task 2.21, the light variant of favicon.svg). Its no-data-theme copy inside
// @media (prefers-color-scheme: light) must match it (tests/design-tokens.test.ts).
const LIGHT_SELECTOR = "\n:root[data-theme='light'] {";

function blockTokens(css: string, selector: string): Tokens {
  const text = css.replace(/\r\n?/g, '\n');
  const start = text.indexOf(selector);
  if (start === -1) throw new Error(`no "${selector.trim()}" block in global.css`);
  const body = text.slice(start + selector.length, text.indexOf('}', start));
  return Object.fromEntries(
    [...body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map(([, name, value]) => [name, value.trim()]),
  );
}

/** Custom properties in global.css's dark block, from the CSS text. */
export function darkTokens(css: string): Tokens {
  return blockTokens(css, DARK_SELECTOR);
}

/** Custom properties in global.css's :root[data-theme='light'] block, from the CSS text. */
export function lightTokens(css: string): Tokens {
  return blockTokens(css, LIGHT_SELECTOR);
}

export function readDarkTokens(cssPath: string = GLOBAL_CSS): Tokens {
  return darkTokens(fs.readFileSync(cssPath, 'utf8'));
}

export function readLightTokens(cssPath: string = GLOBAL_CSS): Tokens {
  return lightTokens(fs.readFileSync(cssPath, 'utf8'));
}
