// The doodle (Task F.4) the Hero renders: by date, or forced by the DOODLE environment variable for review and tests.
//
// DOODLE=<id> forces that doodle and DOODLE=none forces none. Only `npm run doodle:build` sets it, and its build goes
// to dist-doodle/, which is never deployed: the doodleGuard() integration (scripts/doodles/doodle-guard.mts) fails any
// build into dist/ while DOODLE is set, and tests/doodles-dist.test.ts checks the deploy reads dist/ only. So visitors
// can never reach a forced doodle. `astro dev` honors it too (it writes no files).

import { doodleForDate } from './dates.ts';
import { DOODLE_IDS, doodleById, type Doodle } from './doodles.ts';

export interface SelectOptions {
  now: Date;
  /** process.env.DOODLE */
  env: string | undefined;
  launchDate: string;
}

export function selectDoodle({ now, env, launchDate }: SelectOptions): Doodle | null {
  if (env === undefined || env === '') return doodleForDate(now, launchDate);
  if (env === 'none') return null;
  const forced = doodleById(env);
  if (!forced) throw new Error(`DOODLE="${env}" is not a doodle. Use one of: ${DOODLE_IDS.join(', ')}, or none.`);
  return forced;
}
