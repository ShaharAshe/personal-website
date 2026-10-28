// Content collections. Only `projects` for now: deep-dive pages in src/content/projects/<repo-name>.md(x),
// matched to GitHub repos by file name (the entry id). The resume is not a collection: components read
// it through src/lib/resume.ts. The case-studies collection comes with task 3.2.

import { defineCollection } from 'astro:content';
import type { Loader } from 'astro/loaders';
import { glob } from 'astro/loaders';
import { projectPageSchema } from './data/project-page.schema.ts';
import { listProjectPageFiles, projectPagesAction, readableExtensions } from './lib/project-pages-loader.ts';

const PROJECTS_DIR = './src/content/projects';
const projectsGlob = glob({ base: PROJECTS_DIR, pattern: '**/*.{md,mdx}' });

// glob() without its warnings while there are no pages (see project-pages-loader.ts). With no pages,
// astro dev only picks up a newly added first page after a restart.
const projectPagesLoader: Loader = {
  name: 'project-pages',
  load: async (context) => {
    // .md is built in; .mdx needs the @astrojs/mdx integration (task 3.1).
    const readable = readableExtensions(context.config.integrations.map((integration) => integration.name));
    const action = projectPagesAction(listProjectPageFiles(PROJECTS_DIR), readable);
    if (action === 'empty') {
      context.store.clear();
      return;
    }
    return projectsGlob.load(context);
  },
};

const projects = defineCollection({
  loader: projectPagesLoader,
  schema: projectPageSchema,
});

export const collections = { projects };
