// Schema for src/data/resume.yaml (JSON Resume structure + a `featured` flag on work highlights).
// Imports zod from `astro/zod`, not `astro:content`, so it also works outside the Astro build
// (scripts/cv/validate-resume.ts). src/content.config.ts reuses it.
//
// Objects are strict: an unknown field fails validation. If you add a field to the YAML, add it here.
// There is deliberately no `phone` field — the phone comes only from the CV_PHONE env var.

import { z } from 'astro/zod';

// "2025-04" (month) or "2021" (year). Must be a quoted string in the YAML.
const date = z
  .string({ error: 'must be a quoted string like "2025-04" or "2021"' })
  .regex(/^\d{4}(-(0[1-9]|1[0-2]))?$/, 'must look like "2025-04" or "2021"');

const text = z.string().trim().min(1);

const profile = z.strictObject({
  network: text,
  url: z.url(),
});

const basics = z.strictObject({
  name: text,
  label: text,
  email: z.email(),
  location: text,
  summary: text,
  profiles: z.array(profile).min(1),
});

const workHighlight = z.strictObject({
  text,
  featured: z.boolean().optional(),
});

const work = z.strictObject({
  company: text,
  position: text,
  startDate: date,
  endDate: date.optional(),
  highlights: z.array(workHighlight).min(1),
});

const project = z.strictObject({
  name: text,
  status: text.optional(),
  description: text,
  url: z.url().optional(),
});

const skill = z.strictObject({
  category: text,
  items: z.array(text).min(1),
});

const language = z.strictObject({
  language: text,
  fluency: text,
});

const education = z.strictObject({
  institution: text,
  degree: text,
  startDate: date,
  endDate: date.optional(),
  highlights: z.array(text).optional(),
});

export const resumeSchema = z.strictObject({
  basics,
  work: z.array(work).min(1),
  projects: z.array(project),
  skills: z.array(skill).min(1),
  languages: z.array(language).optional(),
  education: z.array(education).min(1),
});

export type Resume = z.infer<typeof resumeSchema>;
