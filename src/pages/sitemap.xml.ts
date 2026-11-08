// /sitemap.xml: the indexable pages (SITEMAP_PATHS in src/lib/seo.ts) as absolute URLs from `site`. Prerendered to
// dist/sitemap.xml. A small endpoint instead of @astrojs/sitemap: no dependency, and the file is sitemap.xml.
import type { APIRoute } from 'astro';
import { sitemapXml } from '../lib/seo';

export const GET: APIRoute = ({ site }) =>
  new Response(sitemapXml(site), { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
