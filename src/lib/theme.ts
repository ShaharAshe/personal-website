// Theme storage contract, shared by the no-flash script and the theme toggle
// (src/components/ThemeToggle.astro). This file is the only place the storage key and the accepted
// values are written. The toggle's logic lives here as pure functions so tests can run it without a
// browser; the component only wires them to the DOM.
//
// BaseLayout inlines themeInitScript in <head> (is:inline, before any stylesheet), so it runs before
// first paint: a saved "light" or "dark" sets <html data-theme>. Nothing saved, any other value, or
// blocked storage sets nothing, so global.css follows the OS setting (prefers-color-scheme). It can't
// be an imported module: that would defer it and bring the flash back. The CSP (Task 2.14) needs a
// hash of the script as it appears in the built HTML.

/** localStorage key holding the visitor's saved theme choice. Absent = follow the OS setting. */
export const THEME_STORAGE_KEY = 'theme';

/** The only values accepted from storage. Anything else is ignored. */
export const THEMES = ['light', 'dark'] as const;

export type Theme = (typeof THEMES)[number];

/** The no-flash script's text, built from the constants above at build time. */
export const themeInitScript = `(function () {
  try {
    const theme = localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});
    if (${JSON.stringify(THEMES)}.includes(theme)) document.documentElement.dataset.theme = theme;
  } catch {
    // Storage blocked: follow the OS setting.
  }
})();`;

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
