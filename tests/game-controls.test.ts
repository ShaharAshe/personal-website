// The 404 game's controls (Task F.3, src/lib/game/controls.ts): what each key, tap and button press does in each
// phase, and when the game hears a key at all. The same rules in a real browser are in tests/e2e/game.spec.ts.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RESTART_GRACE_MS, buttonAction, isGameKeyEvent, keyAction, tapAction } from '../src/lib/game/controls.ts';
import type { Phase } from '../src/lib/game/hud.ts';

const PHASES: Phase[] = ['idle', 'running', 'paused', 'over'];

test('Space and ArrowUp: start, jump, go on, and play again only after the grace period', () => {
  for (const key of [' ', 'ArrowUp']) {
    assert.equal(keyAction(key, 'idle', 0), 'start');
    assert.equal(keyAction(key, 'running', 0), 'jump');
    assert.equal(keyAction(key, 'paused', 0), 'continue');
    assert.equal(keyAction(key, 'over', RESTART_GRACE_MS - 1), 'ignore', 'used up, so it still does not scroll');
    assert.equal(keyAction(key, 'over', RESTART_GRACE_MS), 'start');
  }
});

test('Enter starts when idle or over (no grace), goes on when paused, and is left alone while running', () => {
  assert.equal(keyAction('Enter', 'idle', 0), 'start');
  assert.equal(keyAction('Enter', 'over', 0), 'start');
  assert.equal(keyAction('Enter', 'paused', 0), 'continue');
  assert.equal(keyAction('Enter', 'running', 0), null);
});

test('other keys are never the game’s', () => {
  for (const phase of PHASES) {
    for (const key of ['Tab', 'a', 'ArrowDown', 'Escape', 'Spacebar', 'Shift'])
      assert.equal(keyAction(key, phase, 1e6), null);
  }
});

test('a tap does what Space does', () => {
  for (const phase of PHASES) {
    for (const since of [0, RESTART_GRACE_MS]) assert.equal(tapAction(phase, since), keyAction(' ', phase, since));
  }
});

test('the button does what its label said: Continue goes on, Play / Restart / Play again start', () => {
  assert.deepEqual(PHASES.map(buttonAction), ['start', 'start', 'continue', 'start']);
});

test('the game hears keys only with focus on the page itself or the canvas, and never shortcuts', () => {
  const plain = { ctrlKey: false, metaKey: false, altKey: false, defaultPrevented: false };
  const body = { tagName: 'BODY' } as Element;
  const html = { tagName: 'HTML' } as Element;
  const canvas = { tagName: 'CANVAS' } as Element;
  const link = { tagName: 'A' } as Element;
  const button = { tagName: 'BUTTON' } as Element;
  const input = { tagName: 'INPUT' } as Element;

  for (const active of [body, html, canvas, null]) assert.ok(isGameKeyEvent(plain, active, canvas, body));
  // A link (Back to home), any button (the game's own included: it presses itself) or a field keeps its key.
  for (const active of [link, button, input]) assert.ok(!isGameKeyEvent(plain, active, canvas, body));
  for (const modifier of ['ctrlKey', 'metaKey', 'altKey', 'defaultPrevented'] as const) {
    assert.ok(!isGameKeyEvent({ ...plain, [modifier]: true }, body, canvas, body), modifier);
  }
});
