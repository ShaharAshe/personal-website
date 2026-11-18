// Section entrance (Task 3.4, design-doc §10.1): the homepage sections after the Hero fade and slide in once, the
// first time they scroll into view. The pure rules live here so tests can run them without a browser; the script in
// src/components/SectionReveal.astro wires them to an IntersectionObserver.
//
// The HTML carries a bare `data-reveal` on each section, which no CSS rule matches: without JS, in print and with
// reduced motion every section is simply visible. Only the script sets the attribute's value, and global.css styles
// `pending` (hidden) and `done` (fading in) inside `@media screen and (prefers-reduced-motion: no-preference)`.

/** The attribute on each section that gets the entrance. */
export const REVEAL_ATTR = 'data-reveal';

/** Its values, set only by the script. */
export const PENDING = 'pending';
export const DONE = 'done';

/**
 * The observer's options. threshold 0 with a bottom margin, not a ratio: a section taller than the screen (Projects on
 * a phone) never gets past a high ratio. A section reveals once its top is 10% of the screen above the bottom edge.
 */
export const OBSERVER_OPTIONS: IntersectionObserverInit = { rootMargin: '0px 0px -10% 0px', threshold: 0 };

/**
 * Whether a section starts hidden when the script runs: only when it's entirely below the screen. A section already
 * on screen (or above it) stays as it is, so nothing the visitor can see ever blinks out. The target of the URL's hash
 * (/#contact opened directly) never starts hidden: the browser may jump to it before or after the script runs.
 */
export function startsPending({ top, id }: { top: number; id: string }, viewportHeight: number, hash: string): boolean {
  if (id && hash === `#${id}`) return false;
  return top >= viewportHeight;
}

/**
 * Whether a pending section reveals now: when it scrolls into view, or when it's already above the screen. The second
 * case is the observer's first report coming after a jump such as /#contact went past the section. The observer only
 * reports crossings, so a section a later jump skips over stays hidden while it's off screen, and enters when the
 * visitor scrolls back to it.
 */
export function revealsNow({ isIntersecting, bottom }: { isIntersecting: boolean; bottom: number }): boolean {
  return isIntersecting || bottom <= 0;
}
