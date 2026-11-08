// /robots.txt: allows everything, plus the absolute sitemap URL from `site`. An endpoint, not public/robots.txt, so
// the host is written in one place (astro.config.mjs). Never Disallow: crawlers must see the X-Robots-Tag noindex.
import type { APIRoute } from 'astro';
import { robotsTxt } from '../lib/seo';

export const GET: APIRoute = ({ site }) =>
  new Response(robotsTxt(site), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
