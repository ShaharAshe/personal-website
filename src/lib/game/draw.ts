// Draws one frame of the 404 game (Task F.3) on a 2D canvas: shapes only, no text and no images. Colors are the
// site's tokens (src/styles/global.css), read from the page, so the game follows the theme. No accent: accent means
// "clickable" (.claude/rules/ui.md). The character is --text with its folded corner in --text-muted, set apart by its
// shape and a crease line, not only by color; obstacles are --text-muted, the ground --border.
//
// The game's rules live in src/lib/game/engine.ts; this file only reads a state.

import { GROUND_Y, PLAYER_H, PLAYER_W, PLAYER_X, type Effects, type GameState, type Obstacle } from './engine';

export interface Palette {
  surface: string;
  text: string;
  muted: string;
  border: string;
}

export function readPalette(root: Element = document.documentElement): Palette {
  const style = getComputedStyle(root);
  const token = (name: string) => style.getPropertyValue(name).trim();
  return {
    surface: token('--surface'),
    text: token('--text'),
    muted: token('--text-muted'),
    border: token('--border'),
  };
}

const FOLD = 8;
const BODY_H = 26;

/** The lost page: a sheet with a folded top-right corner, two lines of writing and two legs. */
function drawPage(ctx: CanvasRenderingContext2D, p: Palette, x: number, top: number, stride: number) {
  const w = PLAYER_W;
  ctx.fillStyle = p.text;
  ctx.beginPath();
  ctx.moveTo(x, top);
  ctx.lineTo(x + w - FOLD, top);
  ctx.lineTo(x + w, top + FOLD);
  ctx.lineTo(x + w, top + BODY_H);
  ctx.lineTo(x, top + BODY_H);
  ctx.closePath();
  ctx.fill();

  // The fold: a flap in --text-muted with a crease in the surface color, so it reads as a shape in either theme.
  ctx.fillStyle = p.muted;
  ctx.beginPath();
  ctx.moveTo(x + w - FOLD, top);
  ctx.lineTo(x + w - FOLD, top + FOLD);
  ctx.lineTo(x + w, top + FOLD);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = p.surface;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Lines of writing.
  ctx.beginPath();
  for (const [y, len] of [
    [top + 13, 14],
    [top + 18, 11],
  ] as const) {
    ctx.moveTo(x + 5, y);
    ctx.lineTo(x + 5 + len, y);
  }
  ctx.stroke();

  // Legs: `stride` from -1 to 1 swings them; 0 is standing.
  const hip = top + BODY_H;
  const leg = PLAYER_H - BODY_H;
  ctx.strokeStyle = p.text;
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x + 8, hip);
  ctx.lineTo(x + 8 - 3 * stride, hip + leg);
  ctx.moveTo(x + 16, hip);
  ctx.lineTo(x + 16 + 3 * stride, hip + leg);
  ctx.stroke();
}

function drawObstacle(ctx: CanvasRenderingContext2D, p: Palette, o: Obstacle) {
  ctx.fillStyle = p.muted;
  const bottom = GROUND_Y;
  ctx.beginPath();
  switch (o.kind) {
    case 'blot': {
      // A round blot with two small drops.
      const r = o.h / 2;
      ctx.ellipse(o.x + o.w / 2, bottom - r, o.w / 2, r, 0, 0, Math.PI * 2);
      ctx.moveTo(o.x - 1, bottom - 2);
      ctx.arc(o.x - 3, bottom - 2, 2, 0, Math.PI * 2);
      ctx.moveTo(o.x + o.w + 4, bottom - 3);
      ctx.arc(o.x + o.w + 2.5, bottom - 3, 1.5, 0, Math.PI * 2);
      break;
    }
    case 'puddle':
      ctx.ellipse(o.x + o.w / 2, bottom - o.h / 2, o.w / 2, o.h / 2, 0, 0, Math.PI * 2);
      break;
    case 'stapler': {
      // Base, hinge at the back, and the top arm.
      const base = o.h * 0.3;
      ctx.rect(o.x, bottom - base, o.w, base);
      ctx.rect(o.x + o.w - 7, bottom - o.h, 7, o.h);
      ctx.rect(o.x + 1, bottom - o.h, o.w - 1, o.h * 0.35);
      break;
    }
  }
  ctx.fill();
}

export interface FrameOptions {
  /** Canvas pixels per world unit. */
  scale: number;
  effects: Effects;
  /** Offset of the whole picture, for the hit shake (0 when there's none). */
  shakeX?: number;
}

export function drawFrame(ctx: CanvasRenderingContext2D, state: GameState, p: Palette, opts: FrameOptions): void {
  const { scale, effects, shakeX = 0 } = opts;
  // The whole canvas, not just the world's width: a strip left unpainted would keep old frames (a smear).
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = p.surface;
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.translate(shakeX, 0);

  // Ground line, and dashes below it that slide past (still with reduced motion).
  ctx.strokeStyle = p.border;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, GROUND_Y);
  ctx.lineTo(ctx.canvas.width / scale, GROUND_Y);
  const spacing = 37;
  const offset = effects.movingBackground ? state.distance % spacing : 0;
  for (let x = -offset; x < ctx.canvas.width / scale; x += spacing) {
    ctx.moveTo(x, GROUND_Y + 7);
    ctx.lineTo(x + 8, GROUND_Y + 7);
    ctx.moveTo(x + 19, GROUND_Y + 13);
    ctx.lineTo(x + 23, GROUND_Y + 13);
  }
  ctx.stroke();

  for (const o of state.obstacles) drawObstacle(ctx, p, o);

  const running = !state.over && state.y === 0;
  const stride = effects.legs && running ? (Math.floor(state.distance / 14) % 2 === 0 ? 1 : -1) : state.y > 0 ? 0.6 : 0;
  drawPage(ctx, p, PLAYER_X, GROUND_Y - PLAYER_H - state.y, stride);
}
