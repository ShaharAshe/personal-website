// How the doodle preview build (Task F.4, dist-doodle/) is served: by playwright.config.ts for the e2e tests and the
// doodle screenshots, and by npm run doodle. Its own module with no import.meta, because Playwright loads its config
// as CommonJS. tests/doodles-dist.test.ts checks DOODLE_DIR matches DOODLE_OUT_DIR in doodle-guard.mts.

/** The doodle preview build's folder, next to dist/. Never deployed (wrangler.jsonc serves ./dist). */
export const DOODLE_DIR = 'dist-doodle';

/** wrangler dev's port for dist-doodle/ (the main build's is 4322, playwright.config.ts). */
export const DOODLE_PORT = 4323;

/** wrangler dev serving dist-doodle/ with its _headers (the real CSP), like the main build's. */
export const doodleServerCommand = (port = DOODLE_PORT) =>
  `npx wrangler dev --assets ${DOODLE_DIR} --port ${port} --ip 127.0.0.1 --show-interactive-dev-session=false`;
