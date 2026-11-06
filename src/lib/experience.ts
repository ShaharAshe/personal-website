// Work content, taken from the validated resume so components hold no resume text. By default only highlights
// marked `featured: true`, for the homepage Experience section (src/components/Experience.astro, design-doc
// §5.1); a role with no featured highlights is still listed (company, position, dates), so the timeline has no
// gaps. /resume asks for { highlights: 'all' }.

import type { PublicResume } from './resume.ts';
import { dateParts, dateRange, type DateParts } from './resume-dates.ts';

export interface ExperienceRole {
  company: string;
  position: string;
  // text is the whole range as the PDF prints it, e.g. "Apr 2025 – Apr 2026".
  dates: DateParts & { text: string };
  highlights: string[];
}

export interface ExperienceOptions {
  highlights?: 'featured' | 'all';
}

export function experienceContent(
  resume: PublicResume,
  { highlights = 'featured' }: ExperienceOptions = {},
): ExperienceRole[] {
  return resume.work.map((job) => ({
    company: job.company,
    position: job.position,
    dates: { ...dateParts(job), text: dateRange(job) },
    highlights: job.highlights.filter((h) => highlights === 'all' || h.featured === true).map((h) => h.text),
  }));
}
