// Typed, validated resume data for components, read from src/data/resume.yaml at build time and
// checked against src/data/resume.schema.ts. A schema error fails the build with the field and the
// problem (e.g. "→ at work[0].position").
//
// Email rule (design-doc §8.3): the email must never appear as plain text in the built HTML, where
// scrapers would harvest it. So getResume() returns basics *without* the email, and the only way to
// it is getEmailParts(), which hands out user and domain separately for the CopyEmail button to
// assemble in the browser. A component can't render the full address by accident.
// scripts/checks/no-email-in-dist.ts enforces it on the build output.
//
// There is no phone here: it isn't in resume.yaml or the schema, only in the CV_PHONE env var that
// create_cv.js reads for the PDF.

import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { z } from 'astro/zod';
import { resumeSchema } from '../data/resume.schema.ts';
import type { Resume } from '../data/resume.schema.ts';

// Same file as RESUME_YAML in scripts/cv/paths.js (a test checks they match). That module is
// CommonJS, which Vite can't load from src/, so the path is resolved here from the working directory
// (the project root for npm scripts, astro build and astro dev).
export const RESUME_YAML = path.join(process.cwd(), 'src', 'data', 'resume.yaml');

export type ResumeBasics = Omit<Resume['basics'], 'email'>;
export type PublicResume = Omit<Resume, 'basics'> & { basics: ResumeBasics };
export interface EmailParts {
  user: string;
  domain: string;
}

export class ResumeDataError extends Error {}

function load(filePath: string): Resume {
  let data: unknown;
  try {
    data = yaml.load(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    throw new ResumeDataError(`Could not read ${filePath}:\n${error instanceof Error ? error.message : error}`);
  }
  const result = resumeSchema.safeParse(data);
  if (!result.success) {
    throw new ResumeDataError(`${filePath} does not match the resume schema:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}

let cached: Resume | undefined;

function loadCached(filePath: string): Resume {
  if (filePath !== RESUME_YAML) return load(filePath);
  cached ??= load(filePath);
  return cached;
}

// The whole resume, with basics.email removed (see the email rule above).
export function getResume(filePath: string = RESUME_YAML): PublicResume {
  const { basics, ...rest } = loadCached(filePath);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { email, ...publicBasics } = basics;
  return { ...rest, basics: publicBasics };
}

// The email, split at the "@", only for assembling it in the browser (CopyEmail, task 2.9). Never
// join the parts in a component: the joined address would be plain text in the HTML.
export function getEmailParts(filePath: string = RESUME_YAML): EmailParts {
  const { email } = loadCached(filePath).basics;
  const at = email.lastIndexOf('@');
  return { user: email.slice(0, at), domain: email.slice(at + 1) };
}
