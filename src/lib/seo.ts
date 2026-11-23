// SEO helpers (Task 2.13): absolute URLs, the sitemap, robots.txt, the OG image and the Person JSON-LD.
// Pure functions, no fs. Every absolute URL comes from `site` in astro.config.mjs (Astro.site, or the endpoint's
// `site`), so moving to the custom domain is a one-line change there (plan.md Task 4.2).

import type { PublicResume } from './resume.ts';

export class MissingSiteError extends Error {}

/** The pages in sitemap.xml. tests/seo-dist.test.ts fails if a built page without noindex is missing. */
export const SITEMAP_PATHS = ['/', '/resume'] as const;

export const OG_IMAGE = { path: '/og-image.png', width: 1200, height: 630, type: 'image/png' } as const;

/**
 * The site icons (Task 2.13a), rendered by npm run og (scripts/og/render-icons.ts) into public/. The favicon.ico holds
 * one PNG per size (Google's search results need a multiple of 48); the apple-touch-icon is opaque, since iOS fills
 * transparent pixels with black.
 *
 * The SVG (Task 2.21) switches its colors with prefers-color-scheme inside the file, so with no saved choice it follows
 * the browser, like the site does. BaseLayout links the ICO first, then the SVG with its type: Chrome, Edge and Firefox
 * should take the SVG, and Safari, which has no SVG favicons, the ICO
 * (evilmartians.com/chronicles/how-to-favicon-in-2021-six-files-that-fit-most-needs).
 *
 * The ICO link says sizes="32x32" (favicon.linkSizes), not the file's real 16/32/48 (favicon.sizes), as in that recipe.
 * Chromium scores each candidate by how well its declared sizes match the 16px tab icon at every scale: a declared
 * exact 16x16 makes the ICO look ideal, so it can beat the SVG; "32x32" ties it at best, so the SVG keeps the tab
 * (Task 2.21a: in Brave and Edge the tab stayed on the ICO with the full list). Never "any" on the ICO either: that
 * made Chrome pick the ICO.
 *
 * svgFixed (Task 2.21a): the SVG in one scheme only. When the visitor has chosen a theme, the head script and the
 * theme toggle point the SVG link's href at one of these (faviconFor() in src/lib/theme.ts). They aren't
 * linked on their own.
 *
 * svgTerminal (Task 2.21b): terminal view's own icon, ">_" in the terminal tokens, set the same way. It's kept apart
 * from svgFixed, whose keys are the two themes.
 */
export const SITE_ICONS = {
  favicon: { path: '/favicon.ico', sizes: [16, 32, 48], linkSizes: [32] },
  svg: { path: '/favicon.svg', type: 'image/svg+xml' },
  svgFixed: { dark: '/favicon-dark.svg', light: '/favicon-light.svg' },
  svgTerminal: '/favicon-terminal.svg',
  appleTouch: { path: '/apple-touch-icon.png', size: 180 },
} as const;

/** A <link sizes> value: "16x16 32x32 48x48". */
export function iconSizesAttr(sizes: readonly number[]): string {
  return sizes.map((s) => `${s}x${s}`).join(' ');
}

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
