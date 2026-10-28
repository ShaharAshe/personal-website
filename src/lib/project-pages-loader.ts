// Decision logic for the `projects` content collection's loader (src/content.config.ts), kept out of
// that file so node:test can test it (content.config.ts imports `astro:content`, which only exists
// inside Astro).
//
// Why a wrapper around glob(): glob() warns on every build when the folder is missing (git doesn't
// keep empty folders) or empty, which is the case until the first project page (task 3.1). It also
// silently skips .mdx files when @astrojs/mdx isn't installed, so their frontmatter would never be
// checked. Revisit in task 3.1: once a page exists and @astrojs/mdx is added, plain glob() may do.

import fs from 'node:fs';
import path from 'node:path';

export const PAGE_EXTENSIONS = ['.md', '.mdx'];

// The integration that teaches Astro to read .mdx (added in task 3.1).
export const MDX_INTEGRATION = '@astrojs/mdx';

export class ProjectPagesError extends Error {}

// The page extensions Astro can read, given the names of the registered integrations: .md is built
// in; .mdx needs the @astrojs/mdx integration (task 3.1).
export function readableExtensions(integrationNames: string[]): string[] {
  const hasMdx = integrationNames.includes(MDX_INTEGRATION);
  return PAGE_EXTENSIONS.filter((extension) => extension !== '.mdx' || hasMdx);
}

// The project page files in `dir` (relative paths), or [] if the folder doesn't exist.
export function listProjectPageFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { recursive: true, encoding: 'utf8' })
    .filter((file) => PAGE_EXTENSIONS.includes(path.extname(file).toLowerCase()))
    .filter((file) => fs.statSync(path.join(dir, file)).isFile());
}

// 'empty': no pages, clear the collection without calling glob(). 'glob': hand off to glob().
// `readable` are the extensions Astro can read (".md" is built in; ".mdx" needs @astrojs/mdx).
export function projectPagesAction(files: string[], readable: string[]): 'empty' | 'glob' {
  const unreadable = files.filter((file) => !readable.includes(path.extname(file).toLowerCase()));
  if (unreadable.length > 0) {
    throw new ProjectPagesError(
      `Astro can't read these project pages: ${unreadable.join(', ')}. ` +
        'Add the @astrojs/mdx integration (task 3.1), or use a .md file.',
    );
  }
  return files.length === 0 ? 'empty' : 'glob';
}
