// Site-wide switches that aren't resume content (resume content lives only in src/data/resume.yaml).

/**
 * Whether the DevTools console greeting (src/lib/console-greeting.ts, Task F.1) prints its "Open to work" line with
 * the LinkedIn link. false drops only that line; the rest of the greeting stays the same.
 */
export const OPEN_TO_WORK = true;

/**
 * The day the site launches on its own domain (YYYY-MM-DD), set at Task 4.2. The launch-day doodle (Task F.4,
 * src/lib/doodles/) shows on that date every year; empty means it's off. Any other value fails the build.
 */
export const LAUNCH_DATE = '';
