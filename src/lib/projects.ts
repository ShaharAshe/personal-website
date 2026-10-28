// Typed, validated src/data/projects.json for components (task 2.8 and later). The file is generated
// by npm run projects (scripts/github/fetch-projects.ts) and gitignored, so it can be missing or stale:
// both fail the build with a message that says what to run, instead of rendering broken cards.
//
// The schema here is the single source of truth for the Project / PracticeLink / ProjectsData types;
// scripts/github/projects.ts imports them from this file.

import fs from 'node:fs';
import path from 'node:path';
import { z } from 'astro/zod';

// Resolved from the working directory (the project root for npm scripts, astro build and astro dev).
// import.meta.url can't be used: in a build it points at the bundled chunk, not this file.
export const PROJECTS_JSON = path.join(process.cwd(), 'src', 'data', 'projects.json');

const text = z.string().trim().min(1);

export const projectSchema = z.strictObject({
  name: text,
  title: text,
  // Featured/portfolio repos must have a description (fetch-projects.ts fails without one too).
  description: text,
  url: z.url(),
  homepage: z.string().nullable(),
  languages: z.array(text),
  topics: z.array(text),
  stars: z.number().int().nonnegative(),
  pushedAt: z.iso.datetime().nullable(),
});

// Practice repos are shown as links only, so they need less (and a description is optional).
export const practiceLinkSchema = z.strictObject({
  name: text,
  title: text,
  description: z.string().nullable(),
  url: z.url(),
  pushedAt: z.iso.datetime().nullable(),
});

export const projectsDataSchema = z.strictObject({
  featured: z.array(projectSchema),
  portfolio: z.array(projectSchema),
  practice: z.array(practiceLinkSchema),
});

export type Project = z.infer<typeof projectSchema>;
export type PracticeLink = z.infer<typeof practiceLinkSchema>;
export type ProjectsData = z.infer<typeof projectsDataSchema>;

export class ProjectsDataError extends Error {}

function load(filePath: string): ProjectsData {
  if (!fs.existsSync(filePath)) {
    throw new ProjectsDataError(`${filePath} not found: run npm run projects first.`);
  }
  let data: unknown;
  try {
    data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    throw new ProjectsDataError(
      `${filePath} is not valid JSON (run npm run projects again):\n${error instanceof Error ? error.message : error}`,
    );
  }
  const result = projectsDataSchema.safeParse(data);
  if (!result.success) {
    throw new ProjectsDataError(
      `${filePath} does not match the expected shape (stale? run npm run projects again):\n${z.prettifyError(result.error)}`,
    );
  }
  return result.data;
}

let cached: ProjectsData | undefined;

// The project tiers. Read and validated once per build for the default file.
export function getProjects(filePath: string = PROJECTS_JSON): ProjectsData {
  if (filePath !== PROJECTS_JSON) return load(filePath);
  cached ??= load(filePath);
  return cached;
}
