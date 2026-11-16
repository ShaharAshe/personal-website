// The 404 game's rules (Task F.3): physics, collisions, speed, spawning and score. Pure and DOM-free, so
// tests/game-engine.test.ts runs all of it without a browser; src/lib/game/draw.ts draws a state and
// src/lib/game/play.ts runs the loop. Imports nothing, so node:test can load it directly.
//
// Units: the world is WORLD_HEIGHT (114) units tall and `width` units wide (about 228 at 2:1, 342 at 3:1: the canvas's
// aspect ratio). Heights are measured up from the ground, x from the world's left edge. Time is in seconds, speed in
// units/second. The character is about 28% of the box's height; speeds are set so it moves about 370 px/s on a
// 229 px tall box, whatever the box's size.
//
// Frame-rate independence: step() advances the world in fixed SUBSTEP_S slices and keeps the remainder for the next
// call, so a 60 Hz and a 144 Hz screen reach the same state at the same moment. A long gap (a hidden tab, a stalled
// frame) counts as at most MAX_FRAME_MS.
//
// step() mutates the state it's given (no garbage per frame) and returns what happened.

export const WORLD_HEIGHT = 114;
/** The world's width range. A little wider than 2:1 and 3:1, so a box whose border makes it 3.02:1 still fills. */
export const MIN_WIDTH = 216;
export const MAX_WIDTH = 360;

/** Distance from the world's top edge to the ground line, for drawing. */
export const GROUND_Y = 96;

/** The character's box: left edge, size (legs included). */
export const PLAYER_X = 36;
export const PLAYER_W = 24;
export const PLAYER_H = 32;

/** How much of the character's box doesn't count for collisions, per side: near misses feel fair. */
export const PLAYER_INSET = 3;

/** Pull down, in units/s². With JUMP_VELOCITY: peak ≈ 58 units (1.8 times the character), 0.6 s in the air. */
export const GRAVITY = 1290;
export const JUMP_VELOCITY = 387;
/** A jump pressed this long before landing still happens, on landing. */
export const JUMP_BUFFER_S = 0.12;

export const START_SPEED = 186;
export const MAX_SPEED = 371;
/** Speed gained per second of play. Reaches MAX_SPEED after about 43 s. */
export const ACCELERATION = 4.3;

/** Shortest gap between two obstacles, in seconds at the speed when the second one appears: always jumpable. */
export const MIN_GAP_S = 0.85;
/** Longest gap at START_SPEED; it shrinks towards MIN_GAP_S + 0.45 s at MAX_SPEED. */
export const MAX_GAP_S = 1.9;

/** The first obstacle appears up to this far beyond the right edge. */
const FIRST_SPREAD = 100;

/** Every round's first obstacle reaches a character that never jumps within this time, for any seed and width. */
export const FIRST_HIT_MAX_MS = 3000;

export const SUBSTEP_S = 1 / 240;
export const MAX_FRAME_MS = 100;

/** Distance units per point: about 10 points a second at the start. */
export const UNITS_PER_POINT = 18;

export type ObstacleKind = 'blot' | 'puddle' | 'stapler';
export const OBSTACLE_KINDS: readonly ObstacleKind[] = ['blot', 'puddle', 'stapler'];

export interface Obstacle {
  kind: ObstacleKind;
  /** Left edge. */
  x: number;
  w: number;
  h: number;
}

export interface GameState {
  over: boolean;
  /** World width in units; the next obstacle appears at this x. */
  width: number;
  /** Seconds of play. */
  time: number;
  /** Units run. */
  distance: number;
  speed: number;
  /** The character's height above the ground, and its vertical speed (up is positive). */
  y: number;
  vy: number;
  jumpBuffer: number;
  obstacles: Obstacle[];
  /** Obstacles created so far this round. */
  spawned: number;
  /** Distance to run before the next obstacle appears. */
  untilNext: number;
  /** The random generator's state (mulberry32). */
  rng: number;
  /** Time not yet simulated, below one SUBSTEP_S. */
  pending: number;
}

/** A box standing on the ground or above it: left edge, bottom height, size. */
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** mulberry32: a small seedable generator. Returns a number in [0, 1) and advances the state. */
export function nextRandom(state: Pick<GameState, 'rng'>): number {
  state.rng = (state.rng + 0x6d2b79f5) >>> 0;
  let t = state.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export const clampWidth = (width: number) => Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, width));

export function createGame(seed: number, width: number = MAX_WIDTH): GameState {
  const state: GameState = {
    over: false,
    width: clampWidth(width),
    time: 0,
    distance: 0,
    speed: START_SPEED,
    y: 0,
    vy: 0,
    jumpBuffer: 0,
    obstacles: [],
    spawned: 0,
    untilNext: 0,
    rng: seed >>> 0,
    pending: 0,
  };
  state.untilNext = nextRandom(state) * FIRST_SPREAD;
  return state;
}

export const isGrounded = (state: GameState) => state.y === 0 && state.vy === 0;

/** A jump press: jumps now from the ground, or on landing if it comes just before. */
export function jump(state: GameState): void {
  if (state.over) return;
  if (isGrounded(state)) state.vy = JUMP_VELOCITY;
  else state.jumpBuffer = JUMP_BUFFER_S;
}

export function speedAt(time: number): number {
  return Math.min(MAX_SPEED, START_SPEED + ACCELERATION * time);
}

export const scoreFor = (distance: number) => Math.floor(distance / UNITS_PER_POINT);

/** The gap before the next obstacle, in seconds: random, shorter on average as the speed rises. */
export function gapSeconds(random: number, speed: number): number {
  const t = (speed - START_SPEED) / (MAX_SPEED - START_SPEED);
  const max = MAX_GAP_S - 0.6 * t;
  return MIN_GAP_S + random * (max - MIN_GAP_S);
}

/** A new obstacle's shape. The first one of a round is always a small ink blot. */
export function makeObstacle(state: GameState, first: boolean): Obstacle {
  const kind = first ? 'blot' : OBSTACLE_KINDS[Math.floor(nextRandom(state) * OBSTACLE_KINDS.length)]!;
  const r = nextRandom(state);
  switch (kind) {
    case 'blot':
      return { kind, x: 0, w: 16 + r * 6, h: 12 + r * 4 };
    case 'puddle':
      return { kind, x: 0, w: 44 + r * 16, h: 5 };
    case 'stapler':
      return { kind, x: 0, w: 26 + r * 6, h: 28 + r * 6 };
  }
}

export function playerBox(state: GameState): Box {
  return {
    x: PLAYER_X + PLAYER_INSET,
    y: state.y,
    w: PLAYER_W - 2 * PLAYER_INSET,
    h: PLAYER_H - PLAYER_INSET,
  };
}

/** Blots are round, so their edges don't count; puddles and staplers count in full. */
export function obstacleBox(o: Obstacle): Box {
  const inset = o.kind === 'blot' ? 2 : 0;
  return { x: o.x + inset, y: 0, w: o.w - 2 * inset, h: o.h - inset };
}

export function collides(a: Box, b: Box): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function tick(state: GameState, dt: number): boolean {
  state.time += dt;
  state.speed = speedAt(state.time);
  const dx = state.speed * dt;
  state.distance += dx;

  // Vertical: semi-implicit Euler, landing exactly on the ground.
  if (state.vy !== 0 || state.y > 0) {
    state.vy -= GRAVITY * dt;
    state.y += state.vy * dt;
    if (state.y <= 0) {
      state.y = 0;
      state.vy = 0;
    }
  }
  if (state.jumpBuffer > 0) {
    if (isGrounded(state)) {
      state.vy = JUMP_VELOCITY;
      state.jumpBuffer = 0;
    } else {
      state.jumpBuffer = Math.max(0, state.jumpBuffer - dt);
    }
  }

  for (const o of state.obstacles) o.x -= dx;
  if (state.obstacles.length > 0 && state.obstacles[0]!.x + state.obstacles[0]!.w < 0) state.obstacles.shift();

  state.untilNext -= dx;
  if (state.untilNext <= 0) {
    const o = makeObstacle(state, state.spawned === 0);
    state.spawned += 1;
    // untilNext is now zero or a little below: keep the exact spacing.
    o.x = state.width + state.untilNext;
    state.obstacles.push(o);
    state.untilNext += o.w + gapSeconds(nextRandom(state), state.speed) * state.speed;
  }

  const player = playerBox(state);
  return state.obstacles.some((o) => collides(player, obstacleBox(o)));
}

export interface StepResult {
  /** The character ran into an obstacle during this step: the round is over. */
  hit: boolean;
}

/** Advances the world by one frame's time (milliseconds). Does nothing once the round is over. */
export function step(state: GameState, dtMs: number): StepResult {
  if (state.over) return { hit: false };
  state.pending += Math.min(Math.max(dtMs, 0), MAX_FRAME_MS) / 1000;
  // The epsilon keeps float sums like 0.1 + 0.2 from losing a slice.
  while (state.pending >= SUBSTEP_S - 1e-9) {
    state.pending -= SUBSTEP_S;
    if (tick(state, SUBSTEP_S)) {
      state.over = true;
      state.pending = 0;
      return { hit: true };
    }
  }
  return { hit: false };
}

export interface Effects {
  /** A short shake of the picture when the character is hit. */
  shake: boolean;
  /** The ground's dashes slide past. */
  movingBackground: boolean;
  /** The legs step while running. */
  legs: boolean;
}

/** prefers-reduced-motion keeps the game playable and drops everything that only decorates the motion. */
export function effectsFor(reducedMotion: boolean): Effects {
  return { shake: !reducedMotion, movingBackground: !reducedMotion, legs: !reducedMotion };
}
