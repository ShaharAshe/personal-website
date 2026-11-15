// /.well-known/ctf.txt: the last clue of the CTF chain (Task F.2), ROT13 text from src/lib/ctf.mts. Not linked from
// any page and not in sitemap.xml (sitemapXml() lists pages explicitly). Astro routes .well-known/ (the one dot
// folder it doesn't skip), and Cloudflare static assets serve it like any other file.
import type { APIRoute } from 'astro';
import { CTF_WELL_KNOWN } from '../../lib/ctf.mts';

export const GET: APIRoute = () =>
  new Response(CTF_WELL_KNOWN.body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
