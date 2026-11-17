// The doodle animations (Task F.4) as Web Animations keyframes: pure, unit-tested in tests/doodles.test.ts, run by
// play.ts. Only `transform` and `opacity` (design-doc §10.3). Every animation lasts MOTION_MS, plays once, and starts
// and ends with the dots in their place at full opacity. Opacity dips at most twice per second, far from flashing.
//
// Never with prefers-reduced-motion: the loader in Doodle.astro doesn't even load play.ts then.

import { PITCH, type Dot, type MotionKind } from './doodles.ts';

export const MOTION_MS = 2400;

// A type, not an interface, so it's assignable to the DOM's Keyframe (an index signature) in play.ts.
export type Frame = {
  offset: number;
  transform: string;
  opacity: number;
  easing?: string;
};

/** What to animate: the whole shape (its <g>), and each dot (null = that dot stays still). */
export interface MotionPlan {
  shape: Frame[] | null;
  dots: (Frame[] | null)[];
}

const t = (x: number, y: number) => `translate(${round(x)}px, ${round(y)}px)`;
const round = (n: number) => Math.round(n * 100) / 100 || 0;
const EASE = 'ease-out';

/** Frames for a whole-shape motion, every dot still. */
const shapeOnly = (dots: Dot[], frames: Frame[]): MotionPlan => ({ shape: frames, dots: dots.map(() => null) });

export function motionPlan(kind: MotionKind, dots: Dot[], cols: number, rows: number): MotionPlan {
  const cx = (cols - 1) / 2;
  const cy = (rows - 1) / 2;
  switch (kind) {
    // The rocket rumbles, lifts off out of the box, and comes back from below.
    case 'liftoff':
      return shapeOnly(dots, [
        { offset: 0, transform: t(0, 0), opacity: 1 },
        { offset: 0.1, transform: t(0, 1), opacity: 1, easing: 'ease-in' },
        { offset: 0.45, transform: t(0, -48), opacity: 0 },
        { offset: 0.55, transform: t(0, 24), opacity: 0, easing: EASE },
        { offset: 1, transform: t(0, 0), opacity: 1 },
      ]);

    // A firework: every dot flies out from the center and fades, then fades back in at its place.
    case 'burst':
      return {
        shape: null,
        dots: dots.map(({ col, row }) => {
          const dx = (col - cx) * PITCH * 0.6;
          const dy = (row - cy) * PITCH * 0.6;
          return [
            { offset: 0, transform: t(0, 0), opacity: 1, easing: EASE },
            { offset: 0.3, transform: t(dx, dy), opacity: 0.8, easing: EASE },
            { offset: 0.5, transform: t(dx * 1.5, dy * 1.5), opacity: 0 },
            { offset: 0.6, transform: t(0, 0), opacity: 0, easing: EASE },
            { offset: 1, transform: t(0, 0), opacity: 1 },
          ];
        }),
      };

    // π turns one full circle, a little smaller while it turns so its corners stay in the box.
    case 'spin':
      return shapeOnly(dots, [
        { offset: 0, transform: 'rotate(0deg) scale(1)', opacity: 1, easing: 'ease-in' },
        { offset: 0.2, transform: 'rotate(45deg) scale(0.8)', opacity: 1 },
        { offset: 0.75, transform: 'rotate(315deg) scale(0.8)', opacity: 1, easing: EASE },
        { offset: 1, transform: 'rotate(360deg) scale(1)', opacity: 1 },
      ]);

    // Turing's tape: the marks step one cell left, twice, under the still head (a mark that leaves the tape fades),
    // then fade back in at their places.
    case 'tape': {
      const CELL = 4;
      return {
        shape: null,
        dots: dots.map(({ col, accent }) => {
          if (!accent) return null;
          const on = (steps: number) => (col - steps * CELL >= 1 ? 1 : 0);
          return [
            { offset: 0, transform: t(0, 0), opacity: 1 },
            { offset: 0.15, transform: t(0, 0), opacity: 1, easing: EASE },
            { offset: 0.3, transform: t(-CELL * PITCH, 0), opacity: on(1) },
            { offset: 0.5, transform: t(-CELL * PITCH, 0), opacity: on(1), easing: EASE },
            { offset: 0.65, transform: t(-2 * CELL * PITCH, 0), opacity: on(2) },
            { offset: 0.8, transform: t(-2 * CELL * PITCH, 0), opacity: on(2) },
            { offset: 0.85, transform: t(-2 * CELL * PITCH, 0), opacity: 0 },
            { offset: 0.86, transform: t(0, 0), opacity: 0 },
            { offset: 1, transform: t(0, 0), opacity: 1 },
          ];
        }),
      };
    }

    // `</>` fades out, then types back in, column by column.
    case 'type':
      return {
        shape: null,
        dots: dots.map(({ col }) => {
          const at = 0.25 + 0.55 * (cols > 1 ? col / (cols - 1) : 0);
          return [
            { offset: 0, transform: t(0, 0), opacity: 1 },
            { offset: 0.15, transform: t(0, 0), opacity: 0 },
            { offset: at, transform: t(0, 0), opacity: 0 },
            { offset: at + 0.04, transform: t(0, 0), opacity: 1 },
            { offset: 1, transform: t(0, 0), opacity: 1 },
          ];
        }),
      };

    // The ghost bobs up twice, half see-through, then settles.
    case 'float':
      return shapeOnly(dots, [
        { offset: 0, transform: t(0, 0), opacity: 1, easing: 'ease-in-out' },
        { offset: 0.25, transform: t(0, -5), opacity: 0.6, easing: 'ease-in-out' },
        { offset: 0.5, transform: t(0, 0), opacity: 0.6, easing: 'ease-in-out' },
        { offset: 0.75, transform: t(0, -5), opacity: 0.6, easing: 'ease-in-out' },
        { offset: 1, transform: t(0, 0), opacity: 1 },
      ]);

    // The flames flicker gently, twice, each candle a little after the one before.
    case 'flicker':
      return {
        shape: null,
        dots: dots.map(({ col, accent }) => {
          if (!accent) return null;
          const p = (col % 4) * 0.04;
          return [
            { offset: 0, transform: 'scale(1)', opacity: 1, easing: 'ease-in-out' },
            { offset: 0.15 + p, transform: 'scale(0.7)', opacity: 0.5, easing: 'ease-in-out' },
            { offset: 0.35 + p, transform: 'scale(1.15)', opacity: 1, easing: 'ease-in-out' },
            { offset: 0.55 + p, transform: 'scale(0.75)', opacity: 0.55, easing: 'ease-in-out' },
            { offset: 0.75 + p, transform: 'scale(1.1)', opacity: 1, easing: 'ease-in-out' },
            { offset: 1, transform: 'scale(1)', opacity: 1 },
          ];
        }),
      };
  }
}
