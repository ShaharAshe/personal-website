// Validates resume.yaml against src/data/resume.schema.ts. Exits non-zero with every problem listed.
//
// Usage: node scripts/cv/validate-resume.ts [path/to/resume.yaml]
// Default: src/data/resume.yaml

import fs from 'node:fs';
import yaml from 'js-yaml';
import { z } from 'astro/zod';
import { resumeSchema } from '../../src/data/resume.schema.ts';
import { RESUME_YAML } from './paths.js';

const inputPath = process.argv[2] || RESUME_YAML;

let data: unknown;
try {
  data = yaml.load(fs.readFileSync(inputPath, 'utf8'));
} catch (error) {
  console.error(`Could not read ${inputPath}:\n${error instanceof Error ? error.message : error}`);
  process.exit(1);
}

const result = resumeSchema.safeParse(data);
if (!result.success) {
  console.error(`${inputPath} does not match the resume schema:\n${z.prettifyError(result.error)}`);
  process.exit(1);
}

console.log(`${inputPath} matches the resume schema.`);
