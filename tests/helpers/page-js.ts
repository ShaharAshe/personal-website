// The JavaScript a built page makes the browser download, for the 30KB-gzipped budget tests (CLAUDE.md quality
// target): theme-toggle.test.ts (homepage), resume-page.test.ts and not-found-page.test.ts.
//
// The Cloudflare Web Analytics beacon (Task 2.15) counts toward the budget: it's real JS every visitor downloads. The
// tests can't fetch it (no network in tests), so it counts as BEACON_GZIP_BYTES. Any other script from another
// origin fails the tests until its size is budgeted here too.

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { CF_BEACON_SRC } from '../../src/lib/analytics.ts';

/**
 * beacon.min.js, gzipped: 10,274 bytes when measured on 2026-11-13 (31,853 raw), rounded up to 11KB because
 * Cloudflare doesn't version-pin the file and it can grow.
 */
export const BEACON_GZIP_BYTES = 11 * 1024;

export interface PageScripts {
  /** The code of every inline or same-origin script (JSON-LD excluded: data the browser never runs). */
  local: string[];
  /** The src of every script from another origin. */
  external: string[];
}

export function pageScripts(html: string, dist: string): PageScripts {
  const local: string[] = [];
  const external: string[] = [];
  for (const [, attrs = '', text = ''] of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)) {
    if (attrs.includes('application/ld+json')) continue;
    const src = attrs.match(/\bsrc="([^"]+)"/)?.[1];
    if (!src) local.push(text);
    else if (/^(https?:)?\/\//.test(src)) external.push(src);
    else local.push(fs.readFileSync(path.join(dist, src), 'utf8'));
  }
  return { local, external };
}

/** Gzipped bytes of every script on the page, the beacon counted as BEACON_GZIP_BYTES. */
export function pageJsGzipBytes(html: string, dist: string): number {
  const { local, external } = pageScripts(html, dist);
  let bytes = local.reduce((sum, code) => sum + zlib.gzipSync(code).length, 0);
  for (const src of external) {
    if (src !== CF_BEACON_SRC) throw new Error(`an external script with no budgeted size: ${src}`);
    bytes += BEACON_GZIP_BYTES;
  }
  return bytes;
}
