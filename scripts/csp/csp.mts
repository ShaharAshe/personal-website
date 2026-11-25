// The Content-Security-Policy header (Task 2.14, design-doc §12). Astro inlines some scripts and styles into the
// built HTML: the no-flash theme script (src/lib/theme-init.ts), small component scripts below Vite's inline limit
// (ThemeToggle, CopyEmail), component <style> blocks and <Font />'s @font-face rules. Their text changes whenever the
// code does, so their hashes are never written by hand: after every `astro build`, the cspHeaders() integration
// (registered in astro.config.mjs) hashes every inline <script> and <style> in dist/ and writes one site-wide policy
// into dist/_headers, in place of the fail-closed template line from public/_headers.
//
// The only third party is Cloudflare Web Analytics (Task 2.15): the beacon's URL in script-src and its reporting
// origin in connect-src. Its config is a data-cf-beacon attribute on a src script, so it needs no hash.
//
// One policy on `/*` for every page: Cloudflare applies `/*` to the 404 response too, and a page allowing the hash of
// a script it doesn't contain is harmless (the script is the site's own code).
//
// The build fails when:
// - a page has something a hash can't allow: a style="..." attribute, an inline event handler (onclick=...) or a
//   javascript: URL;
// - the template line is missing or appears more than once;
// - dist/_headers breaks Cloudflare's limits (a line over 2,000 characters, or more than 100 rules).
//
// Pure functions plus one file-writing entry point, so tests/csp.test.ts can run all of it without a build.
//
// .mts, not .ts: astro.config.mjs imports it, and Node loads it there without the
// --disable-warning=MODULE_TYPELESS_PACKAGE_JSON flag the npm scripts pass (package.json has no "type"). A .mts file
// is always ESM, so the build prints no warning. For the same reason it imports no project .ts file.

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AstroIntegration } from 'astro';

/** The line in public/_headers that the build replaces. Fail-closed: served as is, it blocks everything. */
export const CSP_TEMPLATE = "Content-Security-Policy: default-src 'none'";

/** Cloudflare's limits for _headers: characters per line (header name included) and number of rules. */
export const MAX_HEADERS_LINE_LENGTH = 2000;
export const MAX_HEADERS_RULES = 100;

export interface InlineBlocks {
  scripts: string[];
  styles: string[];
}

// The HTML parser turns CRLF and lone CR into LF before the browser hashes an element's text.
const normalizeNewlines = (text: string) => text.replace(/\r\n?/g, '\n');

const SCRIPT_RE = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;
const STYLE_RE = /<style\b[^>]*>([\s\S]*?)<\/style\s*>/gi;

/**
 * The text of every inline <script> and <style> in a page, as the browser hashes it. Skipped: scripts with a src
 * (covered by 'self') and JSON-LD data blocks (never run, so script-src doesn't apply). A regex is safe here: script
 * and style are raw-text elements, so their content can't contain their own end tag.
 */
export function extractInline(html: string): InlineBlocks {
  const scripts: string[] = [];
  for (const [, attrs = '', body = ''] of html.matchAll(SCRIPT_RE)) {
    if (/(^|\s)src\s*=/i.test(attrs)) continue;
    if (/(^|\s)type\s*=\s*["']?application\/ld\+json/i.test(attrs)) continue;
    scripts.push(normalizeNewlines(body));
  }
  const styles = [...html.matchAll(STYLE_RE)].map(([, body = '']) => normalizeNewlines(body));
  return { scripts, styles };
}

/** A CSP hash source (without quotes): 'sha256-' + base64 of the SHA-256 of the UTF-8 text. */
export function sha256Source(text: string): string {
  return `sha256-${crypto.createHash('sha256').update(text, 'utf8').digest('base64')}`;
}

// A start tag with its attributes; quoted values may contain ">" (e.g. Tailwind's [&>svg] classes).
const TAG_RE = /<[a-zA-Z][^\s/>]*(?:\s+[^\s"'>/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'>]+))?)*\s*\/?>/g;
const ATTR_RE = /([^\s"'>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
// Attributes whose value the browser follows or submits to, so a javascript: value there would run.
const URL_ATTRS = new Set(['href', 'xlink:href', 'src', 'action', 'formaction']);

/**
 * What a hash can't allow, as readable findings: style="..." attributes (style-src would need 'unsafe-inline'),
 * inline event handlers (on...=) and javascript: URLs (both would need 'unsafe-inline' in script-src).
 */
export function findUnhashable(html: string): string[] {
  // Script and style bodies aren't markup; blank them so their text can't look like a tag.
  const markup = html.replace(SCRIPT_RE, '<script>').replace(STYLE_RE, '<style>');
  const findings: string[] = [];
  for (const [tag] of markup.matchAll(TAG_RE)) {
    const name = tag.match(/^<([^\s/>]+)/)?.[1] ?? '';
    const attrs = tag.slice(name.length + 1);
    for (const [, attr = '', dq, sq, bare] of attrs.matchAll(ATTR_RE)) {
      const key = attr.toLowerCase();
      const value = dq ?? sq ?? bare ?? '';
      const short = tag.length > 120 ? `${tag.slice(0, 117)}...` : tag;
      if (key === 'style') findings.push(`style attribute: ${short}`);
      else if (/^on[a-z]+$/.test(key)) findings.push(`inline event handler (${key}): ${short}`);
      else if (URL_ATTRS.has(key) && /^\s*javascript:/i.test(value)) findings.push(`javascript: URL: ${short}`);
    }
  }
  return findings;
}

/**
 * Cloudflare Web Analytics (Task 2.15): the beacon script (the exact file, not the whole host) and the origin it
 * reports to (https://cloudflareinsights.com/cdn-cgi/rum). The same URL is CF_BEACON_SRC in src/lib/analytics.ts;
 * repeated here because this file imports no project .ts (see the top), and tests/analytics.test.ts keeps them equal.
 */
export const CF_BEACON_SCRIPT = 'https://static.cloudflareinsights.com/beacon.min.js';
export const CF_INSIGHTS_CONNECT = 'https://cloudflareinsights.com';

/** The site's policy. Hashes are deduplicated and sorted, so the same build always writes the same header. */
export function buildPolicy({ scriptHashes, styleHashes }: { scriptHashes: string[]; styleHashes: string[] }): string {
  const quoted = (hashes: string[]) => [...new Set(hashes)].sort().map((hash) => `'${hash}'`);
  return [
    "default-src 'self'",
    ['script-src', "'self'", CF_BEACON_SCRIPT, ...quoted(scriptHashes)].join(' '),
    ['style-src', "'self'", ...quoted(styleHashes)].join(' '),
    "img-src 'self'",
    "font-src 'self'",
    `connect-src 'self' ${CF_INSIGHTS_CONNECT}`,
    "object-src 'none'",
    "base-uri 'none'",
    // No form posts anywhere until the contact form (plan.md Task 3.3), which changes this to 'self'.
    "form-action 'none'",
    "frame-ancestors 'none'",
  ].join('; ');
}

/** Replaces the one template line with the real policy, keeping its indentation. */
export function applyCsp(headersText: string, policy: string): string {
  const lines = headersText.split('\n');
  const matches = lines.flatMap((line, i) => (line.trim() === CSP_TEMPLATE ? [i] : []));
  if (matches.length !== 1) {
    throw new Error(`_headers must contain the line "${CSP_TEMPLATE}" exactly once (found ${matches.length})`);
  }
  const i = matches[0]!;
  const indent = lines[i]!.match(/^\s*/)?.[0] ?? '';
  lines[i] = `${indent}Content-Security-Policy: ${policy}`;
  return lines.join('\n');
}

export interface HeadersRule {
  path: string;
  /** Header lines as written: name and value. */
  headers: { name: string; value: string }[];
  /** Headers removed by "! Name" lines. */
  detached: string[];
}

/** Cloudflare's _headers format: an unindented path line, then indented "Name: value" or "! Name" lines. */
export function parseHeaders(text: string): HeadersRule[] {
  const rules: HeadersRule[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trimEnd();
    if (!line.trim() || line.trim().startsWith('#')) continue;
    if (!/^\s/.test(line)) {
      rules.push({ path: line, headers: [], detached: [] });
      continue;
    }
    const rule = rules.at(-1);
    if (!rule) throw new Error(`_headers: header line before any path: ${line.trim()}`);
    const content = line.trim();
    if (content.startsWith('!')) {
      rule.detached.push(content.slice(1).trim());
      continue;
    }
    const colon = content.indexOf(':');
    if (colon < 1) throw new Error(`_headers: not a "Name: value" line: ${content}`);
    rule.headers.push({ name: content.slice(0, colon).trim(), value: content.slice(colon + 1).trim() });
  }
  return rules;
}

/**
 * Whether a _headers rule's path pattern matches a URL path, as Cloudflare matches it: the whole path, where `*` (a
 * splat) matches any run of characters, `/` included, and `:name` (a placeholder) matches one path segment.
 */
export function headersRuleMatches(pattern: string, urlPath: string): boolean {
  const source = pattern
    .split(/(\*|:[A-Za-z]\w*)/)
    .map((part) => {
      if (part === '*') return '.*';
      if (/^:[A-Za-z]\w*$/.test(part)) return '[^/]+';
      return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    })
    .join('');
  return new RegExp(`^${source}$`).test(urlPath);
}

/** Cloudflare's limits, as readable errors (empty when the file is fine). Comment lines aren't rules or headers. */
export function checkHeadersLimits(text: string, label = '_headers'): string[] {
  const errors: string[] = [];
  text.split(/\r?\n/).forEach((line, i) => {
    if (line.trim().startsWith('#')) return;
    if (line.length > MAX_HEADERS_LINE_LENGTH) {
      errors.push(
        `${label} line ${i + 1} is ${line.length} characters (max ${MAX_HEADERS_LINE_LENGTH}): ${line.trim().slice(0, 60)}...`,
      );
    }
  });
  const rules = parseHeaders(text).length;
  if (rules > MAX_HEADERS_RULES) errors.push(`${label} has ${rules} rules (max ${MAX_HEADERS_RULES})`);
  return errors;
}

/** Every built HTML page under distDir, as paths relative to it. */
export function listHtmlPages(distDir: string): string[] {
  return fs
    .readdirSync(distDir, { recursive: true, encoding: 'utf8' })
    .filter((file) => file.toLowerCase().endsWith('.html'))
    .filter((file) => fs.statSync(path.join(distDir, file)).isFile())
    .sort();
}

export interface CspResult {
  policy: string;
  pages: string[];
  scriptHashes: string[];
  styleHashes: string[];
  /** Length of the Content-Security-Policy line in dist/_headers, indentation included. */
  cspLineLength: number;
}

/** Hashes every page in distDir and writes the policy into distDir/_headers. Throws on any problem. */
export function writeCspHeaders(distDir: string): CspResult {
  const pages = listHtmlPages(distDir);
  if (pages.length === 0) throw new Error(`CSP: no HTML pages in ${distDir}`);

  const scriptHashes = new Set<string>();
  const styleHashes = new Set<string>();
  const problems: string[] = [];
  for (const page of pages) {
    const html = fs.readFileSync(path.join(distDir, page), 'utf8');
    const { scripts, styles } = extractInline(html);
    for (const text of scripts) scriptHashes.add(sha256Source(text));
    for (const text of styles) styleHashes.add(sha256Source(text));
    for (const finding of findUnhashable(html)) problems.push(`${page}: ${finding}`);
  }
  if (problems.length > 0) {
    throw new Error(`CSP: the built HTML has markup a hash can't allow:\n${problems.join('\n')}`);
  }

  const policy = buildPolicy({ scriptHashes: [...scriptHashes], styleHashes: [...styleHashes] });
  const headersPath = path.join(distDir, '_headers');
  const headers = applyCsp(fs.readFileSync(headersPath, 'utf8'), policy);
  const limits = checkHeadersLimits(headers, 'dist/_headers');
  if (limits.length > 0) throw new Error(`CSP: ${limits.join('\n')}`);
  fs.writeFileSync(headersPath, headers);

  const cspLine = headers.split('\n').find((line) => line.trim().startsWith('Content-Security-Policy:')) ?? '';
  return {
    policy,
    pages,
    scriptHashes: [...scriptHashes].sort(),
    styleHashes: [...styleHashes].sort(),
    cspLineLength: cspLine.length,
  };
}

/** The Astro integration: runs writeCspHeaders on dist/ after every `astro build`. */
export function cspHeaders(): AstroIntegration {
  return {
    name: 'csp-headers',
    hooks: {
      'astro:build:done': ({ dir, logger }) => {
        const result = writeCspHeaders(fileURLToPath(dir));
        logger.info(
          `CSP for ${result.pages.length} pages: ${result.scriptHashes.length} script and ` +
            `${result.styleHashes.length} style hashes; the CSP line is ${result.cspLineLength}/${MAX_HEADERS_LINE_LENGTH} characters`,
        );
      },
    },
  };
}
