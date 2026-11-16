// The 404 game's rules (Task F.3, src/lib/game/engine.ts) and its words (src/lib/game/hud.ts), without a browser:
// the jump arc, collisions, speed over time, score, spawning with a fixed seed, the first obstacle's time bound, frame
// rate independence and the reduced-motion effects. The game in a real browser is tests/e2e/game.spec.ts.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ACCELERATION,
  FIRST_HIT_MAX_MS,
  GRAVITY,
  GROUND_Y,
  JUMP_VELOCITY,
  MAX_FRAME_MS,
  MAX_SPEED,
  MAX_WIDTH,
  MIN_GAP_S,
  MIN_WIDTH,
  OBSTACLE_KINDS,
  PLAYER_INSET,
  PLAYER_H,
  PLAYER_W,
  PLAYER_X,
  START_SPEED,
  UNITS_PER_POINT,
  collides,
  createGame,
  effectsFor,
  isGrounded,
  jump,
  nextRandom,
  obstacleBox,
  playerBox,
  scoreFor,
  speedAt,
  step,
  type GameState,
} from '../src/lib/game/engine.ts';
import { buttonLabel, changedOnly, gameOverMessage, scoreLine } from '../src/lib/game/hud.ts';

/** Runs `seconds` of play in frames of `frameMs`, with no obstacles in the way. */
function runClear(state: GameState, seconds: number, frameMs: number | (() => number)) {
  let t = 0;
  while (t < seconds * 1000 - 1e-6) {
    const dt = typeof frameMs === 'number' ? frameMs : frameMs();
    const used = Math.min(dt, seconds * 1000 - t);
    state.obstacles = [];
    state.untilNext = Infinity;
    step(state, used);
    t += used;
  }
}

const clearGame = (seed = 1) => {
  const state = createGame(seed);
  state.untilNext = Infinity;
  return state;
};

// --- Jump and gravity ---

test('a jump peaks at about v²/2g and lands after about 2v/g', () => {
  const state = clearGame();
  jump(state);
  let peak = 0;
  let airtime = 0;
  while (true) {
    step(state, 1000 / 240);
    airtime += 1 / 240;
    peak = Math.max(peak, state.y);
    if (isGrounded(state)) break;
  }
  const expectedPeak = JUMP_VELOCITY ** 2 / (2 * GRAVITY);
  const expectedAir = (2 * JUMP_VELOCITY) / GRAVITY;
  assert.ok(Math.abs(peak - expectedPeak) / expectedPeak < 0.02, `peak ${peak} vs ${expectedPeak}`);
  assert.ok(Math.abs(airtime - expectedAir) < 0.02, `airtime ${airtime} vs ${expectedAir}`);
});

test('gravity brings the character back exactly to the ground, and it stays there', () => {
  const state = clearGame();
  jump(state);
  runClear(state, 1.5, 16);
  assert.equal(state.y, 0);
  assert.equal(state.vy, 0);
  assert.ok(isGrounded(state));
});

test('a jump only starts from the ground: pressing in the air does not jump again', () => {
  const state = clearGame();
  jump(state);
  runClear(state, 0.1, 16);
  const vy = state.vy;
  jump(state);
  assert.equal(state.vy, vy);
});

test('a press just before landing jumps on landing', () => {
  const state = clearGame();
  jump(state);
  // Fall until about 50 ms before landing.
  runClear(state, (2 * JUMP_VELOCITY) / GRAVITY - 0.05, 1000 / 240);
  assert.ok(state.y > 0);
  jump(state);
  runClear(state, 0.1, 1000 / 240);
  assert.ok(state.vy > 0, 'jumped again on landing');
});

test('no jumping once the round is over', () => {
  const state = clearGame();
  state.over = true;
  jump(state);
  assert.equal(state.vy, 0);
});

// --- Collisions ---

test('boxes that overlap collide; boxes that only touch, or miss, do not', () => {
  const a = { x: 0, y: 0, w: 10, h: 10 };
  assert.ok(collides(a, { x: 9, y: 0, w: 10, h: 10 }));
  assert.ok(collides(a, { x: 5, y: 9, w: 2, h: 2 }));
  assert.ok(!collides(a, { x: 10, y: 0, w: 10, h: 10 }), 'side by side');
  assert.ok(!collides(a, { x: 0, y: 10, w: 10, h: 10 }), 'one on top of the other');
  assert.ok(!collides(a, { x: 20, y: 0, w: 5, h: 5 }));
});

test('standing still into an obstacle ends the round; jumping over it does not', () => {
  const place = (state: GameState) => {
    state.untilNext = Infinity;
    state.obstacles = [{ kind: 'stapler', x: 120, w: 30, h: 34 }];
  };
  const stand = createGame(1);
  place(stand);
  let hit = false;
  for (let i = 0; i < 120 && !hit; i++) hit = step(stand, 16).hit;
  assert.ok(hit);
  assert.ok(stand.over);
  assert.deepEqual(step(stand, 16), { hit: false }, 'nothing happens after the round is over');

  const leap = createGame(1);
  place(leap);
  for (let i = 0; i < 120; i++) {
    autopilot(leap);
    assert.equal(step(leap, 16).hit, false);
  }
});

const AIRTIME_S = (2 * JUMP_VELOCITY) / GRAVITY;

/**
 * A simple player: jumps from the ground when the next obstacle's middle is half a jump's distance from the
 * character's middle, so the top of the jump is over the obstacle.
 */
function autopilot(state: GameState) {
  if (!isGrounded(state)) return;
  const middle = PLAYER_X + PLAYER_W / 2;
  const next = state.obstacles.find((o) => o.x + o.w > PLAYER_X);
  if (next && next.x + next.w / 2 - middle <= (state.speed * AIRTIME_S) / 2) jump(state);
}

test('always jumpable: a simple autopilot survives 90 s (past top speed) for 200 seeds, narrow and wide', () => {
  for (const width of [MIN_WIDTH, MAX_WIDTH]) {
    for (let seed = 0; seed < 200; seed++) {
      const state = createGame(seed * 2654435761, width);
      for (let ms = 0; ms < 90_000; ms += 16) {
        autopilot(state);
        assert.equal(step(state, 16).hit, false, `seed ${seed}, width ${width}: hit at ${ms} ms`);
      }
      assert.equal(state.speed, MAX_SPEED);
    }
  }
});

test('the top of a jump stays inside the world, above the tallest stapler', () => {
  const peak = JUMP_VELOCITY ** 2 / (2 * GRAVITY);
  assert.ok(GROUND_Y - PLAYER_H - peak >= 0, 'the character never leaves the top of the box');
  assert.ok(peak > 34 + 10, 'clears the tallest stapler with room to spare');
});

test("the character's box is forgiving: overlapping the drawn shape by less than the inset is not a hit", () => {
  const player = playerBox(clearGame());
  // A puddle whose right edge reaches PLAYER_INSET - 1 units into the drawn character: no hit. One unit past the
  // inset: a hit.
  const nearMiss = obstacleBox({ kind: 'puddle', x: PLAYER_X - 30 + PLAYER_INSET - 1, w: 30, h: 5 });
  const real = obstacleBox({ kind: 'puddle', x: PLAYER_X - 30 + PLAYER_INSET + 1, w: 30, h: 5 });
  assert.ok(!collides(player, nearMiss));
  assert.ok(collides(player, real));
});

// --- Speed and score ---

test('speed starts at START_SPEED, rises by ACCELERATION per second and stops at MAX_SPEED', () => {
  assert.equal(speedAt(0), START_SPEED);
  assert.equal(speedAt(10), START_SPEED + 10 * ACCELERATION);
  assert.equal(speedAt(10_000), MAX_SPEED);
  const state = clearGame();
  runClear(state, 5, 16);
  assert.ok(Math.abs(state.speed - (START_SPEED + 5 * ACCELERATION)) < 0.1);
  runClear(state, 120, 50);
  assert.equal(state.speed, MAX_SPEED);
});

test('score grows with distance: one point per UNITS_PER_POINT units', () => {
  assert.equal(scoreFor(0), 0);
  assert.equal(scoreFor(UNITS_PER_POINT - 0.01), 0);
  assert.equal(scoreFor(UNITS_PER_POINT * 7), 7);
  const state = clearGame();
  runClear(state, 2, 16);
  assert.equal(scoreFor(state.distance), Math.floor(state.distance / UNITS_PER_POINT));
  assert.ok(scoreFor(state.distance) >= 2 * (START_SPEED / UNITS_PER_POINT) - 1);
});

// --- Spawning ---

/** The obstacles a game creates in `seconds`, with their speed when created, running through everything. */
function spawned(seed: number, seconds: number, width = MAX_WIDTH) {
  const state = createGame(seed, width);
  const seen: { kind: string; x: number; w: number; h: number; speed: number; distance: number }[] = [];
  for (let t = 0; t < seconds * 1000; t += 16) {
    const before = state.spawned;
    // Never hit: the character floats above everything. Collisions aren't what this checks.
    state.y = 1000;
    state.vy = 0;
    step(state, 16);
    if (state.spawned > before) {
      const o = state.obstacles.at(-1)!;
      seen.push({ ...o, speed: state.speed, distance: state.distance });
    }
  }
  return seen;
}

test('the same seed gives the same obstacles; another seed gives others', () => {
  const a = spawned(42, 30).map(({ kind, w, h, distance }) => ({ kind, w, h, distance }));
  const b = spawned(42, 30).map(({ kind, w, h, distance }) => ({ kind, w, h, distance }));
  const c = spawned(43, 30).map(({ kind, w, h, distance }) => ({ kind, w, h, distance }));
  assert.ok(a.length > 10);
  assert.deepEqual(a, b);
  assert.notDeepEqual(a, c);
});

test('every kind of obstacle shows up, and the first one is always a small ink blot', () => {
  for (const seed of [1, 2, 3, 42, 1234]) {
    const seen = spawned(seed, 40);
    assert.equal(seen[0]!.kind, 'blot');
    for (const kind of OBSTACLE_KINDS)
      assert.ok(
        seen.some((o) => o.kind === kind),
        `seed ${seed}: no ${kind}`,
      );
  }
});

test('the gap between two obstacles is always at least MIN_GAP_S at the speed it was made', () => {
  for (const seed of [1, 7, 99, 2026]) {
    const seen = spawned(seed, 60);
    for (let i = 1; i < seen.length; i++) {
      const prev = seen[i - 1]!;
      const next = seen[i]!;
      // Distance run between the previous obstacle appearing and the next one, minus the previous one's width.
      const gap = next.distance - prev.distance - prev.w;
      assert.ok(gap >= MIN_GAP_S * prev.speed - 2, `seed ${seed}, obstacle ${i}: gap ${gap}`);
    }
  }
});

test(`for 1,000 seeds the first obstacle reaches a character that never jumps within ${FIRST_HIT_MAX_MS} ms`, () => {
  for (const width of [MIN_WIDTH, MAX_WIDTH]) {
    let worst = 0;
    for (let seed = 0; seed < 1000; seed++) {
      const state = createGame(seed * 2654435761, width);
      let ms = 0;
      while (!step(state, 1000 / 60).hit) {
        ms += 1000 / 60;
        assert.ok(ms <= FIRST_HIT_MAX_MS, `seed ${seed}, width ${width}: no hit after ${ms} ms`);
      }
      worst = Math.max(worst, ms);
    }
    assert.ok(worst > 0);
  }
});

test('nextRandom stays in [0, 1)', () => {
  const s = { rng: 123 };
  for (let i = 0; i < 10_000; i++) {
    const r = nextRandom(s);
    assert.ok(r >= 0 && r < 1);
  }
});

// --- Frame rate ---

test('the same 2 s at 60 Hz, 144 Hz and uneven frames reach the same place', () => {
  const run = (frame: number | (() => number)) => {
    const state = clearGame();
    jump(state);
    runClear(state, 2, frame);
    return state;
  };
  let i = 0;
  const uneven = [5, 33, 16, 8, 50, 2];
  const results = [run(1000 / 60), run(1000 / 144), run(() => uneven[i++ % uneven.length]!)];
  const [base] = results;
  for (const r of results) {
    // Within one 1/240 s slice of each other.
    assert.ok(Math.abs(r.distance - base!.distance) <= MAX_SPEED / 240 + 1e-6, `distance ${r.distance}`);
    assert.ok(Math.abs(r.time - base!.time) <= 1 / 240 + 1e-9);
    assert.equal(scoreFor(r.distance), scoreFor(base!.distance));
    assert.equal(r.y, 0);
  }
});

test(`a long stall counts as at most ${MAX_FRAME_MS} ms`, () => {
  const state = clearGame();
  step(state, 5000);
  assert.ok(Math.abs(state.time - MAX_FRAME_MS / 1000) < 1 / 240 + 1e-9);
  step(state, -50);
  assert.ok(state.time < 0.11, 'a negative frame time adds nothing');
});

// --- Reduced motion and words ---

test('reduced motion drops the shake, the sliding ground and the stepping legs; full motion keeps them', () => {
  assert.deepEqual(effectsFor(true), { shake: false, movingBackground: false, legs: false });
  assert.deepEqual(effectsFor(false), { shake: true, movingBackground: true, legs: true });
});

test("the score line, the button's labels and the game-over message", () => {
  assert.deepEqual((['idle', 'running', 'paused', 'over'] as const).map(buttonLabel), [
    'Play',
    'Restart',
    'Continue',
    'Play again',
  ]);
  assert.equal(scoreLine(12, 40), 'Score 12 · Best 40');
  assert.ok(scoreLine(99_999, 99_999).length <= 26, 'fits beside the button at 375px');
  assert.equal(gameOverMessage(12, 40, false), 'Game over. Score 12, best 40. Press Enter or tap to play again.');
  assert.equal(gameOverMessage(50, 50, true), 'Game over. New best: 50! Press Enter or tap to play again.');
});

test('changedOnly writes only when the value changes', () => {
  const writes: string[] = [];
  const write = changedOnly((text: string) => writes.push(text));
  for (const text of ['Score 0', 'Score 0', 'Score 0', 'Score 1', 'Score 1', 'Score 2', 'Score 2']) write(text);
  assert.deepEqual(writes, ['Score 0', 'Score 1', 'Score 2']);
  const ys: number[] = [];
  const writeY = changedOnly((y: number) => ys.push(y));
  for (const y of [0, 0, 3, 3, 0]) writeY(y);
  assert.deepEqual(ys, [0, 3, 0]);
});
