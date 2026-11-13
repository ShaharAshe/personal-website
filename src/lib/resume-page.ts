// Content for the /resume page (src/pages/resume.astro), taken from the validated resume so the page holds no
// resume text. The same content as the PDF (scripts/cv/create_cv.js); the spoken-languages row reads as it does
// there. The email isn't here: it only reaches the page as parts, through CopyEmail. There is no phone anywhere in
// the resume data.

import { experienceContent, type ExperienceRole } from './experience.ts';
import { heroContent, type SocialLink } from './hero.ts';
import type { PublicResume } from './resume.ts';
import { dateParts, dateRange, type DateParts } from './resume-dates.ts';
import { skillsContent, type SkillCategory } from './skills.ts';

export const SPOKEN_LANGUAGES_LABEL = 'Spoken Languages';

export interface ResumeProjectLink {
  url: string;
  text: string;
  /** The accessible name: names the project, so it differs from the profile's "GitHub" link (WCAG 2.4.9). It
   * contains the visible text (WCAG 2.5.3), like the homepage cards' "<title> on GitHub". */
  label: string;
  icon: 'github' | 'external';
}

export interface ResumeProject {
  name: string;
  status: string | null;
  description: string;
  link: ResumeProjectLink | null;
}

export interface ResumeEducation {
  degree: string;
  institution: string;
  dates: DateParts & { text: string };
  highlights: string[];
}

export interface ResumePageContent {
  meta: { title: string; description: string };
  name: string;
  title: string;
  summary: string;
  socials: SocialLink[];
  experience: ExperienceRole[];
  projects: ResumeProject[];
  skills: SkillCategory[];
  education: ResumeEducation[];
}

// A copy of displayUrl in scripts/cv/format.js, which is CommonJS and can't be loaded from src/ (same as
// src/lib/resume-dates.ts). tests/resume-page.test.ts runs both on the same inputs.
// "https://www.linkedin.com/in/x" -> "linkedin.com/in/x"
export function displayUrl(url: string): string {
  return url
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/$/, '');
}

// "GitHub" with the GitHub icon (.claude/rules/ui.md). The schema allows any URL, and a link elsewhere must not be
// labeled GitHub, so it shows its short URL with the marker for links that leave the site.
function projectLink(url: string, projectName: string): ResumeProjectLink {
  if (new URL(url).hostname === 'github.com') {
    return { url, text: 'GitHub', label: `${projectName} on GitHub`, icon: 'github' };
  }
  const text = displayUrl(url);
  return { url, text, label: `${projectName} at ${text}`, icon: 'external' };
}

export function resumePageContent(resume: PublicResume): ResumePageContent {
  const { name, title, socials } = heroContent(resume);
  const { label, summary } = resume.basics;
  const languages = resume.languages ?? [];

  return {
    meta: { title: `${name} – Resume`, description: `Resume of ${name}, ${label}.` },
    name,
    title,
    summary,
    socials,
    experience: experienceContent(resume, { highlights: 'all' }),
    projects: resume.projects.map(({ name: projectName, status, description, url }) => ({
      name: projectName,
      status: status ?? null,
      description,
      link: url ? projectLink(url, projectName) : null,
    })),
    skills: [
      ...skillsContent(resume),
      ...(languages.length > 0
        ? [
            {
              category: SPOKEN_LANGUAGES_LABEL,
              items: languages.map(({ language, fluency }) => `${language} (${fluency})`),
            },
          ]
        : []),
    ],
    education: resume.education.map((entry) => ({
      degree: entry.degree,
      institution: entry.institution,
      dates: { ...dateParts(entry), text: dateRange(entry) },
      highlights: entry.highlights ?? [],
    })),
  };
}
