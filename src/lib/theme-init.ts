// The no-flash head script (themeInitScript): BaseLayout inlines it in <head> (is:inline, before any stylesheet), so it
// runs before first paint: a saved "light" or "dark" sets <html data-theme>, a saved "terminal" sets <html data-style>.
// Nothing saved, any other value, or blocked storage sets nothing, so global.css follows the OS setting
// (prefers-color-scheme) in the regular style. It can't be an imported module: that would defer it and bring the
// flash back. One script for both choices, so the CSP (Task 2.14) needs one hash of it as it appears in the built HTML.
//
// The same script starts the Inter preloads (Task 3.4a, src/lib/font-preloads.ts): unless terminal view is on, it moves
// the links in BaseLayout's inert <template data-font-preloads> into <head>, which starts their downloads.
//
// It also sets the tab icon (Task 2.21a, faviconFor() in src/lib/theme.ts): with a saved theme it points the SVG icon
// link at that theme's fixed variant, in terminal view at the ">_" icon (Task 2.21b); with no choice (or blocked
// storage) the link keeps /favicon.svg, which follows the browser's scheme like the site does. BaseLayout puts the icon
// links before this script so it can find them.
//
// Its own module (Task 2.22), imported only by BaseLayout: the template's JSON.stringify calls count as side effects,
// so the bundler kept a dead copy of it in the theme toggle's client script while it lived in src/lib/theme.ts.
// Components must not import this file (tests/theme-toggle.test.ts checks).

import { FONT_PRELOADS_ATTR } from './font-preloads.ts';
import { SITE_ICONS } from './seo.ts';
import { FAVICON_LINK_SELECTOR, STYLE_STORAGE_KEY, TERMINAL, THEME_STORAGE_KEY, THEMES } from './theme.ts';

/** The no-flash script's text, built from the constants in src/lib/theme.ts at build time. */
export const themeInitScript = `(function () {
  try {
    const theme = localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});
    if (${JSON.stringify(THEMES)}.includes(theme)) document.documentElement.dataset.theme = theme;
  } catch {
    // Storage blocked: follow the OS setting.
  }
  try {
    if (localStorage.getItem(${JSON.stringify(STYLE_STORAGE_KEY)}) === ${JSON.stringify(TERMINAL)}) {
      document.documentElement.dataset.style = ${JSON.stringify(TERMINAL)};
    }
  } catch {
    // Storage blocked: the regular style.
  }
  try {
    if (document.documentElement.dataset.style !== ${JSON.stringify(TERMINAL)}) {
      const preloads = document.querySelector(${JSON.stringify(`template[${FONT_PRELOADS_ATTR}]`)});
      if (preloads) document.head.append(preloads.content);
    }
  } catch {
    // No preloads: the CSS still loads the fonts.
  }
  try {
    const { theme, style } = document.documentElement.dataset;
    const icons = ${JSON.stringify(SITE_ICONS.svgFixed)};
    const icon = style === ${JSON.stringify(TERMINAL)} ? ${JSON.stringify(SITE_ICONS.svgTerminal)} :${JSON.stringify(THEMES)}.includes(theme) ? icons[theme] : null;
    if (icon) document.querySelector(${JSON.stringify(FAVICON_LINK_SELECTOR)}).setAttribute("href", icon);
  } catch {
    // No choice applied, or no icon link: /favicon.svg, which follows the browser.
  }
})();`;
