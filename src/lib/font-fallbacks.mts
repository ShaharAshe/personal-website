// The size-adjusted local fallbacks for the web fonts (Task 3.4a, design-doc §9.3): what the browser draws until Inter
// and JetBrains Mono arrive, scaled so the swap moves the page as little as possible.
//
// Why not Astro's own (optimizedFallbacks): Astro 7.4 knows only Arial, Arial Bold and Courier New, gives weight 600
// regular Arial (only 700+ gets a bold face), and sizes every weight by Inter 400's width. Linux and Android have no
// Arial or Courier New, and Chrome's local() doesn't follow fontconfig aliases, so there the fallback was unadjusted.
// So astro.config.mjs turns that off (optimizedFallbacks: false) and lists the family names below; the @font-face
// rules are hand-written in src/styles/global.css, and tests/font-fallbacks.test.ts recomputes every number from the
// metrics here and fails if global.css differs.
//
// The metrics are each font's own, read from the font files with @capsizecss/unpack (what Astro itself uses): the
// head/hhea/OS/2 values and Capsize's xWidthAvg (the average lowercase width, weighted by English letter frequency).
//
// .mts, not .ts: astro.config.mjs imports it (see scripts/csp/csp.mts). It imports nothing.

export interface FontMetrics {
  unitsPerEm: number;
  ascent: number;
  /** Negative, as in the font. */
  descent: number;
  lineGap: number;
  xWidthAvg: number;
  /** Where the numbers come from: the file and its version (name table). */
  source: string;
}

/** The web fonts, per weight: the woff2 files Astro downloads from Fontsource (dist/_astro/fonts/). */
export const WEB_FONT_METRICS = {
  'Inter 400': {
    unitsPerEm: 2048,
    ascent: 1984,
    descent: -494,
    lineGap: 0,
    xWidthAvg: 978,
    source: 'Fontsource Inter Regular, latin woff2, Version 4.001;git-66647c0bb',
  },
  'Inter 500': {
    unitsPerEm: 2048,
    ascent: 1984,
    descent: -494,
    lineGap: 0,
    xWidthAvg: 988,
    source: 'Fontsource Inter Medium, latin woff2, Version 4.001;git-66647c0bb',
  },
  'Inter 600': {
    unitsPerEm: 2048,
    ascent: 1984,
    descent: -494,
    lineGap: 0,
    xWidthAvg: 998,
    source: 'Fontsource Inter SemiBold, latin woff2, Version 4.001;git-66647c0bb',
  },
  'JetBrains Mono 400': {
    unitsPerEm: 1000,
    ascent: 1020,
    descent: -300,
    lineGap: 0,
    xWidthAvg: 600,
    source: 'Fontsource JetBrains Mono Regular, latin woff2, Version 2.211',
  },
} as const satisfies Record<string, FontMetrics>;

export type WebFont = keyof typeof WEB_FONT_METRICS;

/**
 * The local fonts. Liberation Sans and Liberation Mono are metric-compatible with Arial and Courier New (same numbers,
 * checked by the test), so each pair shares one @font-face.
 */
export const LOCAL_FONT_METRICS = {
  Arial: {
    unitsPerEm: 2048,
    ascent: 1854,
    descent: -434,
    lineGap: 67,
    xWidthAvg: 913,
    source: 'arial.ttf, Windows 11, Version 7.07',
  },
  'Arial Bold': {
    unitsPerEm: 2048,
    ascent: 1854,
    descent: -434,
    lineGap: 67,
    xWidthAvg: 983,
    source: 'arialbd.ttf, Windows 11, Version 7.07',
  },
  'Liberation Sans': {
    unitsPerEm: 2048,
    ascent: 1854,
    descent: -434,
    lineGap: 67,
    xWidthAvg: 913,
    source: 'LiberationSans-Regular.ttf, fonts-liberation (Playwright 1.64.1 image, as CI), Version 2.1.5',
  },
  'Liberation Sans Bold': {
    unitsPerEm: 2048,
    ascent: 1854,
    descent: -434,
    lineGap: 67,
    xWidthAvg: 983,
    source: 'LiberationSans-Bold.ttf, fonts-liberation (Playwright 1.64.1 image, as CI), Version 2.1.5',
  },
  Roboto: {
    unitsPerEm: 2048,
    ascent: 1900,
    descent: -500,
    lineGap: 0,
    xWidthAvg: 911,
    source: 'Roboto-Regular.ttf, googlefonts/roboto release v2.138, Version 2.138',
  },
  'Roboto Bold': {
    unitsPerEm: 2048,
    ascent: 1900,
    descent: -500,
    lineGap: 0,
    xWidthAvg: 927,
    source: 'Roboto-Bold.ttf, googlefonts/roboto release v2.138, Version 2.138',
  },
  'DejaVu Sans': {
    unitsPerEm: 2048,
    ascent: 1901,
    descent: -483,
    lineGap: 0,
    xWidthAvg: 1041,
    source: 'DejaVuSans.ttf, dejavu-fonts release 2.37, Version 2.37',
  },
  'DejaVu Sans Bold': {
    unitsPerEm: 2048,
    ascent: 1901,
    descent: -483,
    lineGap: 0,
    xWidthAvg: 1176,
    source: 'DejaVuSans-Bold.ttf, dejavu-fonts release 2.37, Version 2.37',
  },
  'Courier New': {
    unitsPerEm: 2048,
    ascent: 1705,
    descent: -615,
    lineGap: 0,
    xWidthAvg: 1229,
    source: 'cour.ttf, Windows 11, Version 6.95',
  },
  'Liberation Mono': {
    unitsPerEm: 2048,
    ascent: 1705,
    descent: -615,
    lineGap: 0,
    xWidthAvg: 1229,
    source: 'LiberationMono-Regular.ttf, fonts-liberation (Playwright 1.64.1 image, as CI), Version 2.1.5',
  },
  'DejaVu Sans Mono': {
    unitsPerEm: 2048,
    ascent: 1901,
    descent: -483,
    lineGap: 0,
    xWidthAvg: 1233,
    source: 'DejaVuSansMono.ttf, dejavu-fonts release 2.37, Version 2.37',
  },
  'Droid Sans Mono': {
    unitsPerEm: 2048,
    ascent: 1900,
    descent: -500,
    lineGap: 0,
    xWidthAvg: 1229,
    source: 'DroidSansMono.ttf, AOSP platform/frameworks/base data/fonts (main), Version 1.00 build 113',
  },
} as const satisfies Record<string, FontMetrics>;

export type LocalFont = keyof typeof LOCAL_FONT_METRICS;

/** One local font to try: the names local() matches (full name and PostScript name), and whose metrics size it. */
export interface LocalSource {
  names: readonly string[];
  metrics: LocalFont;
}

/** One fallback family: a name for font-family, and the local font each web-font weight falls back to. */
export interface FallbackFamily {
  name: string;
  faces: readonly { weight: 400 | 500 | 600; webFont: WebFont; local: LocalSource }[];
}

const ARIAL: LocalSource = { names: ['Arial', 'ArialMT', 'Liberation Sans', 'LiberationSans'], metrics: 'Arial' };
const ARIAL_BOLD: LocalSource = {
  names: ['Arial Bold', 'Arial-BoldMT', 'Liberation Sans Bold', 'LiberationSans-Bold'],
  metrics: 'Arial Bold',
};
const ROBOTO: LocalSource = { names: ['Roboto', 'Roboto-Regular'], metrics: 'Roboto' };
const ROBOTO_BOLD: LocalSource = { names: ['Roboto Bold', 'Roboto-Bold'], metrics: 'Roboto Bold' };
const DEJAVU: LocalSource = { names: ['DejaVu Sans', 'DejaVuSans'], metrics: 'DejaVu Sans' };
const DEJAVU_BOLD: LocalSource = { names: ['DejaVu Sans Bold', 'DejaVuSans-Bold'], metrics: 'DejaVu Sans Bold' };

/**
 * Inter 400 and 500 fall back to a regular face (Arial has no medium), 600 to a bold one, sized to Inter 600's width.
 *
 * 500 is sized to Inter 400's width, not Inter 500's own (1% wider): at Inter 500's, regular Arial/Liberation draws the
 * Hero's two buttons ("Download Resume", "View Projects", weight 500) 4px wider than Inter does, so at 375px the row
 * (340.7px of 343px with Inter) no longer fits and wraps until the swap: a layout shift of 0.106 (tests/e2e/fonts.spec.ts,
 * the forced swap). At Inter 400's width the row fits, as it did with Astro's own fallbacks.
 */
const interFaces = (regular: LocalSource, bold: LocalSource): FallbackFamily['faces'] => [
  { weight: 400, webFont: 'Inter 400', local: regular },
  { weight: 500, webFont: 'Inter 400', local: regular },
  { weight: 600, webFont: 'Inter 600', local: bold },
];

/**
 * Inter's fallbacks, in order: Arial or Liberation Sans (Windows, macOS, iOS, most Linux desktops, CI), Roboto
 * (Android, ChromeOS), DejaVu Sans (Linux without Liberation). A family whose local fonts are all missing is skipped.
 */
export const INTER_FALLBACKS: readonly FallbackFamily[] = [
  { name: 'Inter fallback', faces: interFaces(ARIAL, ARIAL_BOLD) },
  { name: 'Inter fallback Roboto', faces: interFaces(ROBOTO, ROBOTO_BOLD) },
  { name: 'Inter fallback DejaVu', faces: interFaces(DEJAVU, DEJAVU_BOLD) },
];

/** JetBrains Mono's fallbacks: Courier New or Liberation Mono, DejaVu Sans Mono (Linux), Droid Sans Mono (Android). */
export const MONO_FALLBACKS: readonly FallbackFamily[] = [
  {
    name: 'JetBrains Mono fallback',
    faces: [
      {
        weight: 400,
        webFont: 'JetBrains Mono 400',
        local: {
          names: ['Courier New', 'CourierNewPSMT', 'Liberation Mono', 'LiberationMono'],
          metrics: 'Courier New',
        },
      },
    ],
  },
  {
    name: 'JetBrains Mono fallback DejaVu',
    faces: [
      {
        weight: 400,
        webFont: 'JetBrains Mono 400',
        local: { names: ['DejaVu Sans Mono', 'DejaVuSansMono'], metrics: 'DejaVu Sans Mono' },
      },
    ],
  },
  {
    name: 'JetBrains Mono fallback Droid',
    faces: [
      {
        weight: 400,
        webFont: 'JetBrains Mono 400',
        local: { names: ['Droid Sans Mono', 'DroidSansMono'], metrics: 'Droid Sans Mono' },
      },
    ],
  },
];

/** The `fallbacks` lists for astro.config.mjs: the families above, then the generic family. */
export const INTER_FALLBACK_STACK = [...INTER_FALLBACKS.map(({ name }) => name), 'sans-serif'];
export const MONO_FALLBACK_STACK = [...MONO_FALLBACKS.map(({ name }) => name), 'monospace'];

/** The descriptors of one fallback @font-face, as written in global.css. */
export interface FallbackFaceDescriptors {
  'font-family': string;
  src: string;
  'font-weight': string;
  'font-style': 'normal';
  'font-display': 'swap';
  'size-adjust': string;
  'ascent-override': string;
  'descent-override': string;
  'line-gap-override': string;
}

// Capsize's rounding (createFontStack.ts): 4 decimals of the percentage.
const percent = (value: number) => `${Number.parseFloat((value * 100).toFixed(4))}%`;

/**
 * One fallback face, by Capsize's createFontStack formula (the one Astro uses): size-adjust scales the local font to the
 * web font's average width, and the overrides then give it the web font's ascent, descent and line gap.
 */
export function fallbackFace(
  family: string,
  weight: number,
  web: FontMetrics,
  local: FontMetrics,
  names: readonly string[],
): FallbackFaceDescriptors {
  const sizeAdjust = web.xWidthAvg / web.unitsPerEm / (local.xWidthAvg / local.unitsPerEm);
  const em = web.unitsPerEm * sizeAdjust;
  return {
    // Single quotes, as Prettier writes them in global.css.
    'font-family': `'${family}'`,
    src: names.map((name) => `local('${name}')`).join(', '),
    'font-weight': String(weight),
    'font-style': 'normal',
    'font-display': 'swap',
    'size-adjust': percent(sizeAdjust),
    'ascent-override': percent(web.ascent / em),
    'descent-override': percent(Math.abs(web.descent) / em),
    'line-gap-override': percent(web.lineGap / em),
  };
}

/** Every fallback face global.css must declare, in order. */
export function allFallbackFaces(): FallbackFaceDescriptors[] {
  return [...INTER_FALLBACKS, ...MONO_FALLBACKS].flatMap(({ name, faces }) =>
    faces.map(({ weight, webFont, local }) =>
      fallbackFace(name, weight, WEB_FONT_METRICS[webFont], LOCAL_FONT_METRICS[local.metrics], local.names),
    ),
  );
}
