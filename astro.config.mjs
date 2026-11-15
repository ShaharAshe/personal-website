// @ts-check
import { defineConfig, fontProviders } from 'astro/config';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import { cspHeaders } from './scripts/csp/csp.mts';
import { ctfHeaders } from './scripts/ctf/ctf-headers.mts';

// https://docs.astro.build/en/reference/configuration-reference/
export default defineConfig({
  // The one base URL: canonical, og:url, og:image, sitemap.xml and robots.txt all derive from it (src/lib/seo.ts).
  // Moving to the custom domain (plan.md Task 4.2) changes only this line. No trailing slash.
  site: 'https://personal-website.shaharasher.workers.dev',
  // Dev and preview match production, where wrangler.jsonc sets html_handling (design-doc §13.1).
  trailingSlash: 'never',
  // cspHeaders(): after every build, hashes the inline scripts and styles in dist/ and writes the
  // Content-Security-Policy into dist/_headers (scripts/csp/csp.mts, design-doc §12). ctfHeaders() runs first: it
  // appends the CTF chain's X-Clue rule (scripts/ctf/ctf-headers.mts), so the CSP step's limits check covers it.
  integrations: [react(), ctfHeaders(), cspHeaders()],
  // Self-hosted fonts (design-doc §9.3): downloaded from Fontsource at build time and served from the
  // site itself. <Font /> in BaseLayout emits the @font-face rules; global.css maps them to font-sans/mono.
  fonts: [
    {
      provider: fontProviders.fontsource(),
      name: 'Inter',
      cssVariable: '--font-inter',
      weights: [400, 500, 600],
      styles: ['normal'],
      subsets: ['latin'],
      fallbacks: ['sans-serif'],
    },
    {
      provider: fontProviders.fontsource(),
      name: 'JetBrains Mono',
      cssVariable: '--font-jetbrains-mono',
      weights: [400],
      styles: ['normal'],
      subsets: ['latin'],
      fallbacks: ['monospace'],
    },
  ],
  vite: {
    plugins: [tailwindcss()],
  },
});
