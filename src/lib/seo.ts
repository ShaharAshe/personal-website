// SEO helpers (Task 2.13): absolute URLs, the sitemap, robots.txt, the OG image and the Person JSON-LD.
// Pure functions, no fs. Every absolute URL comes from `site` in astro.config.mjs (Astro.site, or the endpoint's
// `site`), so moving to the custom domain is a one-line change there (plan.md Task 4.2).

import type { PublicResume } from './resume.ts';

export class MissingSiteError extends Error {}

/** The pages in sitemap.xml. tests/seo-dist.test.ts fails if a built page without noindex is missing. */
export const SITEMAP_PATHS = ['/', '/resume'] as const;

export const OG_IMAGE = { path: '/og-image.png', width: 1200, height: 630, type: 'image/png' } as const;

/**
 * An absolute URL on the site. The root keeps its "/" (`https://host/`); every other path loses its trailing
 * slashes, to match trailingSlash: 'never' and Cloudflare's drop-trailing-slash (design-doc §13.1).
 */
export function absoluteUrl(pathname: string, site: URL | string | undefined): string {
  if (!site) throw new MissingSiteError('`site` is not set in astro.config.mjs: absolute URLs need it.');
  const url = new URL(pathname, site);
  url.pathname = url.pathname.replace(/\/+$/, '') || '/';
  return url.href;
}

const escapeXml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function sitemapXml(site: URL | string | undefined): string {
  const urls = SITEMAP_PATHS.map((p) => `  <url>\n    <loc>${escapeXml(absoluteUrl(p, site))}</loc>\n  </url>`);
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls,
    '</urlset>',
    '',
  ].join('\n');
}

// Allows everything: a Disallow would stop crawlers from seeing the X-Robots-Tag noindex (public/_headers).
export function robotsTxt(site: URL | string | undefined): string {
  return ['User-agent: *', 'Allow: /', '', `Sitemap: ${absoluteUrl('/sitemap.xml', site)}`, ''].join('\n');
}

export function ogImageAlt(name: string, label: string): string {
  return `${name} – ${label}`;
}

/**
 * schema.org Person for the homepage, from resume.yaml. Never email, telephone or address: it's for search
 * results, not a contact-harvesting surface (plan.md). No worksFor: it would go stale between roles.
 */
export function personJsonLd(resume: PublicResume, site: URL | string | undefined): Record<string, unknown> {
  const { name, label, summary, profiles } = resume.basics;
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name,
    jobTitle: label,
    description: summary,
    url: absoluteUrl('/', site),
    sameAs: profiles.map(({ url }) => url),
    knowsAbout: [...new Set(resume.skills.flatMap(({ items }) => items))],
    alumniOf: resume.education.map(({ institution }) => ({ '@type': 'EducationalOrganization', name: institution })),
  };
}

/** JSON for a <script type="application/ld+json">, with "<" escaped so the text can never close the tag. */
export function jsonLdScript(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}
