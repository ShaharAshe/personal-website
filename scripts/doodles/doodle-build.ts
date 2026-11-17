// The doodle preview build (Task F.4), shared by the npm scripts in this folder:
// - npm run doodle:build -- <id>   (build.ts): dist-doodle/ with that doodle forced; CI and the e2e tests use it
// - npm run doodle -- <id>         (preview.ts): the same, then served at http://127.0.0.1:4323
// - npm run screenshots:doodles    (screenshots.ts): every doodle, built and photographed in turn
//
// Only `astro build`, into dist-doodle/: it reuses the main build's outputs (src/data/projects.json, .generated/) and
// regenerates neither the resume nor the projects, so it takes seconds. dist-doodle/ is never deployed (wrangler.jsonc
// serves ./dist; tests/doodles-dist.test.ts), and doodleGuard() fails a forced build into dist/.

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { DOODLE_IDS } from '../../src/lib/doodles/doodles.ts';
import { DOODLE_DIR } from './doodle-server.ts';

export const ROOT = path.join(import.meta.dirname, '..', '..');
/** The doodle the tests use when none is named. */
export const DEFAULT_DOODLE = 'pi-day';

/** The id from the command line, or the default. Exits with the list of ids on an unknown one. */
export function doodleArg(arg: string | undefined): string {
  const id = arg ?? DEFAULT_DOODLE;
  if (!(DOODLE_IDS as readonly string[]).includes(id)) {
    console.error(`Unknown doodle "${id}". Use one of: ${DOODLE_IDS.join(', ')}.`);
    process.exit(1);
  }
  return id;
}

/** Runs a command with the output shown, and exits if it fails. */
export function run(command: string, args: string[], env: NodeJS.ProcessEnv = {}): void {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    stdio: 'inherit',
    // npx is npx.cmd on Windows, which needs a shell.
    shell: process.platform === 'win32',
    env: { ...process.env, ...env },
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

/** Builds dist-doodle/ with this doodle. Needs the main build's outputs (npm run build) first. */
export function buildDoodle(id: string): void {
  const missing = ['dist', '.generated', path.join('src', 'data', 'projects.json')].filter(
    (p) => !fs.existsSync(path.join(ROOT, p)),
  );
  if (missing.length > 0) {
    console.error(`${missing.join(', ')} not found: run npm run build first (the doodle build reuses its outputs).`);
    process.exit(1);
  }
  run('npx', ['astro', 'build', '--outDir', DOODLE_DIR], { DOODLE: id });
}

/** Exits with a hint when dist-doodle/ hasn't been built. */
export function requireDoodleBuild(): void {
  if (!fs.existsSync(path.join(ROOT, DOODLE_DIR, 'index.html'))) {
    console.error(`${DOODLE_DIR}/ not found: run npm run doodle:build first.`);
    process.exit(1);
  }
}
