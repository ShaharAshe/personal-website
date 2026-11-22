// The SVG favicon (Task 2.21), written to public/favicon.svg by render-icons.ts (npm run og). The tab bar's color
// follows the browser or OS theme, not the site's toggle, so the colors switch only through prefers-color-scheme
// inside the file. Nothing on the page touches it.
//
// Same design as favicon.ico (Task 2.13a): the initials of basics.name in JetBrains Mono on a rounded square, with the
// 32px template's geometry. An SVG image can't load web fonts, so the letters are the glyph outlines of the site's own
// built JetBrains Mono woff2, read with fontkitten.
//
// Colors, from global.css (never typed):
//   dark (the default):        --accent on --bg from the dark block, as presentation attributes;
//   prefers-color-scheme light: --accent on --bg from the light block, in the <style>. Author CSS beats presentation
//                               attributes, and if a browser ever ignored the style the icon stays the dark one (never a
//                               black square).
//
// Stale check: the file carries iconSvgSourceHash() in a comment. tests/site-icons.test.ts recomputes it from today's
// name and tokens, so a change to either, or to this template, fails npm test until npm run og is run again.
//
// Task 2.21a: the fixed variants public/favicon-dark.svg and public/favicon-light.svg (fixedFaviconSvg()), the same
// outlines in one block's two colors as attributes, with no <style>. The head script and the theme toggle point the SVG
// icon link at one of them when the visitor has chosen a theme or terminal view (src/lib/theme.ts); with no choice it
// stays favicon.svg. Each carries its own stale hash (fixedIconSvgSourceHash()).

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { create } from 'fontkitten';
import { SITE_ICONS } from '../../src/lib/seo.ts';
import type { Tokens } from './tokens.ts';

export const SVG_HASH_KEY = 'icon-source-sha256';
const PUBLIC = path.join(import.meta.dirname, '..', '..', 'public');
export const FAVICON_SVG_FILE = path.join(PUBLIC, SITE_ICONS.svg.path.slice(1));

/** The two color schemes of the fixed variants. */
export type Scheme = keyof typeof SITE_ICONS.svgFixed;
export const SCHEMES = Object.keys(SITE_ICONS.svgFixed) as Scheme[];

/** public/favicon-dark.svg and public/favicon-light.svg (Task 2.21a). */
export const FIXED_SVG_FILES: Record<Scheme, string> = {
  dark: path.join(PUBLIC, SITE_ICONS.svgFixed.dark.slice(1)),
  light: path.join(PUBLIC, SITE_ICONS.svgFixed.light.slice(1)),
};

/** The 32px favicon's look (ICON_STYLES[32] in icon-html.ts), in viewBox units. */
export const SVG_GEOMETRY = { size: 32, radius: 6, fontSize: 20 } as const;

/** Drawing commands as fontkitten gives them: moveTo, lineTo, quadraticCurveTo, bezierCurveTo, closePath. */
export interface PathCommand {
  command: string;
  args: number[];
}

/** One glyph, in font units (y up). */
export interface GlyphOutline {
  char: string;
  advance: number;
  commands: PathCommand[];
}

export interface FontOutlines {
  familyName: string;
  unitsPerEm: number;
  capHeight: number;
  glyphs: GlyphOutline[];
}

const lf = (text: string) => text.replace(/\r\n?/g, '\n');

const escapeXml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function color(tokens: Tokens, name: string, block: string): string {
  const value = tokens[name];
  if (!value) throw new Error(`global.css has no ${name} in its ${block} block`);
  const hex = lf(value).trim().toLowerCase();
  if (!/^#[0-9a-f]{6}$/.test(hex)) throw new Error(`${block} ${name} is not a #rrggbb color: ${hex}`);
  return hex;
}

/** The four colors: the dark and light --bg (tile) and --accent (letters). */
export function svgColors(dark: Tokens, light: Tokens) {
  return {
    dark: { bg: color(dark, '--bg', 'dark'), fg: color(dark, '--accent', 'dark') },
    light: { bg: color(light, '--bg', 'light'), fg: color(light, '--accent', 'light') },
  };
}

/** Two decimals, no trailing zeros, never "-0". */
function num(n: number): string {
  const r = Math.round(n * 100) / 100;
  return String(Object.is(r, -0) ? 0 : r);
}

/**
 * Each glyph's outline moved into the viewBox: scaled to the font size, y flipped, centered like the PNGs (on the
 * advance widths horizontally, on the cap height vertically, as `text-box: trim-both cap alphabetic` does).
 * Returns the path data per glyph and the box around every point (control points included).
 */
export function layoutGlyphs(font: FontOutlines) {
  const { size, fontSize } = SVG_GEOMETRY;
  const scale = fontSize / font.unitsPerEm;
  const width = font.glyphs.reduce((sum, g) => sum + g.advance, 0) * scale;
  const baseline = (size + font.capHeight * scale) / 2;
  const box = { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity };
  let pen = (size - width) / 2;
  const paths = font.glyphs.map((glyph) => {
    const parts: string[] = [];
    for (const { command, args } of glyph.commands) {
      const points: string[] = [];
      for (let i = 0; i + 1 < args.length; i += 2) {
        const x = pen + args[i] * scale;
        const y = baseline - args[i + 1] * scale;
        box.left = Math.min(box.left, x);
        box.right = Math.max(box.right, x);
        box.top = Math.min(box.top, y);
        box.bottom = Math.max(box.bottom, y);
        points.push(`${num(x)} ${num(y)}`);
      }
      const letter = { moveTo: 'M', lineTo: 'L', quadraticCurveTo: 'Q', bezierCurveTo: 'C', closePath: 'Z' }[command];
      if (!letter) throw new Error(`unknown path command ${command} in "${glyph.char}"`);
      parts.push(`${letter}${points.join(' ')}`);
    }
    pen += glyph.advance * scale;
    return parts.join('');
  });
  return { paths, box };
}

/**
 * The SVG. Without `font`, each path's data is a placeholder naming its letter: that skeleton is what the stale hash
 * covers (the template, the initials and the four colors), like the PNGs' hash leaves the font file out.
 */
export function faviconSvg(initials: string, dark: Tokens, light: Tokens, font?: FontOutlines, hash?: string): string {
  const data = pathData(initials, font);
  const c = svgColors(dark, light);
  const { size, radius } = SVG_GEOMETRY;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}">`,
    ...(hash ? [`<!-- ${SVG_HASH_KEY}: ${hash} -->`] : []),
    `<style>@media (prefers-color-scheme: light){.bg{fill:${c.light.bg}}.fg{fill:${c.light.fg}}}</style>`,
    `<rect class="bg" width="${size}" height="${size}" rx="${radius}" fill="${c.dark.bg}"/>`,
    ...data.map((d) => `<path class="fg" fill="${c.dark.fg}" d="${d}"/>`),
    '</svg>',
    '',
  ].join('\n');
}

/** Each initial's path data: the laid-out outlines, or without `font` a placeholder naming the letter. */
function pathData(initials: string, font?: FontOutlines): string[] {
  const chars = [...lf(initials).trim()];
  if (chars.length === 0) throw new Error('no initials for favicon.svg');
  if (font && font.glyphs.map((g) => g.char).join('') !== chars.join('')) {
    throw new Error(`the outlines are for "${font.glyphs.map((g) => g.char).join('')}", not "${chars.join('')}"`);
  }
  return font ? layoutGlyphs(font).paths : chars.map((ch) => `glyph:${escapeXml(ch)}`);
}

/**
 * A fixed variant (Task 2.21a): favicon.svg's tile and outlines in one block's --bg and --accent, as attributes, with
 * no <style> and no class, so it looks the same whatever the browser's color scheme. `tokens` is that block's.
 */
export function fixedFaviconSvg(
  initials: string,
  tokens: Tokens,
  scheme: Scheme,
  font?: FontOutlines,
  hash?: string,
): string {
  const data = pathData(initials, font);
  const c = { bg: color(tokens, '--bg', scheme), fg: color(tokens, '--accent', scheme) };
  const { size, radius } = SVG_GEOMETRY;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}">`,
    ...(hash ? [`<!-- ${SVG_HASH_KEY}: ${hash} -->`] : []),
    `<rect width="${size}" height="${size}" rx="${radius}" fill="${c.bg}"/>`,
    ...data.map((d) => `<path fill="${c.fg}" d="${d}"/>`),
    '</svg>',
    '',
  ].join('\n');
}

const sha256 = (text: string) => crypto.createHash('sha256').update(lf(text), 'utf8').digest('hex');

/** sha256 of the skeleton (no outlines, no hash line), with LF line endings: the same on Windows and Linux. */
export function iconSvgSourceHash(initials: string, dark: Tokens, light: Tokens): string {
  return sha256(faviconSvg(lf(initials), dark, light));
}

/** The same for a fixed variant: its skeleton, so only the initials and that block's two colors count. */
export function fixedIconSvgSourceHash(initials: string, tokens: Tokens, scheme: Scheme): string {
  return sha256(fixedFaviconSvg(lf(initials), tokens, scheme));
}

/** The hash stored in a favicon.svg's comment, or undefined. */
export function readSvgHash(svg: string): string | undefined {
  return svg.match(new RegExp(`<!-- ${SVG_HASH_KEY}: ([0-9a-f]{64}) -->`))?.[1];
}

/**
 * The built JetBrains Mono 400 file for Latin (the face whose unicode-range starts at U+0000), from the <Font />
 * @font-face CSS that readFontCss() takes from dist/index.html. Returns its path under dist.
 */
export function jetBrainsMonoFile(fontCss: string, dist: string): string {
  for (const [face] of fontCss.matchAll(/@font-face\s*\{[^}]*\}/g)) {
    if (!/font-family:\s*"JetBrains Mono[^"]*"/.test(face)) continue;
    if (!/font-weight:\s*400\b/.test(face) || !/font-style:\s*normal\b/.test(face)) continue;
    if (!/unicode-range:\s*U\+0000-/.test(face)) continue;
    const url = face.match(/url\("?(\/_astro\/fonts\/[\w.-]+\.woff2)"?\)/)?.[1];
    if (url) return path.join(dist, url);
  }
  throw new Error('no JetBrains Mono 400 Latin @font-face in dist/index.html');
}

/** The outlines of each initial from a font file. Throws if the font has no glyph for one of them. */
export function readGlyphs(fontFile: string, initials: string): FontOutlines {
  const font = create(fs.readFileSync(fontFile));
  if (!('glyphForCodePoint' in font)) throw new Error(`${fontFile} is a font collection, not one font`);
  const glyphs = [...lf(initials).trim()].map((char) => {
    const codePoint = char.codePointAt(0)!;
    if (!font.hasGlyphForCodePoint(codePoint)) throw new Error(`${font.familyName} has no glyph for "${char}"`);
    const glyph = font.glyphForCodePoint(codePoint);
    return {
      char,
      advance: glyph.advanceWidth,
      commands: glyph.path.commands.map(({ command, args }) => ({ command, args: [...args] })),
    };
  });
  return { familyName: font.familyName, unitsPerEm: font.unitsPerEm, capHeight: font.capHeight, glyphs };
}
