// doodleGuard(): fails any build into dist/ (the folder that deploys) while DOODLE is set (Task F.4). A forced doodle
// is for review and tests only: `npm run doodle:build` writes it to dist-doodle/, which is never deployed. So no
// visitor can ever get a forced doodle, whatever env a CI step or a local shell happens to have.
//
// .mts because astro.config.mjs loads it under plain Node, like scripts/csp/csp.mts. Imports nothing from src/.

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AstroIntegration } from 'astro';

/** The folder `npm run doodle:build` writes to, next to dist/. */
export const DOODLE_OUT_DIR = 'dist-doodle';

/** Why this build must not run, or null when it may. */
export function doodleGuardProblem(outDir: string, root: string, doodle: string | undefined): string | null {
  if (doodle === undefined || doodle === '') return null;
  if (path.resolve(outDir) !== path.resolve(root, 'dist')) return null;
  return `DOODLE is set ("${doodle}") for a build into dist/, which deploys. Use npm run doodle:build -- ${doodle} (it writes ${DOODLE_OUT_DIR}/).`;
}

export function doodleGuard(): AstroIntegration {
  let outDir = '';
  let root = '';
  return {
    name: 'doodle-guard',
    hooks: {
      'astro:config:done': ({ config }) => {
        outDir = fileURLToPath(config.outDir);
        root = fileURLToPath(config.root);
      },
      'astro:build:start': () => {
        const problem = doodleGuardProblem(outDir, root, process.env.DOODLE);
        if (problem) throw new Error(problem);
      },
    },
  };
}
