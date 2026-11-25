// Theme and style storage contract, shared by the no-flash script, the theme toggle
// (src/components/ThemeToggle.astro) and the terminal view switch (src/components/StyleToggle.astro, Task F.7). This
// file is the only place the storage keys and the accepted values are written. The toggles' logic lives here as pure
// functions so tests can run it without a browser; the components only wire them to the DOM.
//
// Two separate choices: the theme (light | dark) and the style (regular | terminal). Terminal view is always dark: its
// tokens in global.css win over every theme state, and the saved theme is kept for when terminal is turned off.
//
// The no-flash head script that applies a saved choice before first paint (themeInitScript) is built from these
// constants in its own module, src/lib/theme-init.ts, which only BaseLayout imports (Task 2.22): kept here, its
// template ended up in the toggle's client script. The tab icon (Task 2.21a, faviconFor()) is chosen the same way by
// that script on load and by the theme toggle on every click.

import { SITE_ICONS } from './seo.ts';

/** localStorage key holding the visitor's saved theme choice. Absent = follow the OS setting. */
export const THEME_STORAGE_KEY = 'theme';

/** The only values accepted from storage. Anything else is ignored. */
export const THEMES = ['light', 'dark'] as const;

export type Theme = (typeof THEMES)[number];

/** localStorage key holding the visitor's saved style choice (Task F.7). Absent = regular. */
export const STYLE_STORAGE_KEY = 'style';

/** The only style values accepted from storage. Only "terminal" changes anything: regular is the default look. */
export const STYLES = ['regular', 'terminal'] as const;

export type ViewStyle = (typeof STYLES)[number];

/** The one style that sets <html data-style>; global.css keys every terminal rule on it. */
export const TERMINAL: ViewStyle = 'terminal';

/** The SVG icon link in BaseLayout's <head>, the one whose href follows the choice (Task 2.21a). */
export const FAVICON_LINK_SELECTOR = `link[rel="icon"][type="${SITE_ICONS.svg.type}"]`;

/**
 * The SVG icon for what <html> says (Task 2.21a): terminal view gets its own ">_" icon (Task 2.21b), whatever the
 * theme; a chosen theme gets its variant; otherwise /favicon.svg, which follows the browser's scheme. The head script
 * (src/lib/theme-init.ts) makes the same choice (tests/theme-init.test.ts checks they agree).
 */
export function faviconFor(dataTheme: string | undefined, dataStyle: string | undefined): string {
  if (dataStyle === TERMINAL) return SITE_ICONS.svgTerminal;
  if (isTheme(dataTheme)) return SITE_ICONS.svgFixed[dataTheme];
  return SITE_ICONS.svg.path;
}

export function isTheme(value: unknown): value is Theme {
  return (THEMES as readonly unknown[]).includes(value);
}

/**
 * The theme on screen: <html data-theme> if it holds a valid theme, otherwise the OS one, matching
 * global.css (no data-theme and no light preference reported = dark).
 */
export function currentTheme(dataTheme: string | undefined, osPrefersLight: boolean): Theme {
  if (isTheme(dataTheme)) return dataTheme;
  return osPrefersLight ? 'light' : 'dark';
}

export function nextTheme(current: Theme): Theme {
  return current === 'light' ? 'dark' : 'light';
}

/** The toggle's aria-label: what a click will do, not the current state. */
export function toggleLabel(current: Theme): string {
  return `Switch to ${nextTheme(current)} theme`;
}

/**
 * Saves the choice. Storage is passed as a getter because merely reading `localStorage` can throw
 * when the browser blocks storage; that, and a throwing setItem, are ignored: the theme still applies
 * for this page view.
 */
export function saveTheme(theme: Theme, getStorage: () => Pick<Storage, 'setItem'>): void {
  try {
    getStorage().setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Storage blocked or full: the choice just isn't remembered.
  }
}

export function isStyle(value: unknown): value is ViewStyle {
  return (STYLES as readonly unknown[]).includes(value);
}

/** The style on screen: terminal only when <html data-style> says so, otherwise regular. */
export function currentStyle(dataStyle: string | undefined): ViewStyle {
  return dataStyle === TERMINAL ? TERMINAL : 'regular';
}

export function nextStyle(current: ViewStyle): ViewStyle {
  return current === TERMINAL ? 'regular' : TERMINAL;
}

/** Saves the style choice, like saveTheme: blocked storage or a throwing setItem are ignored. */
export function saveStyle(style: ViewStyle, getStorage: () => Pick<Storage, 'setItem'>): void {
  try {
    getStorage().setItem(STYLE_STORAGE_KEY, style);
  } catch {
    // Storage blocked or full: the choice just isn't remembered.
  }
}
