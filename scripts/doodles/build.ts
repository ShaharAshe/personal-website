// npm run doodle:build -- <id>: builds dist-doodle/ with that doodle forced (default pi-day). See doodle-build.ts.

import { buildDoodle, doodleArg } from './doodle-build.ts';

buildDoodle(doodleArg(process.argv[2]));
