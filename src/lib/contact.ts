// Content for the homepage Contact section (src/components/Contact.astro): the LinkedIn and GitHub
// profile URLs from basics.profiles. The email is not here: it only reaches the page as parts, through
// getEmailParts() in EmailLink.astro and CopyEmail.astro.

import { socialIcon } from './hero.ts';
import type { PublicResume } from './resume.ts';

export interface ContactContent {
  linkedin: string;
  github: string;
}

export class ContactDataError extends Error {}

export function contactContent(resume: PublicResume): ContactContent {
  const find = (icon: 'linkedin' | 'github', name: string) => {
    const profile = resume.basics.profiles.find(({ network }) => socialIcon(network) === icon);
    if (!profile) {
      throw new ContactDataError(`The Contact section needs a ${name} profile in basics.profiles (resume.yaml).`);
    }
    return profile.url;
  };
  return { linkedin: find('linkedin', 'LinkedIn'), github: find('github', 'GitHub') };
}
