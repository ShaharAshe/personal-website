// Which font faces every page preloads (Task 3.4a, design-doc §9.3). /, /resume and the 404 all use these four
// above the fold in the regular style: Inter 400 (body, nav), 500 (buttons, links), 600 (the <h1>) and JetBrains
// Mono 400 (the Hero role line, dates, the game score). tests/e2e/fonts.spec.ts checks it on each page.
//
// Terminal view (F.7) never uses Inter (global.css points --font-inter at JetBrains Mono), and a preload nobody uses is
// a wasted download plus Chrome's "preloaded but not used" warning. So:
// - JetBrains Mono, used in both styles, is a plain <link rel="preload"> (from <Font preload> in BaseLayout);
// - the Inter preloads sit in an inert <template data-font-preloads> before the no-flash head script (nothing in a
//   template is fetched), and that script (themeInitScript, src/lib/theme-init.ts) moves them into <head> unless terminal
//   view is on. It's the first script in <head>, so they start at about the moment the preload scanner would have found
//   them. Without JS there are no Inter preloads; the CSS still loads the fonts.
// Every preload has crossorigin: fonts are fetched in CORS mode, and a preload without it is downloaded twice.
//
// The section entrance is a keyframes animation, not a transition, because of this (global.css, Task 3.4a): with the
// fonts loading earlier, Chrome sometimes had no before-change style for the entrance's transition.

/** Inter weights preloaded through the template (regular style only). */
export const INTER_PRELOAD_WEIGHTS = ['400', '500', '600'] as const;

/** JetBrains Mono weights preloaded with a plain link (every style). */
export const MONO_PRELOAD_WEIGHTS = ['400'] as const;

/** The attribute that marks the Inter preload template; themeInitScript looks it up. */
export const FONT_PRELOADS_ATTR = 'data-font-preloads';
