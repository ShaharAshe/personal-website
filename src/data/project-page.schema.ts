// Frontmatter schema for project deep-dive pages, src/content/projects/<repo-name>.md(x). The page is
// matched to its GitHub repo by file name; the repo data (languages, stars, links) comes from
// projects.json, and these fields override or add to it on the card and the page (design-doc §5.2,
// §6.4; .claude/rules/github-projects.md). Imports zod from `astro/zod`, not `astro:content`, so
// node:test can test it. src/content.config.ts uses it.
//
// Strict: an unknown field fails the build. If you add a field, add it here.

import { z } from 'astro/zod';

const text = z.string().trim().min(1);

export const projectPageSchema = z.strictObject({
  // Display name instead of the prettified repo name.
  title: text.optional(),
  // A longer description than the GitHub one.
  description: text.optional(),
  // e.g. "In progress".
  status: text.optional(),
  // e.g. "2 developers".
  team: text.optional(),
});

export type ProjectPage = z.infer<typeof projectPageSchema>;
