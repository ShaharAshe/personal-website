// @ts-check
import { defineConfig, fontProviders } from 'astro/config';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

// https://docs.astro.build/en/reference/configuration-reference/
export default defineConfig({
  // Dev and preview match production, where wrangler.jsonc sets html_handling (design-doc §13.1).
  trailingSlash: 'never',
  integrations: [react()],
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
