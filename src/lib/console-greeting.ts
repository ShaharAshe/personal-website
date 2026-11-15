// The DevTools console greeting (Task F.1, plan.md "Fun (after MVP)"): an ASCII "SA", an "Open to work" line with
// the LinkedIn link (only while OPEN_TO_WORK in src/lib/site.ts is true), a line with the GitHub profile link, and
// after a blank line the CTF chain's clue 1 (Task F.2: CTF_CONSOLE_LINE from src/lib/ctf.mts, in either flag state).
//
// BaseLayout inlines consoleGreetingScript() at the end of <body> on every page except /resume (which passes
// consoleGreeting={false}: the Fun features never touch the resume). It's one console.log call: no warning, no
// error, no self-XSS notice. Inline, it runs once per page load, in dev and production alike, and the cspHeaders()
// build step (scripts/csp/csp.mts) adds its hash to script-src like every other inline script.
//
// Inputs are only the resume's profiles (LinkedIn and GitHub URLs). Never the email (getResume() doesn't have it) and
// never the phone.

import { githubProfileUrl } from './projects-section.ts';

/** figlet's "standard" font, "SA". No trailing spaces: the console would show them as nothing anyway. */
export const SA_ASCII = [
  ' ____    _',
  '/ ___|  / \\',
  '\\___ \\ / _ \\',
  ' ___) / ___ \\',
  '|____/_/   \\_\\',
] as const;

/**
 * The "Open to work" badge colours. Hex values here, not tokens from global.css: the console can't read the page's
 * CSS variables. White text on its own green background is ~5.1:1 whatever the DevTools theme; no single text colour
 * reaches 4.5:1 on both a white and a #282828 console (tests/console-greeting.test.ts).
 */
export const OPEN_TO_WORK_BADGE = { background: '#1a7f37', color: '#ffffff' } as const;

/** Only properties Firefox's console also supports for %c. */
export const OPEN_TO_WORK_STYLE =
  `background:${OPEN_TO_WORK_BADGE.background};color:${OPEN_TO_WORK_BADGE.color};` +
  'padding:1px 6px;border-radius:3px;font-weight:bold';

export const OPEN_TO_WORK_LABEL = 'Open to work';

export interface Profile {
  network: string;
  url: string;
}

export interface ConsoleGreeting {
  /** The console.log format string (its first argument). */
  format: string;
  /** One CSS string per %c in format. */
  styles: string[];
}

/** The LinkedIn profile URL (network matched case-insensitively, like githubProfileUrl), or null. */
export function linkedinProfileUrl(profiles: Profile[]): string | null {
  return profiles.find(({ network }) => network.trim().toLowerCase() === 'linkedin')?.url ?? null;
}

/** The greeting's text and %c styles. Throws if resume.yaml has no LinkedIn or GitHub profile (fails the build). */
export function consoleGreeting({
  profiles,
  openToWork,
  clue,
}: {
  profiles: Profile[];
  openToWork: boolean;
  /** The last line, after a blank one: the CTF chain's clue 1 (CTF_CONSOLE_LINE). */
  clue: string;
}): ConsoleGreeting {
  const linkedin = linkedinProfileUrl(profiles);
  const github = githubProfileUrl(profiles);
  if (!linkedin || !github) throw new Error('console greeting: resume.yaml needs a LinkedIn and a GitHub profile');
  const lines: string[] = [...SA_ASCII, ''];
  if (openToWork) lines.push(`%c ${OPEN_TO_WORK_LABEL} %c LinkedIn: ${linkedin}`);
  lines.push(`GitHub: ${github}`, '', clue);
  return { format: lines.join('\n'), styles: openToWork ? [OPEN_TO_WORK_STYLE, ''] : [] };
}

/**
 * The inline script: one console.log call. Every "<" becomes the JS escape < (same string value), so nothing in
 * the text can close the <script> element.
 */
export function consoleGreetingScript({ format, styles }: ConsoleGreeting): string {
  const args = [format, ...styles].map((arg) => JSON.stringify(arg)).join(', ');
  return `console.log(${args});`.replace(/</g, '\\u003c');
}
