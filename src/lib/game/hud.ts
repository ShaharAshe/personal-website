// The 404 game's words around the canvas (Task F.3): the score line, the game-over message, and a writer that touches
// the page only when the text really changes (the loop runs every frame; the score changes about ten times a second).
// Plain words for every visitor. Imports nothing, so node:test can load it directly.

export type Phase = 'idle' | 'running' | 'paused' | 'over';

/** Short on purpose: it shares a line with the button at 375px, so it must never wrap and push the game down. */
export function scoreLine(score: number, best: number): string {
  return `Score ${score} · Best ${best}`;
}

/** The game's button says what a click does now; "Continue" is also how a paused game shows it's paused. */
export function buttonLabel(phase: Phase): string {
  return { idle: 'Play', running: 'Restart', paused: 'Continue', over: 'Play again' }[phase];
}

export function gameOverMessage(score: number, best: number, newBest: boolean): string {
  const result = newBest && score > 0 ? `New best: ${score}!` : `Score ${score}, best ${best}.`;
  return `Game over. ${result} Press Enter or tap to play again.`;
}

/** Wraps a write so it runs only when the value differs from the last one written. */
export function changedOnly<T>(write: (value: T) => void): (value: T) => void {
  let last: { value: T } | undefined;
  return (value) => {
    if (last && Object.is(last.value, value)) return;
    last = { value };
    write(value);
  };
}
