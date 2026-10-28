// The site files under dist/ that the "never in the site" checks scan (no-phone-in-dist.ts,
// no-email-in-dist.ts). The resume .pdf/.docx are not site files: they're supposed to contain the
// phone and email.

import fs from 'node:fs';
import path from 'node:path';

export const SITE_EXTENSIONS = new Set(['.html', '.js', '.json', '.xml', '.txt']);

// Paths relative to distDir.
export function listSiteFiles(distDir: string): string[] {
  return fs
    .readdirSync(distDir, { recursive: true, encoding: 'utf8' })
    .filter((file) => SITE_EXTENSIONS.has(path.extname(file).toLowerCase()))
    .filter((file) => fs.statSync(path.join(distDir, file)).isFile());
}
