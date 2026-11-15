// The CTF chain's clue 2 (Task F.2): an X-Clue header on /favicon.ico. public/_headers is a static file, so the clue
// text (from src/lib/ctf.mts, the one source of truth) can't be written there; this integration appends the rule to
// dist/_headers after every `astro build`. astro.config.mjs registers it before cspHeaders(), so the CSP step's
// Cloudflare-limits check (2,000 characters per line, 100 rules) also covers this rule.
//
// Cloudflare applies every matching rule, so /favicon.ico still gets all the /* security headers too.
//
// .mts, like scripts/csp/csp.mts: astro.config.mjs loads it under plain Node.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AstroIntegration } from 'astro';
import { CTF_HEADER } from '../../src/lib/ctf.mts';

/** The _headers rule for the clue, as appended (a blank line first, so it reads as its own rule). */
export function ctfHeadersRule(): string {
  return `\n# The CTF chain's clue 2 (src/lib/ctf.mts, scripts/ctf/ctf-headers.mts).\n${CTF_HEADER.path}\n  ${CTF_HEADER.name}: ${CTF_HEADER.value}\n`;
}

/** headersText with the clue rule appended. Throws if a rule for the same path is already there. */
export function withCtfHeader(headersText: string): string {
  if (headersText.split(/\r?\n/).some((line) => line.trimEnd() === CTF_HEADER.path)) {
    throw new Error(`_headers already has a ${CTF_HEADER.path} rule: add the ${CTF_HEADER.name} header there instead`);
  }
  return `${headersText.replace(/\n*$/, '\n')}${ctfHeadersRule()}`;
}

/** Appends the clue rule to distDir/_headers. */
export function writeCtfHeader(distDir: string): void {
  const headersPath = path.join(distDir, '_headers');
  fs.writeFileSync(headersPath, withCtfHeader(fs.readFileSync(headersPath, 'utf8')));
}

export function ctfHeaders(): AstroIntegration {
  return {
    name: 'ctf-headers',
    hooks: {
      'astro:build:done': ({ dir, logger }) => {
        writeCtfHeader(fileURLToPath(dir));
        logger.info(`${CTF_HEADER.name} rule for ${CTF_HEADER.path} added to _headers`);
      },
    },
  };
}
