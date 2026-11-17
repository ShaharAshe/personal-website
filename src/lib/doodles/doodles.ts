// The doodles (Task F.4): a small picture drawn with the Hero's dots on a few special days, a link to the day's
// English Wikipedia article. Pure data, imports nothing: the build (src/components/Hero.astro via select.ts), the
// component (src/components/Doodle.astro) and the tests (tests/doodles.test.ts) all read it.
//
// The array order is the priority when two doodles fall on the same day (dates.ts): the launch day first, then the
// one-day doodles, then Hanukkah, because the 8-day one still shows on its other days. The only real overlap is New
// Year with a Hanukkah that runs into January (e.g. Dec 26 2024 – Jan 2 2025): New Year wins Dec 31 – Jan 2.
//
// Never: the owner's birthday (it reveals age) or national days (design-doc §10.3).
//
// Shapes are rows of characters, one per dot: '#' a dot, 'o' a dot the motion treats on its own (the marks on
// Turing's tape, the flames), '.' no dot. Drawn on a PITCH grid with the Hero's dot radius (DOT_R, as in Hero.astro's
// radial-gradient). Every link is https://en.wikipedia.org/wiki/... (tested).

export const DOODLE_IDS = [
  'launch',
  'new-year',
  'pi-day',
  'turing',
  'programmers-day',
  'halloween',
  'hanukkah',
] as const;

export type DoodleId = (typeof DOODLE_IDS)[number];

/** How the doodle moves on hover, focus or the first tap (motion.ts). */
export type MotionKind = 'liftoff' | 'burst' | 'spin' | 'tape' | 'type' | 'float' | 'flicker';

export interface Doodle {
  id: DoodleId;
  /** The link's accessible name. */
  label: string;
  /** The speech bubble's text: what the day is. */
  bubble: string;
  /** The English Wikipedia article the doodle links to. */
  wikipedia: string;
  shape: readonly string[];
  motion: MotionKind;
}

/** Distance between dot centers, in px. */
export const PITCH = 6;
/** Dot radius, in px: the Hero's background dots are radial-gradient(... 2px, transparent 2px). */
export const DOT_R = 2;
/** Empty space around the shape inside its box, in px, so small motions aren't cut off. */
export const PAD = 6;

export const DOODLES: readonly Doodle[] = [
  {
    id: 'launch',
    label: 'Launch day: "Hello, World!", read about it on Wikipedia',
    bubble: 'This site went live on this day. Hello, world!',
    wikipedia: 'https://en.wikipedia.org/wiki/%22Hello,_World!%22_program',
    motion: 'liftoff',
    shape: [
      '....#....',
      '...#.#...',
      '..#...#..',
      '..#.#.#..',
      '..#...#..',
      '..#...#..',
      '.##...##.',
      '#.#...#.#',
      '#.#####.#',
      '...o.o...',
      '....o....',
    ],
  },
  {
    id: 'new-year',
    label: "New Year's Day, read about it on Wikipedia",
    bubble: 'Happy New Year! January 1 starts the year in the Gregorian calendar.',
    wikipedia: 'https://en.wikipedia.org/wiki/New_Year%27s_Day',
    motion: 'burst',
    shape: [
      '......#......',
      '.#....#....#.',
      '..#.......#..',
      '...#..#..#...',
      '.....#.#.....',
      '##..#.#.#..##',
      '.....#.#.....',
      '...#..#..#...',
      '..#.......#..',
      '.#....#....#.',
      '......#......',
    ],
  },
  {
    id: 'pi-day',
    label: 'Pi Day, read about it on Wikipedia',
    bubble: 'Happy Pi Day! March 14, or 3/14, after the first digits of π.',
    wikipedia: 'https://en.wikipedia.org/wiki/Pi_Day',
    motion: 'spin',
    shape: [
      '.##########',
      '#..#....#..',
      '...#....#..',
      '...#....#..',
      '...#....#..',
      '...#....#..',
      '..#.....#..',
      '.#......##.',
    ],
  },
  {
    id: 'turing',
    label: "Alan Turing's birthday, read about it on Wikipedia",
    bubble: 'Alan Turing was born on June 23, 1912. His work laid the foundations of computer science.',
    wikipedia: 'https://en.wikipedia.org/wiki/Alan_Turing',
    motion: 'tape',
    shape: [
      '.....###.....',
      '......#......',
      '.............',
      '#############',
      '#...#...#...#',
      '#.o.#...#.o.#',
      '#.o.#...#.o.#',
      '#...#...#...#',
      '#############',
    ],
  },
  {
    id: 'programmers-day',
    label: 'Day of the Programmer, read about it on Wikipedia',
    bubble: 'Day of the Programmer: the 256th day of the year, because 256 = 2⁸.',
    wikipedia: 'https://en.wikipedia.org/wiki/Day_of_the_Programmer',
    motion: 'type',
    shape: [
      '.......#.....',
      '...#...#.#...',
      '..#....#..#..',
      '.#....#....#.',
      '#.....#.....#',
      '.#....#....#.',
      '..#..#....#..',
      '...#.#...#...',
      '.....#.......',
    ],
  },
  {
    id: 'halloween',
    label: 'Halloween, read about it on Wikipedia',
    bubble: 'Happy Halloween! October 31, the night of costumes and pumpkins.',
    wikipedia: 'https://en.wikipedia.org/wiki/Halloween',
    motion: 'float',
    shape: [
      '....#####....',
      '..##.....##..',
      '.#.........#.',
      '#...##.##...#',
      '#...##.##...#',
      '#...........#',
      '#...........#',
      '#...........#',
      '#..#..#..#..#',
      '.##.##.##.##.',
    ],
  },
  {
    id: 'hanukkah',
    label: 'Hanukkah, read about it on Wikipedia',
    bubble: 'Happy Hanukkah! The Jewish festival of lights: eight nights from 25 Kislev.',
    wikipedia: 'https://en.wikipedia.org/wiki/Hanukkah',
    motion: 'flicker',
    shape: [
      '........o........',
      'o.o.o.o.#.o.o.o.o',
      '#.#.#.#.#.#.#.#.#',
      '#.#.#.#.#.#.#.#.#',
      '#################',
      '........#........',
      '........#........',
      '........#........',
      '......#####......',
    ],
  },
];

export interface Dot {
  col: number;
  row: number;
  /** An 'o' in the shape: moved on its own by some motions. */
  accent: boolean;
}

/** Every dot of a shape, row by row. */
export function dotsOf(shape: readonly string[]): Dot[] {
  const dots: Dot[] = [];
  shape.forEach((line, row) => {
    [...line].forEach((ch, col) => {
      if (ch === '#' || ch === 'o') dots.push({ col, row, accent: ch === 'o' });
    });
  });
  return dots;
}

/** The shape's size in dots. */
export function shapeSize(shape: readonly string[]): { cols: number; rows: number } {
  return { cols: shape[0]?.length ?? 0, rows: shape.length };
}

/** The box the SVG draws: the shape plus PAD on every side, in px. */
export function boxSize(shape: readonly string[]): { width: number; height: number } {
  const { cols, rows } = shapeSize(shape);
  return { width: cols * PITCH + 2 * PAD, height: rows * PITCH + 2 * PAD };
}

/** A dot's center in the box, in px. */
export const dotCenter = ({ col, row }: Pick<Dot, 'col' | 'row'>) => ({
  x: PAD + col * PITCH + PITCH / 2,
  y: PAD + row * PITCH + PITCH / 2,
});

/** The inverse of dotCenter(): a drawn dot's place on the grid (play.ts reads the dots back from the SVG). */
export const gridOf = (x: number, y: number) => ({
  col: Math.round((x - PAD - PITCH / 2) / PITCH),
  row: Math.round((y - PAD - PITCH / 2) / PITCH),
});

export function doodleById(id: string): Doodle | undefined {
  return DOODLES.find((doodle) => doodle.id === id);
}
