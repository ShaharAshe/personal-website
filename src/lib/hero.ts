// Content for the homepage Hero (src/components/Hero.astro), taken from the validated resume so the
// component holds no resume text. The schema guarantees every field used here is present.

import type { PublicResume } from './resume.ts';

export type SocialIcon = 'github' | 'linkedin';

export interface SocialLink {
  network: string;
  url: string;
  icon: SocialIcon;
}

export interface HeroContent {
  name: string;
  title: string;
  tagline: string;
  socials: SocialLink[];
}

export class UnknownNetworkError extends Error {}

const ICONS: Record<string, SocialIcon> = { github: 'github', linkedin: 'linkedin' };

// The inline-SVG icon for a basics.profiles network. An unknown network fails the build, so a new
// profile never renders as an empty, unlabeled link.
export function socialIcon(network: string): SocialIcon {
  const icon = ICONS[network.trim().toLowerCase()];
  if (!icon) {
    throw new UnknownNetworkError(
      `No Hero icon for profile network "${network}" in resume.yaml. Add one in src/lib/hero.ts and Hero.astro.`,
    );
  }
  return icon;
}

export function heroContent(resume: PublicResume): HeroContent {
  const { name, label, tagline, profiles } = resume.basics;
  return {
    name,
    title: label,
    tagline,
    socials: profiles.map(({ network, url }) => ({ network, url, icon: socialIcon(network) })),
  };
}
