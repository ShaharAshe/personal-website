// Before the doodle e2e server starts (playwright.config.ts): fails with a hint when dist-doodle/ is missing.

import { requireDoodleBuild } from './doodle-build.ts';

requireDoodleBuild();
