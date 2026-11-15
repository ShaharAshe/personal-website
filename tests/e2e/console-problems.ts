// Which console warnings and errors an e2e spec should fail on (tests/e2e/console-greeting.spec.ts). Its own file,
// without Playwright, so tests/console-problems.test.ts (node:test) can check the filter.
//
// Chromium logs a failed request as an error, "Failed to load resource: ...", with the request's URL as the message
// location. Two are expected and ignored, matched by that URL, never by the text alone:
// - a request the e2e fixture stops (the analytics beacon, isBlockedUrl);
// - on the 404 page only, the page's own URL (it answers 404 by design).
// Everything else is a problem, a missing CSS, font or script included.

import { isBlockedUrl } from './blocked-hosts.ts';

export interface ConsoleEntry {
  /** ConsoleMessage.type(): 'log', 'warning', 'error', ... */
  type: string;
  text: string;
  /** ConsoleMessage.location().url */
  url: string;
}

const FAILED_REQUEST = 'Failed to load resource:';

/** The warnings and errors that aren't expected, as "text (url)" lines. */
export function unexpectedConsoleProblems(
  entries: ConsoleEntry[],
  { expected404Url }: { expected404Url?: string } = {},
): string[] {
  return entries
    .filter(({ type }) => type === 'warning' || type === 'error')
    .filter(({ type, text, url }) => {
      if (type !== 'error' || !text.startsWith(FAILED_REQUEST)) return true;
      if (isBlockedUrl(url)) return false;
      return !(expected404Url !== undefined && url === expected404Url && /\b404\b/.test(text));
    })
    .map(({ text, url }) => `${text} (${url})`);
}
