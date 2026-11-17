// Plays the doodle's animation once (Task F.4). Its own /_astro/ file: the loader in src/components/Doodle.astro
// imports it on the first hover, focus or tap, never with prefers-reduced-motion.
//
// Web Animations (element.animate) on the SVG's <g> and dots: only transform and opacity (motion.ts). The CSP's
// style-src doesn't apply to the Web Animations API, so no style attribute is ever written.
//
// Test hooks that change nothing for visitors: data-doodle-state ("idle" | "playing") and data-doodle-plays (a count).

import { MOTION_MS, motionPlan } from './motion.ts';
import { gridOf, type Dot, type MotionKind } from './doodles.ts';

export function play(root: HTMLElement): void {
  if (root.dataset.doodleState === 'playing') return;
  const shape = root.querySelector<SVGGElement>('[data-doodle-shape]');
  if (!shape) return;
  const circles = [...shape.querySelectorAll<SVGCircleElement>('circle')];
  const dots: Dot[] = circles.map((c) => ({
    ...gridOf(c.cx.baseVal.value, c.cy.baseVal.value),
    accent: c.hasAttribute('data-accent'),
  }));
  const plan = motionPlan(
    root.dataset.doodleMotion as MotionKind,
    dots,
    Number(root.dataset.doodleCols),
    Number(root.dataset.doodleRows),
  );

  root.dataset.doodleState = 'playing';
  root.dataset.doodlePlays = String(Number(root.dataset.doodlePlays ?? 0) + 1);
  const timing = { duration: MOTION_MS, iterations: 1 };
  const animations: Animation[] = [];
  if (plan.shape) animations.push(shape.animate(plan.shape, timing));
  plan.dots.forEach((frames, i) => {
    const circle = circles[i];
    if (frames && circle) animations.push(circle.animate(frames, timing));
  });
  Promise.allSettled(animations.map((a) => a.finished)).then(() => {
    root.dataset.doodleState = 'idle';
  });
}
