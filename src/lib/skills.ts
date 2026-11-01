// Content for the homepage Skills section (src/components/Skills.astro), taken from the validated resume so
// the component holds no resume text. Every category and item, in YAML order, with no levels of any kind
// (design-doc §5.1). Spoken languages (resume.languages) are not part of it: they go on /resume (Task 2.11).

import type { PublicResume } from './resume.ts';

export interface SkillCategory {
  category: string;
  items: string[];
}

export function skillsContent(resume: PublicResume): SkillCategory[] {
  return resume.skills.map(({ category, items }) => ({ category, items: [...items] }));
}
