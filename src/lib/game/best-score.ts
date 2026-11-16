// The 404 game's best score, kept in localStorage (Task F.3). Storage is passed as a getter, like saveTheme() in
// src/lib/theme.ts: merely reading `localStorage` can throw when the browser blocks storage. Every failure is ignored;
// the best score then just isn't remembered. Imports nothing, so node:test can load it directly.

export const BEST_SCORE_KEY = 'lost-page-best';

/** The saved best score, or 0 when nothing (or nothing valid) is saved or storage is blocked. */
export function readBest(getStorage: () => Pick<Storage, 'getItem'>): number {
  try {
    const value = Number(getStorage().getItem(BEST_SCORE_KEY));
    return Number.isSafeInteger(value) && value > 0 ? value : 0;
  } catch {
    return 0;
  }
}

/** Returns the new best. Writes only when the score beats the current best. */
export function saveBest(score: number, best: number, getStorage: () => Pick<Storage, 'setItem'>): number {
  if (score <= best) return best;
  try {
    getStorage().setItem(BEST_SCORE_KEY, String(score));
  } catch {
    // Storage blocked or full: the best counts for this visit only.
  }
  return score;
}
