// The 404 game's controls (Task F.3), as pure functions shared by the loader (src/components/LostPageGame.astro) and
// the game (src/lib/game/play.ts), unit-tested in tests/game-engine.test.ts.
//
// Keys are heard on the whole page, like the Chrome dino ("press Space anywhere to play"), but only while focus is on
// the page itself or the game's canvas. On any link, button or field the key keeps its normal job, so Space or Enter
// on "Back to home" still follows the link. The game's own button is one of those: Space and Enter press it the
// normal way, and its click does what its label says.

import type { Phase } from './hud';

/** After a game over, Space, ArrowUp and taps wait this long before restarting, so a late jump doesn't start a round. */
export const RESTART_GRACE_MS = 400;

/**
 * What a press does:
 * - 'start': a new round;
 * - 'jump';
 * - 'continue': after a pause;
 * - 'ignore': the game's key, used up (no scrolling) but doing nothing (a jump key just after game over).
 */
export type Action = 'start' | 'jump' | 'continue' | 'ignore';

/** The action for a key, or null when the game leaves the key alone (no preventDefault). */
export function keyAction(key: string, phase: Phase, msSinceOver: number): Action | null {
  if (key === ' ' || key === 'ArrowUp') return tapAction(phase, msSinceOver);
  if (key === 'Enter') {
    if (phase === 'idle' || phase === 'over') return 'start';
    if (phase === 'paused') return 'continue';
  }
  return null;
}

/** A tap on the game does what Space does. */
export function tapAction(phase: Phase, msSinceOver: number): Action {
  switch (phase) {
    case 'idle':
      return 'start';
    case 'running':
      return 'jump';
    case 'paused':
      return 'continue';
    case 'over':
      return msSinceOver >= RESTART_GRACE_MS ? 'start' : 'ignore';
  }
}

/** The button's action for the phase it was pressed in (its label then): Continue goes on, the others start. */
export function buttonAction(phase: Phase): Action {
  return phase === 'paused' ? 'continue' : 'start';
}

interface KeyLike {
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  defaultPrevented: boolean;
}

/** The game hears a key only with focus on the page itself or on the canvas, and never a shortcut. */
export function isGameKeyEvent(event: KeyLike, active: Element | null, canvas: Element, body: Element | null): boolean {
  if (event.ctrlKey || event.metaKey || event.altKey || event.defaultPrevented) return false;
  return active === null || active === body || active === canvas || active.tagName === 'HTML';
}
