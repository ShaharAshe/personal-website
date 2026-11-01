// Content for the homepage Experience section (src/components/Experience.astro), taken from the validated
// resume so the component holds no resume text. Only highlights marked `featured: true` are shown on the
// homepage (design-doc §5.1); the full list is on /resume. A role with no featured highlights is still
// listed (company, position, dates), so the timeline has no gaps.

import type { PublicResume } from './resume.ts';
import { dateParts, dateRange, type DateParts } from './resume-dates.ts';

export interface ExperienceRole {
  company: string;
  position: string;
  // text is the whole range as the PDF prints it, e.g. "Apr 2025 – Apr 2026".
  dates: DateParts & { text: string };
  highlights: string[];
}

export function experienceContent(resume: PublicResume): ExperienceRole[] {
  return resume.work.map((job) => ({
    company: job.company,
    position: job.position,
    dates: { ...dateParts(job), text: dateRange(job) },
    highlights: job.highlights.filter((h) => h.featured === true).map((h) => h.text),
  }));
}
