// npm run screenshots:doodles: review screenshots of every doodle (tests/e2e/doodle-screenshots.ts) into
// screenshots/, at 375px and 1280px, light and dark, closed and with the bubble open. Each doodle is its own build
// (dist-doodle/), so this builds and photographs them in turn, then rebuilds the default one the e2e tests use.
// Local only, for review; the normal Hero is in npm run screenshots.

import { DEFAULT_DOODLE, buildDoodle, run } from './doodle-build.ts';
import { DOODLE_IDS } from '../../src/lib/doodles/doodles.ts';

for (const id of DOODLE_IDS) {
  buildDoodle(id);
  run('npx', ['playwright', 'test', '--project=doodle-screenshots']);
}
buildDoodle(DEFAULT_DOODLE);
