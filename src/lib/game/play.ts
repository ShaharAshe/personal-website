// The 404 game in the browser (Task F.3): loaded only when the visitor asks to play (the dynamic import in
// src/components/LostPageGame.astro), never on any other page. Wires the engine (src/lib/game/engine.ts) and the
// drawing (src/lib/game/draw.ts) to the page:
// - a requestAnimationFrame loop with delta time (the engine makes it frame-rate independent);
// - keys on the whole page while focus is on the page itself or the canvas (src/lib/game/controls.ts): Space /
//   ArrowUp / a tap start, jump, go on after a pause, or play again (after a short pause); Enter starts or goes on;
// - pauses only when the tab is hidden or the window loses focus; the next press goes on. Focus moving within the
//   page never pauses, so a click on the button always does what its label said when it was pressed;
// - the colors follow the theme toggle and the OS theme; prefers-reduced-motion drops the decoration (effectsFor);
// - the score line is written only when its text changes, the game-over message only at game over (aria-live).
//
// Test hooks, which change nothing for visitors: data-game-state (idle | running | paused | over), data-player-y (the
// character's height in whole units, written only when it changes) and data-motion (full | reduced) on the canvas.

import { readBest, saveBest } from './best-score';
import { drawFrame, readPalette } from './draw';
import { WORLD_HEIGHT, clampWidth, createGame, effectsFor, jump, scoreFor, step, type GameState } from './engine';
import { buttonAction, isGameKeyEvent, keyAction, tapAction, type Action } from './controls';
import { buttonLabel, changedOnly, gameOverMessage, scoreLine, type Phase } from './hud';

const SHAKE_MS = 150;

const storage = () => localStorage;

export interface Game {
  /** Does an action. The loader calls it with 'start' for the press that loaded the game. */
  act(action: Action): void;
}

export function mount(root: HTMLElement): Game {
  const canvas = root.querySelector<HTMLCanvasElement>('[data-game-canvas]')!;
  const ctx = canvas.getContext('2d')!;
  const poster = root.querySelector<HTMLElement>('[data-game-poster]');
  const playButton = root.querySelector<HTMLButtonElement>('[data-game-play]');
  const scoreEl = root.querySelector<HTMLElement>('[data-game-score]');
  const statusEl = root.querySelector<HTMLElement>('[data-game-status]');

  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const osLight = matchMedia('(prefers-color-scheme: light)');

  let effects = effectsFor(reducedMotion.matches);
  let palette = readPalette();
  let best = readBest(storage);
  let phase: Phase = 'idle';
  let state: GameState | null = null;
  let scale = 1;
  let frame = 0;
  let last = 0;
  let overAt = 0;
  let shakeUntil = 0;

  const writeScore = changedOnly((text: string) => {
    if (scoreEl) scoreEl.textContent = text;
  });
  const writeY = changedOnly((y: number) => {
    canvas.dataset.playerY = String(y);
  });
  const setPhase = (next: Phase) => {
    phase = next;
    canvas.dataset.gameState = next;
    if (playButton) playButton.textContent = buttonLabel(next);
  };
  const setMotion = () => {
    effects = effectsFor(reducedMotion.matches);
    canvas.dataset.motion = reducedMotion.matches ? 'reduced' : 'full';
  };
  setMotion();

  const score = () => (state ? scoreFor(state.distance) : 0);

  function render(now = performance.now()) {
    if (!state) return;
    const shaking = effects.shake && now < shakeUntil;
    const shakeX = shaking ? Math.sin(now / 12) * 3 : 0;
    drawFrame(ctx, state, palette, { scale, effects, shakeX });
  }

  /** Fits the canvas's pixels to its box. The world is always WORLD_HEIGHT units tall; its width follows the box. */
  function resize() {
    const { clientWidth, clientHeight } = canvas;
    if (clientWidth === 0 || clientHeight === 0) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(clientWidth * dpr);
    canvas.height = Math.round(clientHeight * dpr);
    scale = canvas.height / WORLD_HEIGHT;
    if (state) state.width = clampWidth(canvas.width / scale);
    render();
  }

  function loop(now: number) {
    if (phase === 'running' && state) {
      const dt = last ? now - last : 0;
      last = now;
      const { hit } = step(state, dt);
      writeY(Math.round(state.y));
      writeScore(scoreLine(score(), Math.max(best, score())));
      if (hit) gameOver(now);
    }
    render(now);
    frame = phase === 'running' || (phase === 'over' && now < shakeUntil) ? requestAnimationFrame(loop) : 0;
  }

  function run() {
    last = 0;
    setPhase('running');
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(loop);
  }

  function start() {
    const seed = (Math.random() * 2 ** 32) >>> 0;
    state = createGame(seed, clampWidth(canvas.width / scale));
    if (poster) poster.hidden = true;
    if (statusEl) statusEl.textContent = '';
    writeY(0);
    writeScore(scoreLine(0, best));
    run();
  }

  function gameOver(now: number) {
    const final = score();
    const newBest = final > best;
    best = saveBest(final, best, storage);
    overAt = now;
    shakeUntil = effects.shake ? now + SHAKE_MS : 0;
    setPhase('over');
    writeScore(scoreLine(final, best));
    if (statusEl) statusEl.textContent = gameOverMessage(final, best, newBest);
  }

  function pause() {
    if (phase !== 'running') return;
    setPhase('paused');
    cancelAnimationFrame(frame);
    frame = 0;
  }

  function act(action: Action) {
    if (action === 'start') start();
    else if (action === 'continue' && phase === 'paused') run();
    else if (action === 'jump' && phase === 'running' && state) jump(state);
  }

  const sinceOver = () => performance.now() - overAt;

  document.addEventListener('keydown', (event) => {
    if (!isGameKeyEvent(event, document.activeElement, canvas, document.body)) return;
    const action = keyAction(event.key, phase, sinceOver());
    if (action === null) return;
    // Only the game's own keys: Space never scrolls the page while the game handles it.
    event.preventDefault();
    if (event.repeat) return;
    const fromPage = document.activeElement !== canvas;
    act(action);
    // Started from the page: the game takes focus, so the keyboard stays with it.
    if (fromPage && (action === 'start' || action === 'continue')) canvas.focus();
  });
  canvas.addEventListener('pointerdown', (event) => {
    // No preventDefault: it would keep the canvas from taking focus.
    if (event.isPrimary) act(tapAction(phase, sinceOver()));
  });

  // The button does what its label said when it was pressed: the phase is read on pointerdown, before anything a press
  // can set off (some browsers don't focus a clicked button). A keyboard press has no pointerdown: the phase now.
  let pressedIn: Phase | null = null;
  playButton?.addEventListener('pointerdown', () => {
    pressedIn = phase;
  });
  playButton?.addEventListener('click', () => {
    act(buttonAction(pressedIn ?? phase));
    pressedIn = null;
    canvas.focus();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pause();
  });
  window.addEventListener('blur', pause);

  // Theme: the toggle sets <html data-theme>; with nothing saved the page follows the OS.
  const repaint = () => {
    palette = readPalette();
    render();
  };
  new MutationObserver(repaint).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme'],
  });
  osLight.addEventListener('change', repaint);
  reducedMotion.addEventListener('change', () => {
    setMotion();
    render();
  });
  new ResizeObserver(resize).observe(canvas);
  resize();

  return { act };
}
