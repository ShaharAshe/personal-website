// npm run doodle -- <id>: builds dist-doodle/ with that doodle forced, then serves it at http://127.0.0.1:4323 with the
// real headers (wrangler dev). Ctrl+C stops it. See doodle-build.ts.

import { buildDoodle, doodleArg, run } from './doodle-build.ts';
import { DOODLE_PORT, doodleServerCommand } from './doodle-server.ts';

const id = doodleArg(process.argv[2]);
buildDoodle(id);
console.log(`\nThe ${id} doodle: http://127.0.0.1:${DOODLE_PORT}\n`);
const [command = 'npx', ...args] = doodleServerCommand().split(' ');
run(command, args, { WRANGLER_SEND_METRICS: 'false' });
