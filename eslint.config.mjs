// ESLint flat config: typescript-eslint + eslint-plugin-astro recommended rules. Formatting is
// Prettier's job (npm run format:check), not ESLint's.

import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';
import astro from 'eslint-plugin-astro';

export default defineConfig(
  { ignores: ['dist/', '.astro/', '.generated/', '.wrangler/'] },
  tseslint.configs.recommended,
  astro.configs.recommended,
  {
    // The resume generator scripts are CommonJS (package.json has no "type": "module").
    files: ['scripts/cv/*.js'],
    languageOptions: { sourceType: 'commonjs' },
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
);
