// Theme storage contract, shared by the no-flash script and the theme toggle (Task 2.3). This file is
// the only place the storage key and the accepted values are written.
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
